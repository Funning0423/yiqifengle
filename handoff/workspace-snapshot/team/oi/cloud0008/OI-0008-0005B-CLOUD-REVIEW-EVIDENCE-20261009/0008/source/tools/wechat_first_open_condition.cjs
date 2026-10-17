'use strict';
/**
 * 0008 — optional first-open compile-condition variant for a generated WeChat mini-game output (Creator 3.8.8 wechatgame).
 *
 * Default is OFF (variant A = do nothing = the current finalize_wechat_local.cjs behaviour).
 *
 * Variants (select with QF_FIRST_OPEN_CONDITION or --variant):
 *   A   no change. project.config.json is left exactly as the finalizer produced it (today: no `condition` key).
 *   B   project.config.json condition = { game:{current:-1,list:[]}, miniprogram:{current:-1,list:[]} }.
 *       This is EXACTLY the config Oi verified in R6 (first-open-b-project.config.json): enters home without manual Compile,
 *       no custom-condition error seen, but debugger panel blank (cause not established).
 *   B1  B, plus the same condition in project.private.config.json (created if missing; other private fields preserved).
 *       Hypothesis only: private config has higher priority than project.config.json (official doc), so a private
 *       condition written by DevTools cannot override B.
 *   B2  game-only: condition = { game:{current:-1,list:[]} }. Hypothesis only: compileType is "game", the miniprogram
 *       branch should be irrelevant; tests whether the extra miniprogram key matters for the debugger.
 *
 * Rules: idempotent (re-applying gives byte-identical files, no second backup); every other top-level field is preserved
 * in its original order; an existing condition is replaced only when it is EMPTY (every list empty — same policy as
 * finalize_wechat_local.cjs, which rejects active conditions); a non-empty (active) condition is refused (throws).
 * Backups and a JSON change log (sha256 before/after + unified diff) go to a SIBLING directory "<outDir>.first-open-condition/"
 * by default, so nothing extra is packed into the mini-game.
 *
 * CLI:  node tools/wechat_first_open_condition.cjs <wechatgame output dir> [--variant=B] [--log-dir=DIR] [--check]
 *   --check  dry run: report what would change, write nothing, exit 0.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const EMPTY = () => ({current: -1, list: []});
const VARIANTS = {
  A: {project: null, private: null, note: 'no change (default, current behaviour)'},
  B: {project: () => ({game: EMPTY(), miniprogram: EMPTY()}), private: null, note: 'Oi-verified R6 config: game+miniprogram current=-1 list=[] in project.config.json'},
  B1: {project: () => ({game: EMPTY(), miniprogram: EMPTY()}), private: () => ({game: EMPTY(), miniprogram: EMPTY()}), note: 'hypothesis: B in both project.config.json and project.private.config.json'},
  B2: {project: () => ({game: EMPTY()}), private: null, note: 'hypothesis: game-only condition current=-1 list=[]'},
};

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function normalizeVariant(v) {
  const s = String(v == null || v === '' ? 'A' : v).trim().toUpperCase();
  if (s === 'OFF' || s === '0' || s === 'NONE') return 'A';
  if (!VARIANTS[s]) throw new Error(`unknown first-open condition variant "${v}" (allowed: ${Object.keys(VARIANTS).join(', ')}, off)`);
  return s;
}

/** A condition is empty when it is an object whose every branch has an empty (or missing) list. Mirrors the finalizer's "completely empty". */
function isEmptyCondition(cond) {
  if (cond == null) return true;
  if (typeof cond !== 'object' || Array.isArray(cond)) return false;
  return Object.values(cond).every((b) => b && typeof b === 'object' && !Array.isArray(b) && (b.list == null || (Array.isArray(b.list) && b.list.length === 0)));
}

/** Set obj.condition = target keeping the key's original position (or appending). Returns new object. */
function withCondition(obj, target) {
  const out = {};
  let placed = false;
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'condition') { out.condition = target; placed = true; } else out[k] = v;
  }
  if (!placed) out.condition = target;
  return out;
}

/** JSON.stringify, optionally escaping non-ASCII as \uXXXX (Python json.dump ensure_ascii style) to keep the original file's style. */
function stringifyLike(obj, indent, asciiOnly) {
  const s = JSON.stringify(obj, null, indent);
  return asciiOnly ? s.replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) : s;
}

function detectIndent(text) {
  const m = /\n([ \t]+)"/.exec(text);
  return m ? m[1] : 2;
}

