'use strict';
/**
 * Machine-specific settings for the test tools, from environment variables (E8).
 *   QF_PLAYWRIGHT_MODULE      path or name of the playwright package (default: 'playwright' via normal Node resolution,
 *                             then the global npm root). Old Mac value: /opt/homebrew/lib/node_modules/playwright
 *   QF_CHROMIUM_EXECUTABLE    browser binary. Unset = Playwright's own bundled Chromium (run `npx playwright install chromium`).
 *   QF_TYPESCRIPT_MODULE      typescript package/file. Default: normal resolution, then global npm root.
 *                             Old Mac value: <...>/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript
 *   QF_BABEL_NODE_MODULES     node_modules dir holding @babel/core + the transform plugins (compile_r4_compat.cjs).
 *                             Old Mac value: <...>/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules
 *                             Use the versions bundled with Creator 3.8.8 if output hashes must match the Mac run.
 *   QF_LEGACY_PROGRESSION_JS  old lighthouse minigame/shared/progression.js for test_legacy_journey_reader.cjs (no default).
 */
const path = require('path'), fs = require('fs'), cp = require('child_process');
function resolvePkg(envName, name) {
  if (process.env[envName]) return process.env[envName];
  try { return path.dirname(require.resolve(name + '/package.json')); } catch {}
  try { const g = cp.execSync('npm root -g', {encoding: 'utf8'}).trim(), p = path.join(g, name); if (fs.existsSync(p)) return p; } catch {}
  throw new Error(name + ' not found. npm i -g ' + name + ', or set ' + envName + '.');
}
function playwrightModuleId() {
  if (process.env.QF_PLAYWRIGHT_MODULE) return process.env.QF_PLAYWRIGHT_MODULE;
  try { return path.dirname(require.resolve('playwright/package.json')); } catch {}
  try { const g = cp.execSync('npm root -g', {encoding: 'utf8'}).trim(), p = path.join(g, 'playwright'); if (fs.existsSync(p)) return p; } catch {}
  throw new Error('Playwright not found. npm i -D playwright (or -g), or set QF_PLAYWRIGHT_MODULE.');
}
module.exports = {
  typescript: () => require(resolvePkg('QF_TYPESCRIPT_MODULE', 'typescript')),
  babelNodeModules: () => process.env.QF_BABEL_NODE_MODULES || path.dirname(path.dirname(resolvePkg('QF_BABEL_NODE_MODULES', '@babel/core'))),
  playwright: () => require(playwrightModuleId()),
  playwrightPackage: () => require(path.join(playwrightModuleId(), 'package.json')),
  /** undefined lets Playwright use its bundled browser. */
  chromiumExecutable: () => process.env.QF_CHROMIUM_EXECUTABLE || undefined,
  legacyProgressionPath: () => { const p = process.env.QF_LEGACY_PROGRESSION_JS; if (!p) throw new Error('Set QF_LEGACY_PROGRESSION_JS to the old progression.js (read-only fixture).'); return p; },
};
