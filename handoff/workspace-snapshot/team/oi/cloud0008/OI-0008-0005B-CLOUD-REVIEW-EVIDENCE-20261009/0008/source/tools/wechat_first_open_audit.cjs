'use strict';
/**
 * 0008 — WeChat DevTools first-open console audit (regression).
 *
 *   fresh wechatgame output ──copy──▶ <workRoot>/QFFirstOpen-<UTC>-<rand>-<variant>/   (unique dir + unique projectname every run)
 *        └─ apply variant (wechat_first_open_condition.cjs)  └─ optional audit shim in the COPY's game.js
 *   official CLI  `cli auto --project <copy> --auto-port <p>`  (opens + compiles by itself; NO manual Compile)
 *   miniprogram-automator connect ws://127.0.0.1:<p>  → console / exception events, evaluate shim buffer, screenshot
 *   + DevTools WeappLog delta scan + CLI output scan  → verdict.json (PASS / FAIL / BLOCKED) + manifest.json + SHA256SUMS.txt
 *
 * Positive control: by default variant A (known to show `[app.json 或自定义编译条件错误]` in R6) is run after the target.
 * The target can only PASS if the detector saw the control's error; otherwise BLOCKED (detector not proven).
 *
 * Settings: tools/qf-wechat-env.cjs.  Exit code: 0 PASS, 1 FAIL, 2 BLOCKED.
 * Never uploads, previews or publishes: only `islogin`, `quit`, `auto`, `open`, `close` CLI subcommands are used.
 */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const env = require('./qf-wechat-env.cjs');
const {applyFirstOpenCondition, normalizeVariant, isEmptyCondition} = require('./wechat_first_open_condition.cjs');

const STRONG_ERROR_PATTERNS = [
  /app\.json\s*或自定义编译条件错误/,
  /未定义自定义编译中指定的启动页面/,
  /simulator launch failed/i,
  /模拟器启动失败/,
  /game\.json\s*(文件内容错误|解析失败|error)/i,
  /编译(失败|错误)/,
];
const ALLOWED_CLI_SUBCOMMANDS = new Set(['islogin', 'quit', 'auto', 'open', 'close']);

const sha256File = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const utcStamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sleepUnref = (ms) => new Promise((r) => setTimeout(r, ms).unref());

class RunLog {
  constructor(file) { this.file = file; this.t0 = Date.now(); }
  step(msg, data) {
    const line = `${new Date().toISOString()} +${((Date.now() - this.t0) / 1000).toFixed(1)}s ${msg}` + (data !== undefined ? ' ' + JSON.stringify(data) : '');
    fs.appendFileSync(this.file, line + '\n');
    console.error(line);
  }
}

function walkFiles(root, out = [], rel = '') {
  for (const e of fs.readdirSync(path.join(root, rel), {withFileTypes: true})) {
    const r = rel ? path.join(rel, e.name) : e.name;
    if (e.isDirectory()) walkFiles(root, out, r); else if (e.isFile()) out.push(r);
  }
  return out;
}

function copyTree(src, dst) {
  if (fs.cpSync) { fs.cpSync(src, dst, {recursive: true, errorOnExist: true, force: false, dereference: true}); return; }
  fs.mkdirSync(dst, {recursive: true});
  for (const r of walkFiles(src)) { fs.mkdirSync(path.dirname(path.join(dst, r)), {recursive: true}); fs.copyFileSync(path.join(src, r), path.join(dst, r)); }
}

