'use strict';
// Phone-portrait shots of the live meadow and sky-city boards on the debug web build.
// Serves nothing itself. Point TASK21_REGIONS_URL at 127.0.0.1:8783.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../qf-env.cjs').playwright();

const ROOT = path.resolve(__dirname, '../..');
const BASE = process.env.TASK21_REGIONS_URL || 'http://127.0.0.1:8783/';
const OUT = path.join(ROOT, 'evidence/task21-regions');
const CHROME = process.env.QF_CHROME_FOR_TESTING || path.join(process.env.HOME, 'Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const VIEWPORT = { width: 402, height: 874 };

function sha256(file) {
  return require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 500)); });
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => {
      try { const s = __worldIntegration.snapshot(); return s.state === 'home' && s.characterReady !== false; } catch { return false; }
    }, {}, { timeout: 180000 });
    const meadow = await captureStage(page, 8, 'meadow-board.png');
    await exitToIsland(page);
    const sky = await captureStage(page, 12, 'skycity-board.png');
    const report = {
      url: BASE,
      viewport: VIEWPORT,
      chrome: CHROME,
      meadow,
      skycity: sky,
      pageErrors: errors.slice(0, 40),
      phoneAcceptance: false,
      wechatAcceptance: false,
    };
    const reportPath = path.join(OUT, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({
      report: path.relative(ROOT, reportPath),
      meadow: meadow.shot,
      skycity: sky.shot,
      meadowRegion: meadow.background?.rendering?.region,
      skyRegion: sky.background?.rendering?.region,
    }, null, 2));
    if (meadow.background?.rendering?.region !== 'meadow' || sky.background?.rendering?.region !== 'skycity') process.exitCode = 1;
  } finally {
    await browser.close();
  }
}


async function hideFlowTestBanner(page) {
  await page.evaluate(async () => {
    const { director, Director, Label } = await System.import('cc');
    if (globalThis.__hideFlowTestBanner) return;
    const hide = () => {
      const scene = director.getScene();
      if (!scene) return;
      const mark = scene.getComponentsInChildren(Label).find((label) => {
        const text = String(label.string);
        return text.includes('独立测试') || text.includes('测试包');
      });
      const plate = mark && mark.node.parent;
      if (plate && plate.isValid) plate.active = false;
    };
    director.on(Director.EVENT_BEFORE_DRAW, hide);
    globalThis.__hideFlowTestBanner = true;
    hide();
  });
}

async function captureStage(page, checkpoint, fileName) {
  await tapNav(page, 'flowTests');
  await page.waitForTimeout(400);
  await tapNav(page, 'flowTest' + checkpoint);
  const stageId = 'mainline-' + String(checkpoint).padStart(2, '0');
  await waitLevel(page, stageId);
  await resumeBoard(page);
  await page.waitForFunction((id) => {
    const b = __worldIntegration.board();
    const r = b?.background?.rendering;
    return b?.snapshot?.active?.stageId === id && b.background?.state === 'ready' && r?.renderer === 'region-live-3d' && r.region && r.visible === true;
  }, stageId, { timeout: 20000 });
  if (checkpoint === 12) await hideFlowTestBanner(page);
  await page.waitForTimeout(1200);
  const background = await page.evaluate(() => __worldIntegration.board()?.background || null);
  const shot = path.join(OUT, fileName);
  await page.screenshot({ path: shot, scale: 'css' });
  return { stageId, background, shot: path.relative(ROOT, shot), sha256: sha256(shot) };
}

async function waitLevel(page, stageId) {
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < 150000) {
    const s = await page.evaluate((id) => {
      const w = __worldIntegration.snapshot();
      const b = __worldIntegration.board();
      return {
        world: w.state,
        err: __worldIntegration.navigationStatus().error,
        stage: b?.snapshot?.active?.stageId || null,
        state: b?.snapshot?.state || null,
        ready: !!(b && w.state === 'level' && b.snapshot?.active?.stageId === id && ['run.paused', 'run.ready'].includes(b.snapshot.state)),
      };
    }, stageId);
    const line = JSON.stringify(s);
    if (line !== last) { console.log(stageId, ((Date.now() - t0) / 1000).toFixed(1), line); last = line; }
    if (s.ready) return;
    if (s.err) throw Error(stageId + ' ' + s.err);
    await page.waitForTimeout(500);
  }
  throw Error('level not ready ' + stageId);
}

