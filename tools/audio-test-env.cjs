'use strict';
/**
 * Shared resolution + SKIP helpers for tools/test_audio_*.cjs (Voice bot).
 * A SKIP prints one line starting with "SKIP <test>: <reason>" and exits 0, so a missing
 * machine dependency is visible but is never reported as a game failure.
 *
 *   QF_TYPESCRIPT_MODULE   typescript package dir/file. Else: normal Node resolution / global npm
 *                          (tools/qf-env.cjs), then known box locations below. Else SKIP.
 *   QF_AUDIO_UI_EVIDENCE   folder holding upstream-v3.8.8/ Cocos sources (default evidence/audio-ui-capture).
 *   QF_PLAYWRIGHT_MODULE   see tools/qf-env.cjs. Missing Playwright = SKIP.
 */
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const testName = () => path.basename(require.main ? require.main.filename : process.argv[1] || 'test');

function skip(reason) {
  console.log(`SKIP ${testName()}: ${reason}`);
  process.exit(0);
}

const TS_CANDIDATES = [
  path.join(ROOT, 'tools/vendor-node/node_modules/typescript'),
  path.resolve(ROOT, '../GGbot/tools/vendor-node/node_modules/typescript'),
  '/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules/typescript',
  '/tmp/gb-t0-tools/node_modules/typescript',
];
let tsCache = null;
/** Returns the typescript module or SKIPs (exit 0) with the list of places tried. */
function typescript() {
  if (tsCache) return tsCache;
  const tried = [];
  const env = process.env.QF_TYPESCRIPT_MODULE;
  if (env) {
    try { return (tsCache = require(env)); } catch (e) { tried.push(`QF_TYPESCRIPT_MODULE=${env} (${e.code || e.message})`); }
  }
  try { return (tsCache = require('./qf-env.cjs').typescript()); } catch { tried.push('node resolution / npm root -g'); }
  for (const p of TS_CANDIDATES) {
    if (!fs.existsSync(p)) { tried.push(p); continue; }
    try { return (tsCache = require(p)); } catch (e) { tried.push(`${p} (${e.code || e.message})`); }
  }
  skip('typescript not found; set QF_TYPESCRIPT_MODULE. Tried: ' + tried.join('; '));
}

/** TS -> JS for vm execution. Prefers node:module stripTypeScriptTypes (Node >= 22.13), else typescript. */
function transpile(source) {
  const {stripTypeScriptTypes} = require('node:module');
  if (stripTypeScriptTypes) return stripTypeScriptTypes(source, {mode: 'transform'});
  const ts = typescript();
  return ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, useDefineForClassFields: true}}).outputText;
}

/** Folder with the unedited Cocos 3.8.8 upstream sources used as engine-method evidence. */
function audioUiEvidence(required) {
  const dir = path.resolve(ROOT, process.env.QF_AUDIO_UI_EVIDENCE || 'evidence/audio-ui-capture');
  const missing = required.filter(f => !fs.existsSync(path.join(dir, f)));
  if (missing.length) skip(`evidence folder missing (${path.relative(ROOT, dir) || dir}: ${missing.join(', ')}). `
    + 'It holds unedited Cocos v3.8.8 engine sources and is not in the repo; set QF_AUDIO_UI_EVIDENCE to a copy, or run tools/fetch_audio_ui_upstream.sh to re-create it.');
  return dir;
}

function playwright() {
  try { return require('./qf-env.cjs').playwright(); }
  catch (e) { skip('Playwright not installed (' + String(e.message).split('\n')[0] + ')'); }
}

/** Write a JSON report only when its folder already exists (never creates untracked evidence dirs). */
function writeReport(rel, data) {
  const file = path.resolve(ROOT, rel);
  if (fs.existsSync(path.dirname(file))) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); return true; }
  return false;
}

module.exports = {ROOT, skip, typescript, transpile, audioUiEvidence, playwright, writeReport};