/** Run an allowed CLI subcommand; capture stdout/stderr with timestamps. */
function runCli(cli, args, {timeoutMs = 120000, log, label}) {
  if (!ALLOWED_CLI_SUBCOMMANDS.has(args[0])) throw new Error(`refusing CLI subcommand ${args[0]}`);
  return new Promise((resolve) => {
    const started = Date.now();
    const isBat = /\.bat$/i.test(cli);
    const child = isBat ? cp.spawn('cmd.exe', ['/c', cli, ...args], {windowsHide: true}) : cp.spawn(cli, args, {stdio: ['ignore', 'pipe', 'pipe']});
    const lines = [];
    const take = (stream) => (buf) => String(buf).split(/\r?\n/).filter((s) => s.trim()).forEach((s) => lines.push({t: new Date().toISOString(), stream, line: s}));
    child.stdout && child.stdout.on('data', take('stdout'));
    child.stderr && child.stderr.on('data', take('stderr'));
    let done = false;
    const timer = setTimeout(() => { if (!done) { lines.push({t: new Date().toISOString(), stream: 'runner', line: `TIMEOUT after ${timeoutMs}ms`}); try { child.kill(); } catch {} } }, timeoutMs);
    const finish = (code, err) => {
      if (done) return; done = true; clearTimeout(timer);
      const res = {label, args, code, error: err ? String(err.message || err) : null, ms: Date.now() - started, timedOut: lines.some((l) => l.stream === 'runner'), lines};
      log && log.step(`cli ${args[0]} exit=${code}${err ? ' error=' + res.error : ''} (${res.ms}ms)`);
      resolve(res);
    };
    child.on('error', (e) => finish(null, e));
    child.on('exit', (code) => setTimeout(() => finish(code), 50));
  });
}

/** Snapshot sizes of all *.log files below any WeappLog dir under root. */
function snapshotLogs(root) {
  const snap = new Map();
  if (!root || !fs.existsSync(root)) return {available: false, root, snap};
  const visit = (dir, depth, inWeapp) => {
    if (depth > 7) return;
    let ents; try { ents = fs.readdirSync(dir, {withFileTypes: true}); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p, depth + 1, inWeapp || e.name === 'WeappLog');
      else if (e.isFile() && inWeapp && /\.log$/i.test(e.name)) { try { snap.set(p, fs.statSync(p).size); } catch {} }
    }
  };
  visit(root, 0, false);
  return {available: true, root, snap};
}

/** Lines appended to WeappLog logs since the snapshot (new files read whole). Capped. */
function logDelta(before, after) {
  const out = [];
  for (const [file, size] of after.snap) {
    const start = before.snap.has(file) ? before.snap.get(file) : 0;
    if (size <= start) continue;
    const len = Math.min(size - start, 8 * 1024 * 1024);
    const fd = fs.openSync(file, 'r'); const buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, start); fs.closeSync(fd);
    buf.toString('utf8').split(/\r?\n/).forEach((line) => { if (line.trim()) out.push({file, line: line.slice(0, 4000)}); });
  }
  return out;
}

