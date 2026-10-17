'use strict';
/**
 * 0008 v4 — WeChat DevTools first-open console audit (regression). Works with Oi's finalize_wechat_local.cjs (12ef697 + 0008-v2 diff).
 *
 *   fresh Creator wechatgame output ──copy──▶ <workRoot>/QFFirstOpen-<UTC ms>-<rand>-<case>/   (unique dir + unique projectname)
 *        └─ REAL finalizer on the COPY → audit shim (heartbeat + canary with a per-case token) into the COPY's game.js
 *   own CLI child `cli auto --project <copy> --auto-port <p>` (no manual Compile) + miniprogram-automator
 *   evidence channels: automator console/exception, shim buffer, WeappLog tail (identity/truncation aware), own CLI output
 *   → close ONLY its own copy (`cli close --project <copy>`), drain own CLI, stop tailers → verdict.json → manifest → self-check
 *
 * v3 rules (cloud review 0008, P1-01…06):
 *  - Missing / unproven / incomplete evidence is BLOCKED, never PASS. PASS needs every channel proven by THIS case's own canary.
 *  - WeappLog lines count as this project's only if they carry an own marker (copy path, unique projectname or token).
 *    Unattributable findings can't prove anything and can't be dismissed → BLOCKED (unless an own error already FAILs the case).
 *  - Own CLI: exit code, error, timeout, still-running after close are verdict inputs. Global `quit` is not available at all.
 *  - Evidence is frozen before hashing: all own CLI children exited (or terminated), tailers stopped, run.log closed; manifest
 *    is re-verified after writing (stdout "selfCheck"; mismatch → exit 2).
 * v4 rules (cloud re-review 0008-v3, items A–E):
 *  - A: every event (automator console by level, exceptions, shim records, EVERY WeappLog line, CLI output) is normalised and
 *    classified by ONE rule set (rules.classifyEvent). console.error level is an error even with unrecognised text; plain
 *    "Error:" and any "[…错误…]" category are errors at any level. Own → FAIL; unattributable → BLOCKED.
 *  - B: only an event whose whole normalised payload is exactly "[QF-AUDIT-CANARY(-LATE)] <this token>" is exempt.
 *  - C: boot canary (shim record + canaryAtBoot flag + own WeappLog line) and LATE canary (automator + shim) are required
 *    separately; a LATE canary never stands in for the boot canary.
 *  - D: the notice is allowlisted only as the whole normalised payload; no suffix/end-of-line extraction.
 *  - E: WeappLog tailer protocol and consistency checks are documented on LogTailer; violations → BLOCKED.
 * Known IDE notice: FORBIDDEN by default; QF_FIRST_OPEN_ALLOW_APPJSON_NOTICE=1 accepts that exact string only → PASS_WITH_ALLOWLISTED_IDE_NOTICE.
 * Exit: 0 PASS, 1 FAIL, 2 BLOCKED (or manifest self-check failure), 3 PASS_WITH_ALLOWLISTED_IDE_NOTICE.
 */
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const {StringDecoder} = require('string_decoder');
const env = require('./qf-wechat-env.cjs');
const rules = require('./first_open_console_rules.cjs');
const VERSION = '0008-v4';
const CASES = ['default', 'diag-appid'];
function normalizeVariant(v) {
  const n = String(v == null || v === '' ? 'default' : v).trim().toLowerCase();
  if (!CASES.includes(n)) throw new Error(`unknown case ${v} (${CASES.join('|')})`);
  return n;
}
const finalizerPath = () => path.resolve(process.env.QF_FINALIZER || path.join(__dirname, 'finalize_wechat_local.cjs'));
const allowAppJsonNotice = () => /^(1|true|yes)$/i.test(process.env.QF_FIRST_OPEN_ALLOW_APPJSON_NOTICE || '');

/** v4: no separate pattern gate — kept only as a compatibility export (= the unified rule set in first_open_console_rules.cjs). */
const STRONG_ERROR_PATTERNS = rules.FORBIDDEN.map((f) => f.re);
const ALLOWED_CLI_SUBCOMMANDS = new Set(['islogin', 'auto', 'open', 'close']); // v3: no `quit`

const sha256File = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const utcStampMs = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\.(\d+)Z$/, '$1Z');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raceTimer = (ms) => new Promise((r) => setTimeout(r, ms).unref()); // for races: never keeps the process alive

class RunLog {
  constructor(file) { this.file = file; this.t0 = Date.now(); this.closed = false; this.late = []; }
  step(msg, data) {
    const line = `${new Date().toISOString()} +${((Date.now() - this.t0) / 1000).toFixed(1)}s ${msg}` + (data !== undefined ? ' ' + JSON.stringify(data) : '');
    if (this.closed) { this.late.push(line); console.error('[after-freeze] ' + line); return; } // never touches a hashed file
    fs.appendFileSync(this.file, line + '\n'); // synchronous: on disk before the next step
    console.error(line);
  }
  close() { this.closed = true; }
}

function walkFiles(root, out = [], rel = '') {
  for (const e of fs.readdirSync(path.join(root, rel), {withFileTypes: true})) {
    const r = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) walkFiles(root, out, r); else if (e.isFile()) out.push(r); else out.push(r + ' (not a regular file)');
  }
  return out;
}
function findSymlinks(root, rel = '', out = []) {
  for (const e of fs.readdirSync(path.join(root, rel), {withFileTypes: true})) {
    const r = rel ? path.join(rel, e.name) : e.name;
    if (e.isSymbolicLink()) out.push(r); else if (e.isDirectory()) findSymlinks(root, r, out);
  }
  return out;
}
function copyTree(src, dst) { fs.cpSync(src, dst, {recursive: true, errorOnExist: true, force: false, dereference: false}); }

/** Own child-process registry: every CLI child we spawn is tracked until it has exited and its pipes are drained. */
class Children {
  constructor() { this.set = new Set(); }
  add(h) { this.set.add(h); h.closed.then(() => this.set.delete(h)); }
  running() { return [...this.set]; }
  async drainAll(ms, log) {
    const pending = this.running();
    if (!pending.length) return [];
    await Promise.race([Promise.all(pending.map((h) => h.closed)), raceTimer(ms)]);
    const killed = [];
    for (const h of this.running()) { killed.push(h.label); await h.terminate(log); }
    return killed;
  }
}