/** Minimal line-based unified diff (LCS), enough for config files of a few dozen lines. */
function unifiedDiff(a, b, nameA, nameB) {
  const A = a.split('\n'), B = b.split('\n');
  const n = A.length, m = B.length;
  const dp = Array.from({length: n + 1}, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push(' ' + A[i]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push('-' + A[i++]); else ops.push('+' + B[j++]);
  }
  while (i < n) ops.push('-' + A[i++]);
  while (j < m) ops.push('+' + B[j++]);
  if (!ops.some((o) => o[0] !== ' ')) return '';
  return [`--- ${nameA}`, `+++ ${nameB}`, `@@ -1,${n} +1,${m} @@`, ...ops].join('\n') + '\n';
}

function planFile(file, target, {createIfMissing}) {
  const exists = fs.existsSync(file);
  if (!exists && !createIfMissing) throw new Error(`${file} not found`);
  const beforeText = exists ? fs.readFileSync(file, 'utf8') : null;
  let obj = {};
  if (exists) {
    try { obj = JSON.parse(beforeText.replace(/^\uFEFF/, '')); } catch (e) { throw new Error(`${file}: invalid JSON (${e.message})`); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`${file}: top level is not an object`);
  }
  if (!isEmptyCondition(obj.condition)) {
    throw new Error(`${file}: existing condition is NOT empty (active custom compile condition); refusing to overwrite. ` + JSON.stringify(obj.condition));
  }
  const next = withCondition(obj, target);
  const indent = exists ? detectIndent(beforeText) : 2;
  const trailingNL = exists ? /\n$/.test(beforeText) : true;
  const asciiOnly = exists && /\\u[0-9a-fA-F]{4}/.test(beforeText) && !/[^\x00-\x7f]/.test(beforeText);
  let afterText = stringifyLike(next, indent, asciiOnly) + (trailingNL ? '\n' : '');
  const same = exists && JSON.stringify(obj) === JSON.stringify(next);
  if (same) afterText = beforeText; // idempotent: never reformat a file that already has the target
  const preservedKeys = Object.keys(obj).filter((k) => k !== 'condition');
  for (const k of preservedKeys) if (JSON.stringify(obj[k]) !== JSON.stringify(next[k])) throw new Error(`internal: field ${k} changed`);
  return {file, existed: exists, changed: !same, beforeText, afterText, preservedKeys,
    previousCondition: obj.condition === undefined ? '(absent)' : obj.condition, newCondition: target};
}

/**
 * Apply a variant to a wechatgame output directory.
 * @returns {object} report (also appended to <logDir>/first-open-condition.log.jsonl when anything is written)
 */
function applyFirstOpenCondition(outDir, variant, opts = {}) {
  const v = normalizeVariant(variant);
  const dir = path.resolve(outDir);
  const log = opts.log || (() => {});
  const check = !!opts.check;
  const report = {tool: 'wechat_first_open_condition.cjs', version: '0008-v1', time: new Date().toISOString(), outDir: dir, variant: v, note: VARIANTS[v].note, check, files: []};
  const projFile = path.join(dir, 'project.config.json');
  if (!fs.existsSync(projFile)) throw new Error(`${projFile} not found — is ${dir} a wechatgame build output?`);
  if (v === 'A') { log(`[first-open-condition] variant A: no change to ${projFile}`); report.changed = false; return report; }

  const plans = [planFile(projFile, VARIANTS[v].project(), {createIfMissing: false})];
  if (VARIANTS[v].private) plans.push(planFile(path.join(dir, 'project.private.config.json'), VARIANTS[v].private(), {createIfMissing: true}));
  const logDir = path.resolve(opts.logDir || (dir.replace(/[\\/]+$/, '') + '.first-open-condition'));
  report.logDir = logDir;
  for (const p of plans) {
    const rel = path.basename(p.file);
    const entry = {file: rel, existed: p.existed, changed: p.changed, preservedKeys: p.preservedKeys, previousCondition: p.previousCondition, newCondition: p.newCondition,
      sha256Before: p.existed ? sha256(Buffer.from(p.beforeText, 'utf8')) : null, sha256After: sha256(Buffer.from(p.afterText, 'utf8')),
      diff: p.changed ? unifiedDiff(p.beforeText || '', p.afterText, `a/${rel}`, `b/${rel}`) : ''};
    if (p.changed && !check) {
      fs.mkdirSync(logDir, {recursive: true});
      if (p.existed) {
        const bak = path.join(logDir, `${rel}.before-first-open.bak`);
        if (!fs.existsSync(bak)) fs.writeFileSync(bak, p.beforeText); // keep the very first original only
        entry.backup = bak;
      }
      const tmp = p.file + '.tmp-0008';
      fs.writeFileSync(tmp, p.afterText);
      fs.renameSync(tmp, p.file);
    }
    log(`[first-open-condition] ${v} ${rel}: ${p.changed ? (check ? 'WOULD CHANGE' : 'changed') : 'already target, untouched'}`);
    report.files.push(entry);
  }
  report.changed = report.files.some((f) => f.changed);
  if (report.changed && !check) fs.appendFileSync(path.join(logDir, 'first-open-condition.log.jsonl'), JSON.stringify(report) + '\n');
  return report;
}

module.exports = {applyFirstOpenCondition, normalizeVariant, isEmptyCondition, unifiedDiff, VARIANTS};

if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : undefined; };
  const pos = args.filter((a) => !a.startsWith('--'));
  if (!pos[0]) { console.error('usage: node wechat_first_open_condition.cjs <wechatgame output dir> [--variant=A|B|B1|B2] [--log-dir=DIR] [--check]'); process.exit(2); }
  try {
    const r = applyFirstOpenCondition(pos[0], flag('variant') || process.env.QF_FIRST_OPEN_CONDITION || 'A', {logDir: flag('log-dir'), check: args.includes('--check'), log: (s) => console.error(s)});
    console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.error('FIRST_OPEN_CONDITION_ERROR: ' + e.message); process.exit(1); }
}