async function tapNav(page, key) {
  const t0 = Date.now();
  let q = null;
  while (Date.now() - t0 < 60000) {
    q = await page.evaluate((k) => {
      const t = __worldIntegration.layout().targets[k];
      return t && Number.isFinite(t.x) && Number.isFinite(t.y) ? t : null;
    }, key);
    if (q) break;
    await page.waitForTimeout(150);
  }
  if (!q) throw Error('nav target not live: ' + key);
  console.log('tap', key, q.x, q.y);
  await page.touchscreen.tap(q.x, q.y);
}

async function boardTap(page, key) {
  await page.waitForFunction((k) => {
    const t = __worldIntegration.board()?.layout?.targets?.[k];
    return !!(t && Number.isFinite(t.x) && Number.isFinite(t.y));
  }, key, { timeout: 15000 });
  const q = await page.evaluate((k) => __worldIntegration.board().layout.targets[k], key);
  console.log('board tap', key, q.x, q.y);
  await page.touchscreen.tap(q.x, q.y);
}

async function dismissTutorials(page) {
  const tutorials = { ToolIntroPanel: 'GotIt', RuleGuidePanel: 'GotIt' };
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(400);
    const popups = await page.evaluate(() => __worldIntegration.board()?.popups || []);
    const top = popups.find((name) => tutorials[name]);
    if (!top) break;
    console.log('dismiss', top);
    await boardTap(page, tutorials[top]);
  }
}

async function resumeBoard(page) {
  await dismissTutorials(page);
  const state = await page.evaluate(() => __worldIntegration.board()?.snapshot?.state);
  const popups = await page.evaluate(() => __worldIntegration.board()?.popups || []);
  console.log('resume from', state, popups);
  if (state === 'run.paused') await boardTap(page, 'Resume');
  await page.waitForFunction(() => {
    const b = __worldIntegration.board();
    return b?.snapshot?.state === 'run.ready' && !(b.popups || []).includes('PausePanel');
  }, {}, { timeout: 20000 });
  await dismissTutorials(page);
  await page.waitForFunction(() => {
    const b = __worldIntegration.board();
    return b?.snapshot?.state === 'run.ready' && !(b.popups || []).length;
  }, {}, { timeout: 20000 });
}

async function exitToIsland(page) {
  const popups = await page.evaluate(() => __worldIntegration.board()?.popups || []);
  if (!popups.includes('PausePanel')) {
    await boardTap(page, 'pause');
    await page.waitForFunction(() => (__worldIntegration.board()?.popups || []).includes('PausePanel'), {}, { timeout: 20000 });
  }
  await boardTap(page, 'Home');
  await page.waitForFunction(() => {
    try { return __worldIntegration.snapshot().state === 'island'; } catch { return false; }
  }, {}, { timeout: 120000 });
}

async function tapNode(page, spec) {
  const t0 = Date.now();
  let hit = [];
  while (Date.now() - t0 < 30000) {
    hit = await page.evaluate(async ({ popup, name }) => {
      const { director, UITransform } = await System.import('cc');
      const W = innerWidth, H = innerHeight, out = [];
      const visit = (n, inPopup) => {
        if (!n.activeInHierarchy) return;
        const here = inPopup || n.name === popup;
        if (here) {
          const t = n.getComponent(UITransform);
          if (t && n.name === name) {
            const b = t.getBoundingBoxToWorld();
            out.push({ cx: b.x + b.width / 2 + W / 2, cy: H / 2 - b.y - b.height / 2 });
          }
        }
        for (const c of n.children) visit(c, here);
      };
      visit(director.getScene(), false);
      return out;
    }, spec);
    if (hit.length) break;
    await page.waitForTimeout(200);
  }
  if (!hit.length) throw Error('node not found ' + JSON.stringify(spec));
  const n = hit[hit.length - 1];
  console.log('tap node', spec.name, n.cx, n.cy, 'of', hit.length);
  await page.touchscreen.tap(n.cx, n.cy);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