/** Spawn an allowed CLI subcommand. Listeners are attached at spawn; output is decoded across chunks and kept live in h.lines. */
function spawnCli(cli, args, {timeoutMs, log, label, children}) {
  if (!ALLOWED_CLI_SUBCOMMANDS.has(args[0])) throw new Error(`refusing CLI subcommand ${args[0]}`);
  const started = Date.now();
  const isBat = /\.bat$/i.test(cli);
  const child = isBat ? cp.spawn('cmd.exe', ['/c', cli, ...args], {windowsHide: true}) : cp.spawn(cli, args, {stdio: ['ignore', 'pipe', 'pipe']});
  const h = {label, args, pid: child.pid, lines: [], code: undefined, signal: null, error: null, timedOut: false, terminated: false, exited: false, ms: null};
  const take = (stream) => {
    const dec = new StringDecoder('utf8'); let carry = '';
    const push = (s) => { if (s.trim()) h.lines.push({t: new Date().toISOString(), stream, line: s}); };
    const src = child[stream];
    if (!src) return Promise.resolve();
    src.on('data', (buf) => { const parts = (carry + dec.write(buf)).split(/\r?\n/); carry = parts.pop(); parts.forEach(push); });
    return new Promise((res) => src.on('close', () => { push(carry + dec.end()); carry = ''; res(); }));
  };
  const drained = Promise.all([take('stdout'), take('stderr')]);
  let resolveExit; const exit = new Promise((r) => { resolveExit = r; });
  child.on('error', (e) => { h.error = String(e.message || e); resolveExit(); });
  child.on('exit', (code, signal) => { h.code = code; h.signal = signal; resolveExit(); });
  const timer = setTimeout(() => { if (!h.exited) { h.timedOut = true; h.lines.push({t: new Date().toISOString(), stream: 'runner', line: `TIMEOUT after ${timeoutMs}ms`}); try { child.kill('SIGTERM'); } catch {} } }, timeoutMs);
  h.closed = Promise.all([exit, h.error ? Promise.resolve() : drained.catch(() => {})]).then(() => {
    clearTimeout(timer); h.exited = true; h.ms = Date.now() - started;
    log && log.step(`cli ${args[0]} pid=${h.pid} exit=${h.code}${h.signal ? ' signal=' + h.signal : ''}${h.error ? ' error=' + h.error : ''}${h.terminated ? ' (terminated by audit)' : ''} (${h.ms}ms, ${h.lines.length} lines)`);
  });
  h.terminate = async (lg) => {
    if (h.exited) return;
    h.terminated = true; lg && lg.step(`terminating own CLI child ${label} pid=${h.pid} (still running)`);
    try { child.kill('SIGTERM'); } catch {}
    await Promise.race([h.closed, raceTimer(3000)]);
    if (!h.exited) { try { child.kill('SIGKILL'); } catch {} await Promise.race([h.closed, raceTimer(3000)]); }
  };
  h.ok = () => h.exited && !h.terminated && !h.timedOut && !h.error && h.code === 0;
  h.summary = () => ({label, args, pid: h.pid, code: h.code, signal: h.signal, error: h.error, timedOut: h.timedOut, terminated: h.terminated, exited: h.exited, ms: h.ms, lines: h.lines});
  children && children.add(h);
  return h;
}
async function runCli(cli, args, o) { const h = spawnCli(cli, args, o); await h.closed; return h; }

/**
 * WeappLog tailer (v4). SUPPORTED PROTOCOL — anything outside it is recorded in `incomplete` (→ BLOCKED), not assumed:
 *  - files: regular files named *.log anywhere below a directory named WeappLog (or the root itself if it is named WeappLog),
 *    depth ≤ 8; tracked by device+inode (renames followed);
 *  - content: UTF-8 text, LF or CRLF line-delimited, APPEND-ONLY (bytes once written are never changed, file never shrinks);
 *    an invalid UTF-8 sequence is a protocol violation;
 *  - line format: see rules.parseLogLine (timestamps / own marker / optional level tag / payload); unknown formats are still
 *    scanned with the full error rule set (fail-closed), never skipped.
 * Consistency checks (each failure → incomplete): truncation (size < read offset); new inode at a tracked path (replacement);
 * vanished file; first ≤4 KiB changed (checked every poll); last ≤4 KiB before the read offset changed (every poll);
 * FULL re-hash of [0, read offset) at stop compared with the running SHA-256 of every byte read (catches any rewrite of the
 * already-read region that is still present at stop — e.g. same inode, same size, same first 4 KiB, changed middle/suffix);
 * read/readdir errors; byte budget exhausted.
 * NOT detectable (stated, not promised away): a rewrite that is reverted to the identical bytes before the next poll and
 * before stop; bytes written to files outside the protocol above (other dirs / extensions); a writer that never writes.
 */
