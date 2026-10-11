'use strict';
// Independent disposable browser context. No user profile, credentials or external pages.
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('./qf-env.cjs').playwright();
const base = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({headless: true,
    executablePath: require('./qf-env.cjs').chromiumExecutable()});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const messages = [], errors = [];
    page.on('console', message => messages.push({type: message.type(), text: message.text()}));
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto('http://127.0.0.1:8765/', {waitUntil: 'networkidle', timeout: 30000});
    await page.waitForFunction(() => globalThis.__forestLiveSnapshot?.state === 'run.resolving', null, {timeout: 10000});
    await page.screenshot({path: path.join(base, 'output/playwright/cocos-r4-action.png')});
    await page.waitForFunction(() => globalThis.__forestSceneSmoke || globalThis.__smokeErrors?.length, null, {timeout: 30000}).catch(e => errors.push(String(e)));
    await page.waitForFunction(() => globalThis.__forestFullRun?.status === 'PASS', null, {timeout: 30000}).catch(e => errors.push(String(e)));
    await page.waitForTimeout(600);
    const result = await page.evaluate(() => ({r4: globalThis.__forestR4Smoke || null, scene: globalThis.__forestSceneSmoke || null, fullRun: globalThis.__forestFullRun || null,
      reporterErrors: globalThis.__smokeErrors || [], live: globalThis.__forestLiveSnapshot || null, frames: globalThis.__forestExportFrames?.() || null, renderer: document.querySelector('canvas')?.getContext('webgl2')?.getParameter(7937) || null}));
    const output = path.join(base, 'output/playwright'); fs.mkdirSync(output, {recursive: true});
    await page.screenshot({path: path.join(output, 'cocos-firstslice-chromium.png')});
    const report = {scope: 'Mac desktop Cocos debug fixture; not phone acceptance', browser: browser.version(),
      driver: require('./qf-env.cjs').playwrightPackage().version, result, errors, messages};
    fs.writeFileSync(path.join(base, 'evidence/cocos-chromium-runtime.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({browser: report.browser, r4: result.r4, scene: result.scene, errors}));
    if (!result.r4 || !result.scene || errors.length || result.reporterErrors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
