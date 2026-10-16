/** Schematic preview of the sailboat transition, driven by the same timing model as the game. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const { stripTypeScriptTypes } = require('node:module');

const root = path.resolve(__dirname, '../..');
const modelPath = path.join(root, 'creator-build-project/assets/scripts/cine/SailboatTransitionModel.ts');
const timingPath = path.join(root, 'creator-build-project/assets/resources/cine/transition_island_to_meadow.timing.json');
const outDir = process.env.SAILBOAT_PREVIEW_DIR || '/opt/cursor/artifacts/sailboat-transition';
const model = new Function(stripTypeScriptTypes(fs.readFileSync(modelPath, 'utf8').replace(/^export /gm, ''), { mode: 'transform' }) + '\nreturn { parseSailboatTiming, createSailboatPlayback, sailboatCoverAlpha };')();
const timing = model.parseSailboatTiming(JSON.parse(fs.readFileSync(timingPath, 'utf8')));

const W = 320, H = 568;
const FONT = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  'A': ['010', '101', '111', '101', '101'], 'B': ['110', '101', '110', '101', '110'],
  'C': ['111', '100', '100', '100', '111'], 'D': ['110', '101', '101', '101', '110'],
  'E': ['111', '100', '110', '100', '111'], 'F': ['111', '100', '110', '100', '100'],
  'H': ['101', '101', '111', '101', '101'], 'I': ['111', '010', '010', '010', '111'],
  'K': ['101', '101', '110', '101', '101'], 'L': ['100', '100', '100', '100', '111'],
  'M': ['101', '111', '111', '101', '101'], 'N': ['110', '101', '101', '101', '101'],
  'O': ['111', '101', '101', '101', '111'], 'P': ['111', '101', '111', '100', '100'],
  'S': ['111', '100', '111', '001', '111'], 'W': ['101', '101', '111', '111', '101'],
  ' ': ['000', '000', '000', '000', '000'], '-': ['000', '000', '111', '000', '000'],
};

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const chunk = (type, data) => {
    const head = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([head, data])) >>> 0, 0);
    return Buffer.concat([len, head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function create() { return Buffer.alloc(W * H * 4); }
function put(buf, x, y, r, g, b, a = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 4;
  const s = a / 255;
  buf[i] = Math.round(buf[i] * (1 - s) + r * s);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - s) + g * s);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - s) + b * s);
  buf[i + 3] = 255;
}
function fill(buf, x, y, w, h, r, g, b, a = 255) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(buf, x + xx, y + yy, r, g, b, a);
}
function text(buf, x, y, message, scale, r, g, b) {
  let cx = x;
  for (const ch of message.toUpperCase()) {
    const glyph = FONT[ch] || FONT[' '];
    for (let gy = 0; gy < glyph.length; gy++) for (let gx = 0; gx < glyph[gy].length; gx++) if (glyph[gy][gx] === '1') fill(buf, cx + gx * scale, y + gy * scale, scale, scale, r, g, b);
    cx += 4 * scale;
  }
}
function paint(view) {
  const buf = create();
  const meadow = view.scene === 'meadow';
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const r = meadow ? 142 + (198 - 142) * t : 120 + (214 - 120) * t;
    const g = meadow ? 188 + (226 - 188) * t : 186 + (236 - 186) * t;
    const b = meadow ? 214 + (176 - 214) * t : 214 + (232 - 214) * t;
    fill(buf, 0, y, W, 1, r, g, b);
  }
  const horizon = meadow ? 250 : 280;
  fill(buf, 0, horizon, W, H - horizon, meadow ? 92 : 36, meadow ? 158 : 110, meadow ? 86 : 132);
  if (!meadow) {
    fill(buf, 40, horizon - 70, 150, 80, 214, 196, 140);
    fill(buf, 70, horizon - 120, 90, 60, 86, 140, 78);
    fill(buf, 96, horizon - 168, 28, 52, 120, 92, 64);
  } else {
    fill(buf, 0, horizon + 40, W, 36, 64, 150, 176);
    fill(buf, 180, horizon - 90, 16, 90, 150, 120, 70);
    fill(buf, 150, horizon - 108, 76, 22, 190, 196, 200);
  }
  const boatX = meadow ? 70 + view.boatAlong * 150 : 210 - view.departure * 120;
  const boatY = horizon - 8;
  fill(buf, boatX, boatY, 54, 14, 120, 72, 36);
  fill(buf, boatX + 22, boatY - 36, 3, 36, 90, 60, 36);
  fill(buf, boatX + 25, boatY - 32, 18, 26, 244, 241, 232);
  if (view.hudVisible) {
    fill(buf, 16, H - 64, W - 32, 40, 18, 50, 51);
    text(buf, 28, H - 52, 'HUD', 2, 255, 242, 207);
  }
  const cover = model.sailboatCoverAlpha(view);
  if (cover > 0) {
    const white = view.white;
    fill(buf, 0, 0, W, H, Math.round(226 + 29 * white), Math.round(236 + 19 * white), Math.round(245 + 10 * white), Math.round(cover * 255));
  }
  const label = 'F' + view.frame + ' ' + view.shotId.slice(0, 2) + ' ' + view.phase;
  text(buf, 12, 16, label, 2, 24, 36, 48);
  return buf;
}

function framesFor(mode) {
  const playback = model.createSailboatPlayback(timing, { startFov: 42 });
  playback.begin();
  const frames = [];
  const tapFrame = timing.skipEnabledFromFrame + 12;
  let tapped = false;
  const push = view => frames.push({ view, rgba: paint(view) });
  push(playback.advance(0, { meadowReady: true }).view);
  for (let n = 0; n < timing.frameCount + timing.fps; n++) {
    const current = playback.advance(0, { meadowReady: mode === 'hold' ? frames.length > timing.sceneSwapFrame + 20 : true }).view;
    const tap = mode === 'skip' && !tapped && current.frame >= tapFrame;
    if (tap) tapped = true;
    const sample = playback.advance(1 / timing.fps, { meadowReady: mode === 'hold' ? n > timing.sceneSwapFrame + 15 : true, tap });
    push(sample.view);
    if (sample.view.phase === 'done' && frames.length > (mode === 'skip' ? tapFrame : timing.lastFrame)) break;
    if (mode !== 'hold' && sample.view.phase === 'done') break;
  }
  if (mode === 'skip') {
    for (let i = 0; i < 8; i++) frames.push(frames[frames.length - 1]);
  }
  return frames;
}

function encodeVideo(name, frames) {
  return new Promise((resolve, reject) => {
    const file = path.join(outDir, name + '.mp4');
    const ff = spawn('ffmpeg', ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', String(timing.fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', chunk => { err += chunk.toString(); });
    ff.on('error', reject);
    ff.on('close', code => code === 0 ? resolve(file) : reject(Error(name + ' ffmpeg ' + code + '\n' + err.slice(-500))));
    for (const frame of frames) ff.stdin.write(frame.rgba);
    ff.stdin.end();
  });
}
function writePng(file, rgba, w = W, h = H) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, png(w, h, rgba)); }

function contact(rows) {
  const pad = 8, labelH = 22, cols = rows[0].length;
  const sheetW = cols * W + (cols + 1) * pad;
  const sheetH = rows.length * (H + labelH) + (rows.length + 1) * pad;
  const sheet = Buffer.alloc(sheetW * sheetH * 4, 255);
  const blot = (sx, sy, src) => {
    for (let y = 0; y < H; y++) {
      const from = (y * W) * 4;
      const to = ((sy + y) * sheetW + sx) * 4;
      src.copy(sheet, to, from, from + W * 4);
    }
  };
  rows.forEach((row, ry) => row.forEach((frame, rx) => {
    blot(pad + rx * (W + pad), pad + ry * (H + labelH + pad) + labelH, frame.rgba);
  }));
  return { sheet, sheetW, sheetH };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const normal = framesFor('normal');
  const skip = framesFor('skip');
  const picks = [0, 12, 48, timing.sceneSwapFrame, 110, timing.lastFrame].map(frame => normal.find(item => item.view.frame === frame) || normal[normal.length - 1]);
  const skipBefore = skip.find(item => item.view.phase === 'playing' && item.view.frame >= timing.skipEnabledFromFrame + 12) || skip[0];
  const skipFade = skip.find(item => item.view.phase === 'skip-fade') || skip[1];
  const skipLand = skip[skip.length - 1];
  for (const frame of picks) writePng(path.join(outDir, 'frames/normal', 'f' + String(frame.view.frame).padStart(3, '0') + '.png'), frame.rgba);
  writePng(path.join(outDir, 'frames/skip/before.png'), skipBefore.rgba);
  writePng(path.join(outDir, 'frames/skip/fade.png'), skipFade.rgba);
  writePng(path.join(outDir, 'frames/skip/land.png'), skipLand.rgba);
  const sheet = contact([picks, [skipBefore, skipFade, skipLand, skipLand, skipLand, skipLand]]);
  writePng(path.join(outDir, 'contact-sheet.png'), sheet.sheet, sheet.sheetW, sheet.sheetH);
  const normalVideo = await encodeVideo('normal', normal);
  const skipVideo = await encodeVideo('skip', skip);
  const summary = {
    fps: timing.fps, normalFrames: normal.length, skipFrames: skip.length,
    normalVideo, skipVideo,
    contactSheet: path.join(outDir, 'contact-sheet.png'),
    normalStills: picks.map(frame => path.join(outDir, 'frames/normal', 'f' + String(frame.view.frame).padStart(3, '0') + '.png')),
    skipStills: ['before', 'fade', 'land'].map(name => path.join(outDir, 'frames/skip/' + name + '.png')),
  };
  fs.writeFileSync(path.join(outDir, 'preview.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
main().catch(error => { console.error(error); process.exit(1); });