class LogTailer {
  constructor(root, {pollMs, maxBytes}) {
    this.root = root ? path.resolve(root) : null; this.pollMs = pollMs; this.maxBytes = maxBytes;
    this.files = new Map(); this.lines = []; this.events = []; this.incomplete = []; this.bytes = 0; this.longLines = 0;
    this.rootExistedAtStart = !!(this.root && fs.existsSync(this.root)); this.rootSeen = this.rootExistedAtStart; this.timer = null; this.stopped = false;
  }
  list() {
    const out = [];
    if (!this.root || !fs.existsSync(this.root)) return out;
    this.rootSeen = true;
    const visit = (dir, depth, inWeapp) => {
      if (depth > 8) return;
      let ents; try { ents = fs.readdirSync(dir, {withFileTypes: true}); } catch (e) { this.incomplete.push(`readdir ${dir}: ${e.code || e.message}`); return; }
      for (const e of ents) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) visit(p, depth + 1, inWeapp || e.name === 'WeappLog');
        else if (e.isFile() && inWeapp && /\.log$/i.test(e.name)) out.push(p);
      }
    };
    visit(this.root, 0, path.basename(this.root) === 'WeappLog'); // root may itself be a WeappLog dir
    return out;
  }
  prefixHash(fd, n) { if (!n) return ''; const b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, 0); return crypto.createHash('sha1').update(b).digest('hex'); }
  readRange(fd, from, to) { const b = Buffer.alloc(Math.max(0, to - from)); let got = 0; while (got < b.length) { const n = fs.readSync(fd, b, got, b.length - got, from + got); if (!n) break; got += n; } return b.subarray(0, got); }
  hashRange(fd, to) { const h = crypto.createHash('sha256'); const CH = 1 << 20; for (let pos = 0; pos < to;) { const b = this.readRange(fd, pos, Math.min(to, pos + CH)); if (!b.length) break; h.update(b); pos += b.length; } return h; }
  resetFile(f) { f.offset = 0; f.carry = ''; f.dec = new StringDecoder('utf8'); f.prefixLen = 0; f.prefix = ''; f.hash = crypto.createHash('sha256'); f.tail = Buffer.alloc(0); }
  baseline() {
    for (const p of this.list()) {
      try { const st = fs.statSync(p); const fd = fs.openSync(p, 'r'); const n = Math.min(st.size, 4096);
        // running hash + tail of the pre-existing region (not emitted as lines: it predates this case)
        const hash = this.hashRange(fd, st.size); const tail = this.readRange(fd, Math.max(0, st.size - 4096), st.size);
        this.files.set(`${st.dev}:${st.ino}`, {path: p, offset: st.size, prefixLen: n, prefix: this.prefixHash(fd, n), hash, tail, dec: new StringDecoder('utf8'), carry: '', preexisting: true}); fs.closeSync(fd);
      } catch (e) { this.incomplete.push(`baseline ${p}: ${e.code || e.message}`); }
    }
    this.events.push({t: new Date().toISOString(), event: 'baseline', rootExists: this.rootExistedAtStart, files: this.files.size});
  }
  start() { this.baseline(); this.timer = setInterval(() => this.poll(), this.pollMs); }
  emit(f, text, final) {
    const parts = (f.carry + text).split(/\r?\n/); f.carry = final ? '' : parts.pop();
    for (const line of parts) if (line.trim()) { if (line.length > 4000) this.longLines++; this.lines.push({file: f.path, line, stored: line.slice(0, 4000)}); }
  }
  readFrom(f, fd, from, to) {
    let pos = from; const CH = 1 << 20;
    while (pos < to) {
      if (this.bytes >= this.maxBytes) { this.incomplete.push(`budget QF_WEAPPLOG_MAX_BYTES=${this.maxBytes} exhausted at ${f.path}:${pos}`); f.offset = to; return; }
      const n = Math.min(CH, to - pos, this.maxBytes - this.bytes); const b = Buffer.alloc(n);
      const got = fs.readSync(fd, b, 0, n, pos); if (!got) break;
      const chunk = b.subarray(0, got); f.hash.update(chunk); f.tail = Buffer.concat([f.tail, chunk]).subarray(-4096);
      pos += got; this.bytes += got;
      const text = f.dec.write(chunk);
      if (text.includes('\uFFFD') && !f.badUtf8) { f.badUtf8 = true; this.incomplete.push(`protocol: invalid UTF-8 in ${f.path} near byte ${pos}`); }
      this.emit(f, text, false);
    }
    f.offset = pos;
  }
  poll() {
    if (this.stopped) return;
    const seen = new Set();
    for (const p of this.list()) {
      let st, fd;
      try { st = fs.statSync(p); } catch (e) { continue; }
      const id = `${st.dev}:${st.ino}`; seen.add(id);
      let f = this.files.get(id);
      try {
        fd = fs.openSync(p, 'r');
        if (!f) {
          // a file that appeared after the baseline: replacement at an old path is a possible gap for the old inode
          const replaced = [...this.files.values()].find((x) => x.path === p && !x.gone);
          if (replaced) { replaced.gone = true; this.incomplete.push(`replaced (new inode) ${p}`); this.events.push({t: new Date().toISOString(), event: 'replaced', file: p}); }
          f = {path: p, preexisting: false}; this.resetFile(f);
          this.files.set(id, f); this.events.push({t: new Date().toISOString(), event: 'new-file', file: p, size: st.size});
        }
        if (f.path !== p) { this.events.push({t: new Date().toISOString(), event: 'renamed', from: f.path, to: p}); f.path = p; }
        if (st.size < f.offset) {
          this.incomplete.push(`truncated ${p}: size ${st.size} < read offset ${f.offset}`); this.events.push({t: new Date().toISOString(), event: 'truncated', file: p});
          this.resetFile(f);
        } else if (f.prefixLen && this.prefixHash(fd, f.prefixLen) !== f.prefix) {
          this.incomplete.push(`rewritten in place ${p} (first 4 KiB changed)`); this.events.push({t: new Date().toISOString(), event: 'rewritten', file: p, where: 'prefix'});
          this.resetFile(f);
        } else if (f.tail.length && !this.readRange(fd, f.offset - f.tail.length, f.offset).equals(f.tail)) {
          this.incomplete.push(`rewritten in place ${p} (last ${f.tail.length} bytes before read offset ${f.offset} changed)`); this.events.push({t: new Date().toISOString(), event: 'rewritten', file: p, where: 'tail'});
          this.resetFile(f);
        }
        if (st.size > f.offset) this.readFrom(f, fd, f.offset, st.size);
        const n = Math.min(st.size, 4096); if (n > f.prefixLen) { f.prefixLen = n; f.prefix = this.prefixHash(fd, n); }
      } catch (e) { this.incomplete.push(`read ${p}: ${e.code || e.message}`); }
      finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
    }
    for (const [id, f] of this.files) if (!seen.has(id) && !f.gone) { f.gone = true; this.events.push({t: new Date().toISOString(), event: 'vanished', file: f.path}); if (!f.preexisting || f.offset > 0) this.incomplete.push(`vanished before final read ${f.path}`); }
  }
  async stop(settleMs) {
    this.poll(); await sleep(settleMs); this.poll();
    for (const f of this.files.values()) this.emit(f, f.dec.end(), true);
    // final consistency: re-hash everything already read and compare with the running hash
    for (const f of this.files.values()) {
      if (f.gone) continue;
      let fd; try {
        fd = fs.openSync(f.path, 'r'); const st = fs.fstatSync(fd);
        if (st.size < f.offset) { this.incomplete.push(`final check: ${f.path} shrank to ${st.size} < ${f.offset}`); continue; }
        const now = this.hashRange(fd, f.offset).digest('hex'), ran = f.hash.copy().digest('hex');
        if (now !== ran) { this.incomplete.push(`final check: ${f.path} bytes [0,${f.offset}) changed after being read (sha256 ${ran.slice(0, 12)}… → ${now.slice(0, 12)}…)`); this.events.push({t: new Date().toISOString(), event: 'rewritten', file: f.path, where: 'final-rehash'}); }
        this.events.push({t: new Date().toISOString(), event: 'final-rehash', file: f.path, bytes: f.offset, ok: now === ran});
      } catch (e) { this.incomplete.push(`final check ${f.path}: ${e.code || e.message}`); }
      finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
    }
    this.stopped = true; clearInterval(this.timer); this.timer = null;
    if (this.longLines) this.events.push({event: 'long-lines', count: this.longLines, note: 'matched on full text; stored first 4000 chars'});
  }
}