/** Prepend the shim, but keep a leading "use strict" directive (and comments before it) first so strictness is unchanged. */
function injectShim(src, shim) {
  const m = /^(\uFEFF?(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*)(['"]use strict['"];?)/.exec(src);
  if (m) return src.slice(0, m[0].length) + '\n' + shim + '\n' + src.slice(m[0].length);
  return shim + '\n' + src;
}

function classify(text, ignoreRe) {
  if (ignoreRe && ignoreRe.test(text)) return 'ignored';
  return 'error';
}

async function auditVariant(ctx, variant, port, role) {
  const {log, outDir, cli, runId} = ctx;
  const v = normalizeVariant(variant);
  const name = `QFFirstOpen-${runId}-${crypto.randomBytes(3).toString('hex')}-${v}`;
  const copyDir = path.join(env.workRoot(), name);
  const vdir = path.join(outDir, `${role}-${v}`);
  fs.mkdirSync(vdir, {recursive: true});
  const R = {role, variant: v, projectDir: copyDir, projectname: name, port, steps: {}, channels: {}, errors: [], ignored: [], warnings: [], status: null, reason: null};
  const blocked = (why) => { R.status = 'BLOCKED'; R.reason = why; log.step(`[${role}:${v}] BLOCKED ${why}`); return R; };

  // 1. unique copy
  log.step(`[${role}:${v}] copy build → ${copyDir}`);
  if (fs.existsSync(copyDir)) return blocked(`copy dir already exists: ${copyDir}`);
  fs.mkdirSync(path.dirname(copyDir), {recursive: true});
  copyTree(ctx.buildDir, copyDir);
  const pcFile = path.join(copyDir, 'project.config.json');
  // unique projectname (DevTools caches per project) — the ONLY extra field change, recorded
  const pcText = fs.readFileSync(pcFile, 'utf8');
  const pc = JSON.parse(pcText.replace(/^\uFEFF/, ''));
  R.steps.originalProjectname = pc.projectname;
  pc.projectname = name;
  // baseline = finalizer default (A): an EMPTY condition already present in the source build (e.g. a build finalized with B)
  // is removed on the copy, so control A is always "no condition" and every variant starts from the same baseline.
  if (pc.condition !== undefined) {
    if (!isEmptyCondition(pc.condition)) return blocked('source build has an ACTIVE compile condition; finalize_wechat_local.cjs should have rejected it');
    R.steps.sourceConditionRemovedOnCopy = pc.condition;
    delete pc.condition;
  }
  fs.writeFileSync(pcFile, JSON.stringify(pc, null, 2) + (/\n$/.test(pcText) ? '\n' : ''));
  if (fs.existsSync(path.join(copyDir, 'project.private.config.json'))) R.steps.privateConfigInBuild = true;

  // 2. variant
  const rep = applyFirstOpenCondition(copyDir, v, {logDir: path.join(vdir, 'condition-log'), log: (s) => log.step(`[${role}:${v}] ${s}`)});
  fs.writeFileSync(path.join(vdir, 'condition-report.json'), JSON.stringify(rep, null, 2));
  fs.copyFileSync(pcFile, path.join(vdir, 'project.config.json.as-opened'));
  const priv = path.join(copyDir, 'project.private.config.json');
  if (fs.existsSync(priv)) fs.copyFileSync(priv, path.join(vdir, 'project.private.config.json.as-opened'));

  // 3. shim
  const token = crypto.randomBytes(8).toString('hex');
  R.token = token;
  if (env.injectShim()) {
    const gameJs = path.join(copyDir, 'game.js');
    if (!fs.existsSync(gameJs)) return blocked('game.js missing in build output');
    const shim = fs.readFileSync(path.join(__dirname, 'first-open-audit-shim.js'), 'utf8').replace(/__QF_TOKEN__/g, token);
    fs.writeFileSync(gameJs, injectShim(fs.readFileSync(gameJs, 'utf8'), shim));
    R.steps.shimInjected = true;
    log.step(`[${role}:${v}] audit shim injected into COPY game.js (token ${token})`);
  } else R.steps.shimInjected = false;
  fs.writeFileSync(path.join(vdir, 'build-copy-SHA256SUMS.txt'), walkFiles(copyDir).sort().map((r) => `${sha256File(path.join(copyDir, r))}  ${r.split(path.sep).join('/')}`).join('\n') + '\n');

  // 4. clean IDE (opt-in)
  if (env.quitFirst()) { R.steps.quit = await runCli(cli, ['quit'], {timeoutMs: 60000, log, label: 'quit'}); await sleep(5000); }

  // 5. open with official CLI, no manual Compile
  const logsBefore = snapshotLogs(env.logDir());
  R.channels.weappLog = {available: logsBefore.available, root: logsBefore.root, filesAtStart: logsBefore.snap.size};
  const mode = env.mode();
  R.mode = mode;
  let mp = null; const consoleMsgs = []; const exceptions = [];
  if (mode === 'auto') {
    let automator;
    const modId = env.automatorModule();
    if (!modId) return blocked('miniprogram-automator not found (npm i -D miniprogram-automator@0.12.1, or set QF_MINIPROGRAM_AUTOMATOR_MODULE)');
    try { automator = require(modId); automator = automator.default || automator; } catch (e) { return blocked('cannot load miniprogram-automator: ' + e.message); }
    log.step(`[${role}:${v}] cli auto --project ${copyDir} --auto-port ${port}`);
    const launch = runCli(cli, ['auto', '--project', copyDir, '--auto-port', String(port)], {timeoutMs: env.launchTimeoutMs(), log, label: 'auto'});
    const deadline = Date.now() + env.launchTimeoutMs();
    let lastErr = null, cliRes = null;
    launch.then((r) => { cliRes = r; });
    while (Date.now() < deadline) {
      try {
        mp = await automator.connect({wsEndpoint: `ws://127.0.0.1:${port}`});
        break;
      } catch (e) { lastErr = e; }
      if (cliRes && cliRes.code !== 0 && cliRes.code !== null) break;
      await sleep(1000);
    }
    R.steps.cliAuto = await Promise.race([launch, sleepUnref(15000).then(() => ({label: 'auto', note: 'cli still running after connect; output so far not final'}))]);
    if (!mp) { R.steps.connectError = lastErr ? String(lastErr.message) : 'timeout'; return finishBlocked(ctx, R, vdir, `automator connect to ws://127.0.0.1:${port} failed: ${R.steps.connectError}`); }
    log.step(`[${role}:${v}] automator connected`);
    mp.on('console', (m) => consoleMsgs.push({t: new Date().toISOString(), type: m && m.type, args: m && m.args}));
    mp.on('exception', (e) => exceptions.push({t: new Date().toISOString(), message: e && e.message, stack: e && e.stack}));
    await sleep(500);
    // prove the console channel: ask the shim to log a late heartbeat now that App.enableLog is on
    if (R.steps.shimInjected) {
      try { R.steps.pingResult = await mp.evaluate(function () { var a = globalThis.__QF_FIRST_OPEN_AUDIT__; return a && a.ping ? a.ping() : null; }); }
      catch (e) { R.steps.pingError = String(e.message || e); }
    }
    log.step(`[${role}:${v}] settle ${env.settleMs()}ms (no Compile, no input)`);
    await sleep(env.settleMs());
    if (R.steps.shimInjected) {
      try {
        R.shim = await mp.evaluate(function () { var a = globalThis.__QF_FIRST_OPEN_AUDIT__; if (!a) return null; return {version: a.version, token: a.token, installedAt: a.installedAt, heartbeat: a.heartbeat, wrapped: a.wrapped, errors: a.errors, warns: a.warns, onError: a.onError, unhandled: a.unhandled}; });
      } catch (e) { R.steps.shimReadError = String(e.message || e); }
    }
    try { await mp.screenshot({path: path.join(vdir, 'simulator.png')}); R.steps.screenshot = 'simulator.png'; } catch (e) { R.steps.screenshotError = String(e.message || e); }
  } else if (mode === 'open') {
    log.step(`[${role}:${v}] cli open --project ${copyDir}`);
    R.steps.cliOpen = await runCli(cli, ['open', '--project', copyDir], {timeoutMs: env.launchTimeoutMs(), log, label: 'open'});
    log.step(`[${role}:${v}] settle ${env.settleMs()}ms (no Compile, no input)`);
    await sleep(env.settleMs());
  } else return blocked(`unknown QF_FIRST_OPEN_MODE ${mode}`);

  if (env.screencapture() && process.platform === 'darwin') {
    const f = path.join(vdir, 'screen.png');
    const r = cp.spawnSync('screencapture', ['-x', f]);
    R.steps.screencapture = r.status === 0 ? 'screen.png' : `failed ${r.status}`;
  }
  const logsAfter = snapshotLogs(env.logDir());
  const delta = logsBefore.available ? logDelta(logsBefore, logsAfter) : [];
  R.channels.weappLog.newLines = delta.length;
  fs.writeFileSync(path.join(vdir, 'weapplog-delta.txt'), delta.map((d) => `${d.file}\t${d.line}`).join('\n') + '\n');
  fs.writeFileSync(path.join(vdir, 'automator-console.json'), JSON.stringify(consoleMsgs, null, 2));
  fs.writeFileSync(path.join(vdir, 'automator-exceptions.json'), JSON.stringify(exceptions, null, 2));
  if (R.shim !== undefined) fs.writeFileSync(path.join(vdir, 'shim-buffer.json'), JSON.stringify(R.shim, null, 2));

  // 6. close this project window
  if (mp) { try { mp.disconnect(); } catch {} }
  R.steps.cliClose = await runCli(cli, ['close', '--project', copyDir], {timeoutMs: 30000, log, label: 'close'});

  // 7. classify
  const ign = env.ignoreErrorRegex();
  const add = (source, text) => { const k = classify(text, ign); (k === 'ignored' ? R.ignored : R.errors).push({source, text: String(text).slice(0, 2000)}); };
  const argText = (args) => (Array.isArray(args) ? args : [args]).map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  for (const m of consoleMsgs) { const tx = argText(m.args); if (m.type === 'error') add('automator.console.error', tx); else if (m.type === 'warn') R.warnings.push({source: 'automator.console.warn', text: tx.slice(0, 2000)}); else if (STRONG_ERROR_PATTERNS.some((re) => re.test(tx))) add('automator.console.' + m.type, tx); }
  for (const e of exceptions) add('automator.exception', `${e.message}\n${e.stack || ''}`);
  if (R.shim) {
    for (const e of R.shim.errors || []) add('shim.console.error', e.msg);
    for (const e of R.shim.onError || []) add('shim.wx.onError', `${e.msg}\n${e.stack || ''}`);
    for (const e of R.shim.unhandled || []) add('shim.wx.onUnhandledRejection', e.msg);
    for (const w of R.shim.warns || []) R.warnings.push({source: 'shim.console.warn', text: String(w.msg).slice(0, 2000)});
  }
  for (const d of delta) if (STRONG_ERROR_PATTERNS.some((re) => re.test(d.line))) add('weapplog', d.line);
  const cliLines = [].concat((R.steps.cliAuto && R.steps.cliAuto.lines) || [], (R.steps.cliOpen && R.steps.cliOpen.lines) || []);
  for (const l of cliLines) if (STRONG_ERROR_PATTERNS.some((re) => re.test(l.line))) add('cli.output', l.line);

  const heartbeatLate = consoleMsgs.some((m) => argText(m.args).includes(`[QF-AUDIT-HEARTBEAT-LATE] ${token}`));
  R.channels.automatorConsole = {enabled: mode === 'auto', messages: consoleMsgs.length, provenByLateHeartbeat: heartbeatLate};
  R.channels.automatorException = {enabled: mode === 'auto', events: exceptions.length};
  R.channels.shim = {injected: !!R.steps.shimInjected, readable: !!(R.shim && R.shim.token === token), heartbeatAtBoot: !!(R.shim && R.shim.heartbeat), wrapped: R.shim ? R.shim.wrapped : []};
  R.channels.cliOutput = {lines: cliLines.length};

  if (R.errors.length) { R.status = 'FAIL'; R.reason = `${R.errors.length} error(s): ` + [...new Set(R.errors.map((e) => e.source))].join(', '); }
  else if (mode !== 'auto') { R.status = 'BLOCKED'; R.reason = 'open mode has no in-game console channel; only WeappLog/CLI scanned — cannot assert 0 console errors'; }
  else if (!heartbeatLate) { R.status = 'BLOCKED'; R.reason = 'automator console channel not proven (late heartbeat not received)'; }
  else if (R.steps.shimInjected && !R.channels.shim.readable) { R.status = 'BLOCKED'; R.reason = 'shim buffer not readable via evaluate'; }
  else { R.status = 'PASS'; R.reason = '0 errors in automator console/exception, shim buffer, WeappLog delta and CLI output'; }
  log.step(`[${role}:${v}] ${R.status}: ${R.reason}`);
  if (!env.keepCopies()) { fs.rmSync(copyDir, {recursive: true, force: true}); R.steps.copyDeleted = true; }
  return R;
}

async function finishBlocked(ctx, R, vdir, why) {
  R.status = 'BLOCKED'; R.reason = why;
  ctx.log.step(`[${R.role}:${R.variant}] BLOCKED ${why}`);
  R.steps.cliClose = await runCli(ctx.cli, ['close', '--project', R.projectDir], {timeoutMs: 30000, log: ctx.log, label: 'close'});
  return R;
}

function writeManifest(outDir) {
  const files = walkFiles(outDir).filter((r) => r !== 'SHA256SUMS.txt' && r !== 'manifest.json').sort();
  const entries = files.map((r) => ({path: r.split(path.sep).join('/'), bytes: fs.statSync(path.join(outDir, r)).size, sha256: sha256File(path.join(outDir, r))}));
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({generatedAt: new Date().toISOString(), files: entries}, null, 2));
  const sums = entries.concat([{path: 'manifest.json', sha256: sha256File(path.join(outDir, 'manifest.json'))}]);
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), sums.map((e) => `${e.sha256}  ${e.path}`).join('\n') + '\n');
}

