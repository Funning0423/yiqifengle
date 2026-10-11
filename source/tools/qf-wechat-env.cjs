'use strict';
/**
 * Machine-specific settings for the 0008 WeChat first-open audit, from environment variables (same style as qf-env.cjs).
 * Mac paths below are DEFAULTS only; every one can be overridden.
 *   QF_WECHAT_CLI                 DevTools CLI. Default macOS: /Applications/wechatwebdevtools.app/Contents/MacOS/cli
 *                                 Windows default: C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat  (no default on Linux)
 *   QF_WECHAT_BUILD_DIR           fresh Creator wechatgame output (after finalize_wechat_local.cjs). Required. Never modified.
 *   QF_FIRST_OPEN_WORK_ROOT       where unique per-run copies go. Default: <os tmpdir>/qf-first-open
 *   QF_FIRST_OPEN_OUT             evidence dir; must not exist or be EMPTY (v3 refuses reuse). Default: <cwd>/output/first-open-0008/<runId>
 *   QF_FIRST_OPEN_CASES           comma list, must start with "default" (decides the verdict). Optional diagnostic: diag-appid.
 *   QF_FIRST_OPEN_DIAG_APPID      AppID written into the COPY for case diag-appid only (e.g. a tourist/test AppID). Diagnostic, never a fix.
 *   QF_FINALIZER                  finalize_wechat_local.cjs (Oi 12ef697 + 0008-v2 diff, unchanged in v3) run on each copy. Default: next to the audit script.
 *   QF_FIRST_OPEN_ALLOW_APPJSON_NOTICE  1 = accept exactly the known app.json IDE notice → PASS_WITH_ALLOWLISTED_IDE_NOTICE (exit 3). Default 0.
 *   QF_FIRST_OPEN_MODE            auto (cli auto + miniprogram-automator, default) | open (cli open only; no console channel → never PASS)
 *   QF_AUTO_PORT                  first automation port. Default 9421 (+1 per case). Must differ from the IDE HTTP/security port.
 *   QF_FIRST_OPEN_SETTLE_MS       wait after connect before reading results. Default 25000
 *   QF_FIRST_OPEN_LAUNCH_TIMEOUT_MS  cli auto + websocket connect timeout. Default 90000
 *   QF_FIRST_OPEN_INJECT_SHIM     1 (default) = inject audit shim into the COPY's game.js; 0 = pure copy
 *   QF_DEVTOOLS_QUIT_FIRST        REMOVED in v3 (cloud review: no global quit). Setting it to a true value makes the run BLOCKED.
 *                                 The audit only ever runs `cli close --project <its own unique copy>`.
 *   QF_CLI_DRAIN_MS               after closing its own project, wait this long for its own `cli auto` process to exit. Default 30000.
 *                                 Still running → that CLI child (only it) is terminated and the case is BLOCKED (resident CLI).
 *   QF_WEAPPLOG_POLL_MS           WeappLog tail interval. Default 200.   QF_WEAPPLOG_SETTLE_MS  final quiet wait. Default 1500.
 *   QF_WEAPPLOG_MAX_BYTES         max WeappLog bytes read per case; exceeding it = incomplete → BLOCKED. Default 268435456 (256 MiB).
 *   QF_DEVTOOLS_LOG_DIR           DevTools user-data root (or a WeappLog dir itself) tailed for *.log below any WeappLog dir. REQUIRED channel for PASS.
 *                                 Default macOS: ~/Library/Application Support/微信开发者工具 ; Windows: %LOCALAPPDATA%\微信开发者工具\User Data
 *   QF_MINIPROGRAM_AUTOMATOR_MODULE  path/name of miniprogram-automator. Default: normal resolution, then global npm root.
 *   (QF_FIRST_OPEN_IGNORE_ERROR_REGEX removed in v3: the only allowlist is the exact app.json notice string.)
 *   QF_FIRST_OPEN_SCREENCAPTURE   1 = macOS `screencapture -x` of the whole screen after settle (shows debugger panel). Default 0.
 *   QF_FIRST_OPEN_KEEP_COPIES     1 (default) keep per-run copies for inspection; 0 delete after run.
 */
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');

function defaultCli() {
  if (process.platform === 'darwin') return '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
  if (process.platform === 'win32') return 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat';
  return undefined;
}
function defaultLogDir() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', '微信开发者工具');
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, '微信开发者工具', 'User Data');
  return undefined;
}
function resolveAutomator() {
  const id = process.env.QF_MINIPROGRAM_AUTOMATOR_MODULE;
  if (id) return id;
  try { return path.dirname(require.resolve('miniprogram-automator/package.json')); } catch {}
  try { const g = cp.execSync('npm root -g', {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(), p = path.join(g, 'miniprogram-automator'); if (fs.existsSync(p)) return p; } catch {}
  return undefined;
}
const int = (name, d, min = 0, max = Number.MAX_SAFE_INTEGER) => { const v = process.env[name]; if (v == null || v === '') return d; const n = Number(v); if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer in [${min}, ${max}] (got ${v})`); return n; };
const bool = (name, d) => { const v = process.env[name]; if (v == null || v === '') return d; return !/^(0|false|no|off)$/i.test(v); };

module.exports = {
  cliPath: () => process.env.QF_WECHAT_CLI || defaultCli(),
  buildDir: () => process.env.QF_WECHAT_BUILD_DIR,
  workRoot: () => process.env.QF_FIRST_OPEN_WORK_ROOT || path.join(os.tmpdir(), 'qf-first-open'),
  outRoot: () => process.env.QF_FIRST_OPEN_OUT,
  mode: () => (process.env.QF_FIRST_OPEN_MODE || 'auto').toLowerCase(),
  autoPort: () => int('QF_AUTO_PORT', 9421, 1024, 65535),
  settleMs: () => int('QF_FIRST_OPEN_SETTLE_MS', 25000, 0),
  launchTimeoutMs: () => int('QF_FIRST_OPEN_LAUNCH_TIMEOUT_MS', 90000, 1000),
  cliDrainMs: () => int('QF_CLI_DRAIN_MS', 30000, 0),
  logPollMs: () => int('QF_WEAPPLOG_POLL_MS', 200, 20, 5000),
  logSettleMs: () => int('QF_WEAPPLOG_SETTLE_MS', 1500, 0),
  logMaxBytes: () => int('QF_WEAPPLOG_MAX_BYTES', 256 * 1024 * 1024, 1024),
  injectShim: () => bool('QF_FIRST_OPEN_INJECT_SHIM', true),
  quitFirstRequested: () => bool('QF_DEVTOOLS_QUIT_FIRST', false), // only to refuse it
  logDir: () => process.env.QF_DEVTOOLS_LOG_DIR || defaultLogDir(),
  automatorModule: resolveAutomator,
  ignoreRegexRequested: () => !!process.env.QF_FIRST_OPEN_IGNORE_ERROR_REGEX, // only to refuse it
  screencapture: () => bool('QF_FIRST_OPEN_SCREENCAPTURE', false),
  keepCopies: () => bool('QF_FIRST_OPEN_KEEP_COPIES', true),
};