/** Prepend the shim, but keep a leading "use strict" directive (and comments before it) first so strictness is unchanged. */
function injectShim(src, shim) {
  const m = /^(\uFEFF?(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*)(['"]use strict['"];?)/.exec(src);
  if (m) return src.slice(0, m[0].length) + '\n' + shim + '\n' + src.slice(m[0].length);
  return shim + '\n' + src;
}

async function auditVariant(ctx, variant, port, role) {
  const {log, outDir, cli, runId} = ctx;
  const v = normalizeVariant(variant);
  const name = `QFFirstOpen-${runId}-${crypto.randomBytes(3).toString('hex')}-${v}`;
  const copyDir = path.join(env.workRoot(), name);
  const vdir = path.join(outDir, `${role}-${v}`);
  fs.mkdirSync(vdir, {recursive: true});
  const R = {role, variant: v, projectDir: copyDir, projectname: name, port, steps: {}, channels: {}, errors: [], knownNotice: [], knownNoticeUnattributed: [], unattributed: [], warnings: [], missing: [], status: null, reason: null};
  const blocked = (why) => { R.status = 'BLOCKED'; R.reason = why; R.missing.push(why); log.step(`[${role}:${v}] BLOCKED ${why}`); return R; };

  // 1. unique copy (no symlinks followed)
  log.step(`[${role}:${v}] copy build → ${copyDir}`);
  if (fs.existsSync(copyDir)) return blocked(`copy dir already exists: ${copyDir}`);
  fs.mkdirSync(path.dirname(copyDir), {recursive: true});
  copyTree(ctx.buildDir, copyDir);
  const pcFile = path.join(copyDir, 'project.config.json');
  const pcText = fs.readFileSync(pcFile, 'utf8');
  const pc = JSON.parse(pcText.replace(/^\uFEFF/, ''));
  R.steps.originalProjectname = pc.projectname;
  pc.projectname = name; // unique projectname = attribution marker
  fs.writeFileSync(pcFile, JSON.stringify(pc, null, 2) + (/\n$/.test(pcText) ? '\n' : ''));
  const priv = path.join(copyDir, 'project.private.config.json');
  if (fs.existsSync(priv)) { R.steps.privateConfigInBuild = true; fs.copyFileSync(priv, path.join(vdir, 'project.private.config.json.from-build')); }

  // 2. REAL finalizer on the copy
  const fin = cp.spawnSync(process.execPath, [finalizerPath(), copyDir], {encoding: 'utf8', env: process.env});
  R.steps.finalizer = {path: finalizerPath(), sha256: fs.existsSync(finalizerPath()) ? sha256File(finalizerPath()) : null, exit: fin.status, stdout: (fin.stdout || '').trim(), stderr: (fin.stderr || '').trim().slice(0, 4000)};
  fs.writeFileSync(path.join(vdir, 'finalizer-result.json'), JSON.stringify(R.steps.finalizer, null, 2));
  log.step(`[${role}:${v}] finalizer exit=${fin.status} ${R.steps.finalizer.stdout}`);
  if (fin.status !== 0) return blocked('finalizer refused the build (see finalizer-result.json)');
  const finalPc = JSON.parse(fs.readFileSync(pcFile, 'utf8'));
  if (!finalPc.setting || finalPc.setting.enhance !== false) return blocked('finalizer did not set setting.enhance=false — QF_FINALIZER must be Oi 12ef697 (+0008-v2 diff)');
  if (finalPc.condition !== undefined) return blocked('condition still present after finalizer');
  try { R.steps.removedConditionReportedByFinalizer = JSON.parse(R.steps.finalizer.stdout.split('\n').pop()).removedCondition; } catch {}
  if (v === 'diag-appid') {
    const diagAppid = process.env.QF_FIRST_OPEN_DIAG_APPID;
    if (!diagAppid) return blocked('case diag-appid needs QF_FIRST_OPEN_DIAG_APPID (a test/tourist AppID you may open locally)');
    finalPc.appid = diagAppid; R.steps.diagnostic = `appid changed on COPY only: wx3bdd911c5c06f591 -> ${diagAppid} (diagnostic, not a fix)`;
    fs.writeFileSync(pcFile, JSON.stringify(finalPc, null, 2) + '\n');
  }
  fs.copyFileSync(pcFile, path.join(vdir, 'project.config.json.as-opened'));
  if (fs.existsSync(priv)) fs.copyFileSync(priv, path.join(vdir, 'project.private.config.json.as-opened'));

  // 3. shim with per-case token (heartbeat + canary)
  const token = crypto.randomBytes(8).toString('hex');
  R.token = token;
  const markers = [copyDir, name, token];
  R.attributionMarkers = markers;
  if (env.injectShim()) {
    const gameJs = path.join(copyDir, 'game.js');
    if (!fs.existsSync(gameJs)) return blocked('game.js missing in build output');
    const shim = fs.readFileSync(path.join(__dirname, 'first-open-audit-shim.js'), 'utf8').replace(/__QF_TOKEN__/g, token);
    fs.writeFileSync(gameJs, injectShim(fs.readFileSync(gameJs, 'utf8'), shim));
    R.steps.shimInjected = true;
    log.step(`[${role}:${v}] audit shim injected into COPY game.js (token ${token})`);
  } else R.steps.shimInjected = false;
  fs.writeFileSync(path.join(vdir, 'build-copy-SHA256SUMS.txt'), walkFiles(copyDir).sort().map((r) => `${sha256File(path.join(copyDir, r))}  ${r.split(path.sep).join('/')}`).join('\n') + '\n');

  // 4. open with own CLI child; tail WeappLog from before the launch
  const tailer = new LogTailer(env.logDir(), {pollMs: env.logPollMs(), maxBytes: env.logMaxBytes()});
  tailer.start();
  const mode = env.mode();
  R.mode = mode;
  let mp = null, launch = null; const consoleMsgs = []; const exceptions = [];
  if (mode === 'auto') {
    let automator;
    const modId = env.automatorModule();
    if (!modId) { await tailer.stop(0); return blocked('miniprogram-automator not found (npm i -D miniprogram-automator@0.12.1, or set QF_MINIPROGRAM_AUTOMATOR_MODULE)'); }
    try { automator = require(modId); automator = automator.default || automator; } catch (e) { await tailer.stop(0); return blocked('cannot load miniprogram-automator: ' + e.message); }
    log.step(`[${role}:${v}] cli auto --project ${copyDir} --auto-port ${port}`);
    launch = spawnCli(cli, ['auto', '--project', copyDir, '--auto-port', String(port)], {timeoutMs: env.launchTimeoutMs() + env.settleMs() + 60000, log, label: 'auto', children: ctx.children});
    ctx.opened.add(copyDir);
    const deadline = Date.now() + env.launchTimeoutMs();
    let lastErr = null;
    while (Date.now() < deadline) {
      try { mp = await automator.connect({wsEndpoint: `ws://127.0.0.1:${port}`}); break; } catch (e) { lastErr = e; }
      if (launch.exited && launch.code !== 0) break;
      await sleep(1000);
    }
    if (!mp) R.steps.connectError = lastErr ? String(lastErr.message) : 'timeout';
    else {
      log.step(`[${role}:${v}] automator connected`);
      mp.on('console', (m) => consoleMsgs.push({t: new Date().toISOString(), type: m && m.type, args: m && m.args}));
      mp.on('exception', (e) => exceptions.push({t: new Date().toISOString(), message: e && e.message, stack: e && e.stack}));
      await sleep(500);
      if (R.steps.shimInjected) {
        try { R.steps.pingResult = await mp.evaluate(function () { var a = globalThis.__QF_FIRST_OPEN_AUDIT__; return a && a.ping ? a.ping() : null; }); }
        catch (e) { R.steps.pingError = String(e.message || e); }
      }
      log.step(`[${role}:${v}] settle ${env.settleMs()}ms (no Compile, no input)`);
      await sleep(env.settleMs());
      if (R.steps.shimInjected) {
        try {
          R.shim = await mp.evaluate(function () { var a = globalThis.__QF_FIRST_OPEN_AUDIT__; if (!a) return null; return {version: a.version, token: a.token, installedAt: a.installedAt, heartbeat: a.heartbeat, canaryAtBoot: a.canaryAtBoot, wrapped: a.wrapped, stillWrapped: a.stillWrapped ? a.stillWrapped() : [], onErrorRegistered: a.onErrorRegistered, onUnhandledRejectionRegistered: a.onUnhandledRejectionRegistered, installErrors: a.installErrors, dropped: a.dropped, errors: a.errors, warns: a.warns, logs: a.logs || [], onError: a.onError, unhandled: a.unhandled}; });
        } catch (e) { R.steps.shimReadError = String(e.message || e); }
      }
      try { await mp.screenshot({path: path.join(vdir, 'simulator.png')}); R.steps.screenshot = 'simulator.png'; } catch (e) { R.steps.screenshotError = String(e.message || e); }
    }
  } else if (mode === 'open') {
    log.step(`[${role}:${v}] cli open --project ${copyDir}`);
    launch = spawnCli(cli, ['open', '--project', copyDir], {timeoutMs: env.launchTimeoutMs(), log, label: 'open', children: ctx.children});
    ctx.opened.add(copyDir);
    log.step(`[${role}:${v}] settle ${env.settleMs()}ms (no Compile, no input)`);
    await sleep(env.settleMs());
  } else { await tailer.stop(0); return blocked(`unknown QF_FIRST_OPEN_MODE ${mode}`); }

  if (env.screencapture() && process.platform === 'darwin') {
    const r = cp.spawnSync('screencapture', ['-x', path.join(vdir, 'screen.png')]);
    R.steps.screencapture = r.status === 0 ? 'screen.png' : `failed ${r.status}`;
  }

  // 5. close ONLY this copy, drain own CLI, stop tailer — before anything is classified or hashed
  if (mp) { try { mp.disconnect(); } catch {} }
  R.steps.cliClose = (await closeOwn(ctx, copyDir)).summary();
  await Promise.race([launch.closed, raceTimer(env.cliDrainMs())]);
  if (!launch.exited) await launch.terminate(log);
  await launch.closed;
  R.steps.cliLaunch = launch.summary();
  await tailer.stop(env.logSettleMs());

  fs.writeFileSync(path.join(vdir, 'weapplog-tail.txt'), tailer.lines.map((d) => `${d.file}\t${d.stored}`).join('\n') + '\n');
  fs.writeFileSync(path.join(vdir, 'weapplog-events.json'), JSON.stringify({root: tailer.root, rootExistedAtStart: tailer.rootExistedAtStart, rootSeen: tailer.rootSeen, bytes: tailer.bytes, incomplete: tailer.incomplete, events: tailer.events}, null, 2));
  fs.writeFileSync(path.join(vdir, 'cli-output.json'), JSON.stringify({launch: R.steps.cliLaunch, close: R.steps.cliClose}, null, 2));
  fs.writeFileSync(path.join(vdir, 'automator-console.json'), JSON.stringify(consoleMsgs, null, 2));
  fs.writeFileSync(path.join(vdir, 'automator-exceptions.json'), JSON.stringify(exceptions, null, 2));
  if (R.shim !== undefined) fs.writeFileSync(path.join(vdir, 'shim-buffer.json'), JSON.stringify(R.shim, null, 2));

  // 6. classify (v4). Every piece of evidence becomes ONE normalised event {source, own, level, payload} and goes through
  //    rules.classifyEvent — the same rule set for automator, shim, WeappLog and CLI. Nothing is pre-filtered by pattern.
  const noticeAllowed = allowAppJsonNotice();
  const argText = (args) => (Array.isArray(args) ? args : [args]).map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const lvl = (t) => { const x = String(t || 'unknown').toLowerCase(); return x === 'warning' ? 'warn' : x; };
  const events = [];
  for (const m of consoleMsgs) events.push({source: 'automator.console.' + lvl(m.type), own: true, level: lvl(m.type), payload: argText(m.args)});
  for (const e of exceptions) events.push({source: 'automator.exception', own: true, level: 'error', payload: `${e.message}\n${e.stack || ''}`});
  if (R.shim) {
    for (const e of R.shim.errors || []) events.push({source: 'shim.console.error', own: true, level: 'error', payload: e.msg});
    for (const e of R.shim.warns || []) events.push({source: 'shim.console.warn', own: true, level: 'warn', payload: e.msg});
    for (const e of R.shim.logs || []) events.push({source: 'shim.console.' + lvl(e.level || 'log'), own: true, level: lvl(e.level || 'log'), payload: e.msg});
    for (const e of R.shim.onError || []) events.push({source: 'shim.wx.onError', own: true, level: 'error', payload: `${e.msg}\n${e.stack || ''}`});
    for (const e of R.shim.unhandled || []) events.push({source: 'shim.wx.onUnhandledRejection', own: true, level: 'error', payload: e.msg});
  }
  let ownLogLines = 0;
  for (const d of tailer.lines) {
    const pl = rules.parseLogLine(d.line, [copyDir, name]);
    const own = pl.own || d.line.includes(token);
    if (own) ownLogLines++;
    events.push({source: 'weapplog', own, level: pl.level, payload: pl.payload, prefix: pl.prefix, raw: d.stored});
  }
  for (const l of [...R.steps.cliLaunch.lines, ...R.steps.cliClose.lines]) events.push({source: 'cli.' + (l.stream === 'runner' ? 'runner' : l.stream), own: true, level: 'unknown', payload: l.line});

  const canary = {shimBoot: 0, shimLate: 0, automatorLate: 0, weappBoot: 0, weappLate: 0};
  for (const ev of events) {
    const c = rules.classifyEvent({level: ev.level, payload: ev.payload, token});
    ev.kind = c.kind; ev.id = c.id || null;
    const rec = {source: ev.source, level: ev.level, id: ev.id, text: String(ev.raw || ev.payload).slice(0, 2000)};
    if (c.kind === 'canary-boot' || c.kind === 'canary-late') {
      const late = c.kind === 'canary-late';
      if (ev.source === 'shim.console.error') canary[late ? 'shimLate' : 'shimBoot']++;
      else if (ev.source === 'automator.console.error' && late) canary.automatorLate++;
      else if (ev.source === 'weapplog' && ev.own) canary[late ? 'weappLate' : 'weappBoot']++;
      continue; // ONLY the exact canary event is exempt
    }
    if (c.kind === 'canary-foreign') { R.unattributed.push({...rec, kind: 'foreign-audit-canary'}); continue; }
    if (c.kind === 'known-notice') {
      if (ev.own) R.knownNotice.push(rec);
      else if (noticeAllowed) R.knownNoticeUnattributed.push(rec);
      else R.unattributed.push({...rec, kind: 'known-ide-notice'});
      continue;
    }
    if (c.kind === 'error') { if (ev.own) R.errors.push(rec); else R.unattributed.push({...rec, kind: 'error'}); continue; }
    if (c.kind === 'warn' && ev.own) R.warnings.push(rec);
  }
  fs.writeFileSync(path.join(vdir, 'events-classified.json'), JSON.stringify(events.map((e) => ({source: e.source, own: e.own, level: e.level, kind: e.kind, id: e.id, payload: String(e.payload).slice(0, 2000)})), null, 2));

  const infoTexts = events.filter((e) => e.own && e.kind === 'info' && !e.source.startsWith('cli.')).map((e) => e.payload);
  R.loadSceneSeen = infoTexts.some((tx) => rules.classifyText(tx).id === 'loadscene');
  R.unclassifiedInfo = [...new Set(infoTexts.filter((tx) => rules.classifyText(tx).kind === 'unclassified'))].slice(0, 50);
  fs.writeFileSync(path.join(vdir, 'console-transcript.txt'), [
    ...consoleMsgs.map((m) => `${m.t} automator.${m.type}\t${argText(m.args)}`),
    ...exceptions.map((e) => `${e.t} automator.exception\t${e.message}`),
    ...(R.shim ? ['errors', 'warns', 'logs', 'onError', 'unhandled'].flatMap((k) => (R.shim[k] || []).map((x) => `${new Date(x.t).toISOString()} shim.${k}\t${x.msg}`)) : []),
    ...tailer.lines.map((d) => `weapplog${d.line.includes(copyDir) || d.line.includes(name) || d.line.includes(token) ? '(own)' : '(unattributed)'}\t${d.stored}`),
  ].join('\n') + '\n');
  const heartbeatLate = consoleMsgs.some((m) => rules.normalize(argText(m.args)) === `[QF-AUDIT-HEARTBEAT-LATE] ${token}`);
  R.channels = {
    automatorConsole: {enabled: mode === 'auto', connected: !!mp, messages: consoleMsgs.length, lateHeartbeat: heartbeatLate, lateCanary: canary.automatorLate > 0},
    automatorException: {enabled: mode === 'auto', events: exceptions.length},
    shim: R.shim ? {readable: R.shim.token === token, bootCanaryRecord: canary.shimBoot > 0, lateCanaryRecord: canary.shimLate > 0, reportedCanaryAtBoot: R.shim.canaryAtBoot === true, wrapped: R.shim.wrapped, stillWrapped: R.shim.stillWrapped, onErrorRegistered: R.shim.onErrorRegistered, onUnhandledRejectionRegistered: R.shim.onUnhandledRejectionRegistered, dropped: R.shim.dropped, installErrors: R.shim.installErrors} : {readable: false, injected: !!R.steps.shimInjected, readError: R.steps.shimReadError || null},
    weappLog: {root: tailer.root, protocol: 'append-only UTF-8 text lines (README §4)', rootExistedAtStart: tailer.rootExistedAtStart, rootSeen: tailer.rootSeen, files: tailer.files.size, lines: tailer.lines.length, ownLines: ownLogLines, ownBootCanary: canary.weappBoot > 0, ownLateCanary: canary.weappLate > 0, bytes: tailer.bytes, incomplete: tailer.incomplete},
    cli: {launchOk: launch.ok(), launch: {code: launch.code, signal: launch.signal, error: launch.error, timedOut: launch.timedOut, terminated: launch.terminated, lines: launch.lines.length}, closeOk: R.steps.cliClose.code === 0 && !R.steps.cliClose.timedOut && !R.steps.cliClose.error},
  };

  // 7. evidence requirements (any missing → BLOCKED unless an own error already FAILs)
  const need = (cond, why) => { if (!cond) R.missing.push(why); };
  need(mode === 'auto', 'open mode has no in-game console channel; cannot assert 0 console errors');
  need(!!mp, `automator connect to ws://127.0.0.1:${port} failed: ${R.steps.connectError || ''}`);
  need(R.channels.cli.launchOk, `own cli ${mode} did not finish cleanly (code=${launch.code}, signal=${launch.signal}, error=${launch.error}, timedOut=${launch.timedOut}, terminatedAfterDrain=${launch.terminated})`);
  need(R.channels.cli.closeOk, `cli close --project <own copy> not confirmed (code=${R.steps.cliClose.code}${R.steps.cliClose.error ? ', ' + R.steps.cliClose.error : ''})`);
  if (mp) {
    need(heartbeatLate, 'automator console: exact late heartbeat not received');
    need(canary.automatorLate > 0, 'automator console: exact LATE canary (console.error) not received');
    need(R.steps.shimInjected, 'shim not injected (QF_FIRST_OPEN_INJECT_SHIM=0) — boot-phase errors uncovered');
    if (R.steps.shimInjected) {
      const s = R.channels.shim;
      need(s.readable, 'shim buffer not readable via evaluate');
      if (s.readable) {
        need(s.bootCanaryRecord, 'shim: exact BOOT canary record missing (a LATE canary cannot stand in for it)');
        need(s.reportedCanaryAtBoot, 'shim: canaryAtBoot flag is not true');
        need(s.lateCanaryRecord, 'shim: exact LATE canary record missing');
        need(['error', 'warn', 'log'].every((k) => (s.stillWrapped || []).includes(k)), `shim console wrappers not all installed/still installed (stillWrapped=${(s.stillWrapped || []).join(',')})`);
        need(s.onErrorRegistered && s.onUnhandledRejectionRegistered, 'shim wx.onError / onUnhandledRejection not registered');
        need(!(s.installErrors || []).length, `shim install errors: ${(s.installErrors || []).join('; ')}`);
        need(!s.dropped, `shim buffer overflow: ${s.dropped} message(s) dropped`);
        need(R.loadSceneSeen, 'required startup line "LoadScene db://assets/scenes/WorldR5Integration.scene" not observed — game start not proven');
      }
    }
  }
  need(!!tailer.root, 'QF_DEVTOOLS_LOG_DIR not set and no default for this OS — WeappLog channel missing');
  if (tailer.root) {
    need(tailer.rootSeen, `WeappLog root never appeared: ${tailer.root}`);
    need(!tailer.incomplete.length, `WeappLog capture incomplete / protocol violated: ${tailer.incomplete.slice(0, 3).join('; ')}${tailer.incomplete.length > 3 ? ' …' : ''}`);
    need(canary.weappBoot > 0, 'WeappLog did not show this case\'s exact own BOOT canary — log channel not proven for this project from boot (other windows\' lines cannot prove it)');
  }
  need(!R.unattributed.length, `${R.unattributed.length} finding(s) not attributable to this project (${[...new Set(R.unattributed.map((u) => u.source + ':' + u.kind))].join(', ')})`);

  if (R.errors.length) { R.status = 'FAIL'; R.reason = `${R.errors.length} own error(s): ` + [...new Set(R.errors.map((e) => e.source))].join(', '); }
  else if (R.knownNotice.length && !noticeAllowed) { R.status = 'FAIL'; R.reason = `known IDE notice "[app.json 或自定义编译条件错误] …启动页面" in this project (${[...new Set(R.knownNotice.map((e) => e.source))].join(', ')}); forbidden unless QF_FIRST_OPEN_ALLOW_APPJSON_NOTICE=1`; }
  else if (R.missing.length) { R.status = 'BLOCKED'; R.reason = R.missing.join(' | '); }
  else if (R.knownNotice.length || R.knownNoticeUnattributed.length) { R.status = 'PASS_WITH_ALLOWLISTED_IDE_NOTICE'; R.reason = `only events whose WHOLE normalised payload is the exact allowlisted app.json IDE notice (${R.knownNotice.length} own, ${R.knownNoticeUnattributed.length} not attributable); every other event classified: 0 errors; boot+late canaries proven; LoadScene seen`; }
  else { R.status = 'PASS'; R.reason = '0 errors (every event classified by one rule set), no app.json notice; boot canary (shim+WeappLog) and late canary (automator+shim) proven; own CLI exited 0; own window closed; LoadScene seen'; }
  log.step(`[${role}:${v}] ${R.status}: ${R.reason}`);
  if (!env.keepCopies()) { fs.rmSync(copyDir, {recursive: true, force: true}); R.steps.copyDeleted = true; }
  return R;
}

async function closeOwn(ctx, copyDir) {
  const h = await runCli(ctx.cli, ['close', '--project', copyDir], {timeoutMs: 30000, log: ctx.log, label: 'close', children: ctx.children});
  if (h.ok()) ctx.opened.delete(copyDir);
  return h;
}

function writeManifest(outDir) {
  const files = walkFiles(outDir).filter((r) => r !== 'SHA256SUMS.txt' && r !== 'manifest.json').sort();
  const entries = files.map((r) => ({path: r.split(path.sep).join('/'), bytes: fs.statSync(path.join(outDir, r)).size, sha256: sha256File(path.join(outDir, r))}));
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({generatedAt: new Date().toISOString(), frozen: 'after all own CLI children exited, log tailers stopped and run.log closed', files: entries}, null, 2));
  const sums = entries.concat([{path: 'manifest.json', sha256: sha256File(path.join(outDir, 'manifest.json'))}]);
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), sums.map((e) => `${e.sha256}  ${e.path}`).join('\n') + '\n');
}
function verifyManifest(outDir) {
  const listed = fs.readFileSync(path.join(outDir, 'SHA256SUMS.txt'), 'utf8').trim().split('\n').map((l) => { const i = l.indexOf('  '); return {sha: l.slice(0, i), p: l.slice(i + 2)}; });
  const bad = listed.filter((e) => !fs.existsSync(path.join(outDir, e.p)) || sha256File(path.join(outDir, e.p)) !== e.sha).map((e) => e.p);
  const extra = walkFiles(outDir).map((r) => r.split(path.sep).join('/')).filter((r) => r !== 'SHA256SUMS.txt' && !listed.some((e) => e.p === r));
  return {ok: !bad.length && !extra.length, mismatched: bad, unlisted: extra, files: listed.length};
}

