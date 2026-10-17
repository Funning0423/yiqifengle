'use strict';
/**
 * 0008 — drop-in wrapper around Oi's tools/finalize_wechat_local.cjs (whose source GGbot does not have).
 *
 *   node tools/finalize_wechat_local_firstopen.cjs <exactly the same arguments you give finalize_wechat_local.cjs>
 *
 * 1. Runs the original finalizer unchanged with the same argv / env / cwd (path: QF_FINALIZE_WECHAT_LOCAL,
 *    default: finalize_wechat_local.cjs next to this file). Its exit code is propagated; on failure nothing else happens.
 * 2. Only if QF_FIRST_OPEN_CONDITION (or --first-open-condition=V, which is stripped before step 1) is B / B1 / B2,
 *    applies tools/wechat_first_open_condition.cjs to the output dir.
 *    Output dir = QF_WECHAT_OUTPUT_DIR, else --first-open-out=DIR, else the first positional argument that contains project.config.json.
 * Default (unset / A / off): step 2 is skipped → byte-identical to running the original finalizer = current behaviour.
 * Order matters: the original finalizer removes empty conditions, so the variant must be applied AFTER it.
 */
const path = require('path'), fs = require('fs'), cp = require('child_process');
const {applyFirstOpenCondition, normalizeVariant} = require('./wechat_first_open_condition.cjs');

const raw = process.argv.slice(2);
let variantFlag, outFlag;
const passArgs = raw.filter((a) => {
  if (a.startsWith('--first-open-condition=')) { variantFlag = a.split('=').slice(1).join('='); return false; }
  if (a.startsWith('--first-open-out=')) { outFlag = a.split('=').slice(1).join('='); return false; }
  return true;
});
const variant = normalizeVariant(variantFlag || process.env.QF_FIRST_OPEN_CONDITION || 'A');
const finalizer = path.resolve(process.env.QF_FINALIZE_WECHAT_LOCAL || path.join(__dirname, 'finalize_wechat_local.cjs'));
if (!fs.existsSync(finalizer)) { console.error(`original finalizer not found: ${finalizer} (set QF_FINALIZE_WECHAT_LOCAL)`); process.exit(2); }

const r = cp.spawnSync(process.execPath, [finalizer, ...passArgs], {stdio: 'inherit', env: process.env});
if (r.error) { console.error(r.error.message); process.exit(2); }
if (r.status !== 0) process.exit(r.status == null ? 1 : r.status);
if (variant === 'A') { console.error('[first-open-condition] off (A): finalizer output unchanged'); process.exit(0); }

const outDir = process.env.QF_WECHAT_OUTPUT_DIR || outFlag || passArgs.find((a) => !a.startsWith('-') && fs.existsSync(path.join(path.resolve(a), 'project.config.json')));
if (!outDir) { console.error('[first-open-condition] cannot determine output dir: set QF_WECHAT_OUTPUT_DIR or --first-open-out=DIR'); process.exit(3); }
try {
  const rep = applyFirstOpenCondition(outDir, variant, {logDir: process.env.QF_FIRST_OPEN_LOG_DIR, log: (s) => console.error(s)});
  console.error(`[first-open-condition] ${variant} applied to ${path.resolve(outDir)}; changed=${rep.changed}; log=${rep.logDir || '-'}`);
} catch (e) { console.error('FIRST_OPEN_CONDITION_ERROR: ' + e.message); process.exit(4); }