async function main() {
  const runId = utcStamp();
  const outDir = path.resolve(env.outRoot() || path.join(process.cwd(), 'output', 'first-open-0008', runId));
  fs.mkdirSync(outDir, {recursive: true});
  const log = new RunLog(path.join(outDir, 'run.log'));
  const verdict = {tool: 'wechat_first_open_audit.cjs', version: '0008-v1', runId, startedAt: new Date().toISOString(), host: {platform: process.platform, node: process.version},
    dryRun: !!process.env.QF_FIRST_OPEN_DRY_RUN, scope: process.env.QF_FIRST_OPEN_DRY_RUN ? 'DRY_RUN_FAKE_CLI — exercises the script only; NOT evidence of WeChat DevTools behaviour' : 'real run',
    status: null, reason: null, variants: []};
  const done = (status, reason) => {
    verdict.status = status; verdict.reason = reason; verdict.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, 'verdict.json'), JSON.stringify(verdict, null, 2));
    log.step(`VERDICT ${status}: ${reason}`);
    writeManifest(outDir);
    console.log(JSON.stringify({status, reason, verdict: path.join(outDir, 'verdict.json'), sha256sums: path.join(outDir, 'SHA256SUMS.txt')}));
    process.exitCode = status === 'PASS' ? 0 : status === 'FAIL' ? 1 : 2;
  };
  try {
    const cli = env.cliPath(), buildDir = env.buildDir();
    const target = normalizeVariant(env.variant());
    const controlRaw = env.control();
    const control = /^none$/i.test(controlRaw) ? null : normalizeVariant(controlRaw);
    verdict.config = {cli, buildDir, workRoot: env.workRoot(), target, control, mode: env.mode(), autoPort: env.autoPort(), settleMs: env.settleMs(), injectShim: env.injectShim(), quitFirst: env.quitFirst(), logDir: env.logDir() || null, automatorModule: env.automatorModule() || null};
    log.step('config', verdict.config);
    if (!cli || !fs.existsSync(cli)) return done('BLOCKED', `DevTools CLI not found: ${cli || '(no default on this OS)'} — set QF_WECHAT_CLI`);
    if (!buildDir || !fs.existsSync(path.join(buildDir, 'project.config.json')) || !fs.existsSync(path.join(buildDir, 'game.json'))) return done('BLOCKED', `QF_WECHAT_BUILD_DIR is not a wechatgame output (needs project.config.json + game.json): ${buildDir}`);
    if (control && control === target) return done('BLOCKED', 'control variant equals target variant');
    const ctx = {log, outDir, cli, runId, buildDir: path.resolve(buildDir)};
    fs.copyFileSync(path.join(buildDir, 'project.config.json'), path.join(outDir, 'source-project.config.json'));
    verdict.sourceBuild = {projectConfigSha256: sha256File(path.join(buildDir, 'project.config.json')), gameJsonSha256: sha256File(path.join(buildDir, 'game.json')), fileCount: walkFiles(buildDir).length};
    const isl = await runCli(cli, ['islogin'], {timeoutMs: 60000, log, label: 'islogin'});
    verdict.islogin = {code: isl.code, output: isl.lines.map((l) => l.line).join('\n').slice(0, 2000)};
    if (isl.code !== 0 && isl.code !== null) log.step('WARN islogin non-zero exit (recorded, not fatal)');

    const tr = await auditVariant(ctx, target, env.autoPort(), 'target');
    verdict.variants.push(tr);
    let cr = null;
    if (control) { cr = await auditVariant(ctx, control, env.autoPort() + 1, 'control'); verdict.variants.push(cr); }
    verdict.controlDetected = cr ? cr.status === 'FAIL' && cr.errors.some((e) => STRONG_ERROR_PATTERNS.slice(0, 2).some((re) => re.test(e.text))) : null;

    if (tr.status === 'FAIL') return done('FAIL', `target ${target}: ${tr.reason}`);
    if (tr.status === 'BLOCKED') return done('BLOCKED', `target ${target}: ${tr.reason}`);
    if (control && !verdict.controlDetected) return done('BLOCKED', `target ${target} showed 0 errors, but positive control ${control} did not surface the custom-condition error in any channel (control: ${cr.status} ${cr.reason}) — detector not proven, cannot claim 0 errors`);
    return done('PASS', `target ${target}: 0 console errors on first open without manual Compile` + (control ? `; positive control ${control} error detected (${[...new Set(cr.errors.map((e) => e.source))].join(', ')})` : '; NO positive control run (QF_FIRST_OPEN_CONTROL=none) — detector sensitivity unproven'));
  } catch (e) {
    log.step('runner exception ' + (e && e.stack || e));
    return done('BLOCKED', 'runner exception: ' + (e && e.message || e));
  }
}

if (require.main === module) main();
module.exports = {STRONG_ERROR_PATTERNS, snapshotLogs, logDelta, injectShim};