async function main() {
  const runId = utcStampMs() + '-' + crypto.randomBytes(2).toString('hex');
  const outDir = path.resolve(env.outRoot() || path.join(process.cwd(), 'output', 'first-open-0008', runId));
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) { console.error(`refusing non-empty evidence dir ${outDir} (old evidence would mix in)`); console.log(JSON.stringify({status: 'BLOCKED', reason: 'non-empty QF_FIRST_OPEN_OUT'})); process.exitCode = 2; return; }
  fs.mkdirSync(outDir, {recursive: true});
  const log = new RunLog(path.join(outDir, 'run.log'));
  const children = new Children();
  const verdict = {tool: 'wechat_first_open_audit.cjs', version: VERSION, runId, startedAt: new Date().toISOString(), host: {platform: process.platform, node: process.version},
    dryRun: !!process.env.QF_FIRST_OPEN_DRY_RUN, scope: process.env.QF_FIRST_OPEN_DRY_RUN ? 'DRY_RUN_FAKE_CLI — exercises the script only; NOT evidence of WeChat DevTools behaviour' : 'real run',
    status: null, reason: null, variants: []};
  let ctx = null;
  const finish = async (status, reason) => {
    // freeze: close any own copy still open, drain/terminate own CLI children, then stop logging
    if (ctx) for (const dir of [...ctx.opened]) { const h = await closeOwn(ctx, dir); if (!h.ok() && status === 'PASS') { status = 'BLOCKED'; reason += ` | close of ${dir} not confirmed`; } }
    const killed = await children.drainAll(env.cliDrainMs(), log);
    if (killed.length) { verdict.terminatedAtFreeze = killed; if (/^PASS/.test(status)) { status = 'BLOCKED'; reason += ` | own CLI still running at freeze: ${killed.join(',')}`; } }
    verdict.status = status; verdict.reason = reason; verdict.finishedAt = new Date().toISOString();
    log.step(`VERDICT ${status}: ${reason}`);
    log.close();
    verdict.ownChildrenRunningAtFreeze = children.running().length;
    fs.writeFileSync(path.join(outDir, 'verdict.json'), JSON.stringify(verdict, null, 2));
    writeManifest(outDir);
    const selfCheck = verifyManifest(outDir);
    process.exitCode = !selfCheck.ok ? 2 : status === 'PASS' ? 0 : status === 'FAIL' ? 1 : status === 'PASS_WITH_ALLOWLISTED_IDE_NOTICE' ? 3 : 2;
    console.log(JSON.stringify({status, reason, verdict: path.join(outDir, 'verdict.json'), sha256sums: path.join(outDir, 'SHA256SUMS.txt'), selfCheck, lateLogLines: log.late.length}));
  };
  try {
    if (env.quitFirstRequested()) return await finish('BLOCKED', 'QF_DEVTOOLS_QUIT_FIRST was removed in v3 (cloud review: no global quit); unset it — the audit only closes its own copies');
    if (env.ignoreRegexRequested()) return await finish('BLOCKED', 'QF_FIRST_OPEN_IGNORE_ERROR_REGEX was removed in v3; the only allowlist is QF_FIRST_OPEN_ALLOW_APPJSON_NOTICE (exact string)');
    const cli = env.cliPath(), buildDir = env.buildDir();
    const cases = String(process.env.QF_FIRST_OPEN_CASES || 'default').split(',').map((x) => x.trim()).filter(Boolean).map(normalizeVariant);
    if (cases[0] !== 'default') return await finish('BLOCKED', 'QF_FIRST_OPEN_CASES must start with "default" (the case that decides the verdict)');
    verdict.config = {cli, buildDir, workRoot: env.workRoot(), finalizer: finalizerPath(), cases, allowAppJsonNotice: allowAppJsonNotice(), mode: env.mode(), autoPort: env.autoPort(), settleMs: env.settleMs(), cliDrainMs: env.cliDrainMs(), injectShim: env.injectShim(), logDir: env.logDir() || null, logPollMs: env.logPollMs(), logMaxBytes: env.logMaxBytes(), automatorModule: env.automatorModule() || null, globalQuit: 'removed'};
    log.step('config', verdict.config);
    if (!cli || !fs.existsSync(cli)) return await finish('BLOCKED', `DevTools CLI not found: ${cli || '(no default on this OS)'} — set QF_WECHAT_CLI`);
    if (!buildDir || !fs.existsSync(path.join(buildDir, 'project.config.json')) || !fs.existsSync(path.join(buildDir, 'game.json'))) return await finish('BLOCKED', `QF_WECHAT_BUILD_DIR is not a wechatgame output (needs project.config.json + game.json): ${buildDir}`);
    const links = findSymlinks(buildDir);
    if (links.length) return await finish('BLOCKED', `build dir contains symlinks (not followed): ${links.slice(0, 5).join(', ')}`);
    ctx = {log, outDir, cli, runId, buildDir: path.resolve(buildDir), children, opened: new Set()};
    fs.copyFileSync(path.join(buildDir, 'project.config.json'), path.join(outDir, 'source-project.config.json'));
    verdict.sourceBuild = {projectConfigSha256: sha256File(path.join(buildDir, 'project.config.json')), gameJsonSha256: sha256File(path.join(buildDir, 'game.json')), fileCount: walkFiles(buildDir).length};
    const isl = await runCli(cli, ['islogin'], {timeoutMs: 60000, log, label: 'islogin', children});
    verdict.islogin = {code: isl.code, output: isl.lines.map((l) => l.line).join('\n').slice(0, 2000)};
    if (isl.code !== 0) log.step('WARN islogin non-zero exit (recorded, not fatal)');

    const tr = await auditVariant(ctx, 'default', env.autoPort(), 'verdict');
    verdict.variants.push(tr);
    for (let i = 1; i < cases.length; i++) verdict.variants.push(await auditVariant(ctx, cases[i], env.autoPort() + i, 'diagnostic'));
    verdict.diagnostics = verdict.variants.slice(1).map((d) => ({case: d.variant, status: d.status, knownNotice: d.knownNotice.length, errors: d.errors.length, reason: d.reason}));
    verdict.noticeSeenInDefault = tr.knownNotice.length > 0;
    return await finish(tr.status, `default: ${tr.reason}`);
  } catch (e) {
    log.step('runner exception', String(e && e.stack || e)); // JSON-encoded: one line
    return await finish('BLOCKED', 'runner exception: ' + (e && e.message || e));
  }
}

if (require.main === module) main();
module.exports = {STRONG_ERROR_PATTERNS, LogTailer, spawnCli, injectShim, normalizeVariant, verifyManifest, CASES};
