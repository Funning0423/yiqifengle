'use strict';
/**
 * Machine-specific settings for the 0008 WeChat first-open audit, from environment variables (same style as qf-env.cjs).
 * Mac paths below are DEFAULTS only; every one can be overridden.
 *   QF_WECHAT_CLI                 DevTools CLI. Default macOS: /Applications/wechatwebdevtools.app/Contents/MacOS/cli
 *                                 Windows default: C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat  (no default on Linux)
 *   QF_WECHAT_BUILD_DIR           fresh Creator wechatgame output (after finalize_wechat_local.cjs). Required. Never modified.
 *   QF_FIRST_OPEN_WORK_ROOT       where unique per-run copies go. Default: <os tmpdir>/qf-first-open
 *   QF_FIRST_OPEN_OUT             evidence dir. Default: <cwd>/output/first-open-0008/<runId>
 *   QF_FIRST_OPEN_VARIANT         variant under test (A|B|B1|B2). Default B.
 *   QF_FIRST_OPEN_CONTROL         positive-control variant expected to show the custom-condition error. Default A; "none" skips.
 *   QF_FIRST_OPEN_MODE            auto (cli auto + miniprogram-automator, default) | open (cli open only; no console channel → never PASS)
 *   QF_AUTO_PORT                  first automation port. Default 9421 (+1 per variant). Must differ from the IDE HTTP/security port.
 *   QF_FIRST_OPEN_SETTLE_MS       wait after connect before reading results. Default 25000
 *   QF_FIRST_OPEN_LAUNCH_TIMEOUT_MS  cli auto + websocket connect timeout. Default 90000
 *   QF_FIRST_OPEN_INJECT_SHIM     1 (default) = inject audit shim into the COPY's game.js; 0 = pure copy
 *   QF_DEVTOOLS_QUIT_FIRST        1 = `cli quit` before each variant (closes ALL DevTools windows!). Default 0.
 *   QF_DEVTOOLS_LOG_DIR           DevTools user-data root scanned for WeappLog/*.log deltas.
 *                                 Default macOS: ~/Library/Application Support/微信开发者工具 ; Windows: %LOCALAPPDATA%\微信开发者工具\User Data
 *   QF_MINIPROGRAM_AUTOMATOR_MODULE  path/name of miniprogram-automator. Default: normal resolution, then global npm root.
 *   QF_FIRST_OPEN_IGNORE_ERROR_REGEX  optional regex; matching error texts are listed as ignored, not counted. Default: none.
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
const int = (name, d) => { const v = process.env[name]; if (v == null || v === '') return d; const n = Number(v); if (!Number.isFinite(n)) throw new Error(`${name} must be a number`); return n; };
const bool = (name, d) => { const v = process.env[name]; if (v == null || v === '') return d; return !/^(0|false|no|off)$/i.test(v); };

module.exports = {
  cliPath: () => process.env.QF_WECHAT_CLI || defaultCli(),
  buildDir: () => process.env.QF_WECHAT_BUILD_DIR,
  workRoot: () => process.env.QF_FIRST_OPEN_WORK_ROOT || path.join(os.tmpdir(), 'qf-first-open'),
  outRoot: () => process.env.QF_FIRST_OPEN_OUT,
  variant: () => process.env.QF_FIRST_OPEN_VARIANT || 'B',
  control: () => process.env.QF_FIRST_OPEN_CONTROL || 'A',
  mode: () => (process.env.QF_FIRST_OPEN_MODE || 'auto').toLowerCase(),
  autoPort: () => int('QF_AUTO_PORT', 9421),
  settleMs: () => int('QF_FIRST_OPEN_SETTLE_MS', 25000),
  launchTimeoutMs: () => int('QF_FIRST_OPEN_LAUNCH_TIMEOUT_MS', 90000),
  injectShim: () => bool('QF_FIRST_OPEN_INJECT_SHIM', true),
  quitFirst: () => bool('QF_DEVTOOLS_QUIT_FIRST', false),
  logDir: () => process.env.QF_DEVTOOLS_LOG_DIR || defaultLogDir(),
  automatorModule: resolveAutomator,
  ignoreErrorRegex: () => process.env.QF_FIRST_OPEN_IGNORE_ERROR_REGEX ? new RegExp(process.env.QF_FIRST_OPEN_IGNORE_ERROR_REGEX) : null,
  screencapture: () => bool('QF_FIRST_OPEN_SCREENCAPTURE', false),
  keepCopies: () => bool('QF_FIRST_OPEN_KEEP_COPIES', true),
};
