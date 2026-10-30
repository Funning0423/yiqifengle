#!/usr/bin/env node
'use strict';
// system-panels SPEC §1.4: the annotation word (U+5360 U+4F4D) must never ship. Fails (exit 1) on any hit, literal or
// \u-escaped, in creator-build-project/assets + build-templates (source) and build/wechatgame/** (artifact, when present).
// Usage: check-no-placeholder.cjs [--root DIR] [extra dirs...]. Binary files (png/jpg/bin/ttf/...) are skipped.
const fs = require('node:fs'), path = require('node:path');
const WORD = '\u5360\u4f4d';
const ESC = /\\u5360\\u4f4d/i;
const BIN = /\.(png|jpe?g|webp|gif|bin|ttf|otf|woff2?|mp3|ogg|wav|m4a|mp4|glb|gltf\.bin|astc|pkm|ktx|zip|wasm|cconb)$/i;
function scan(dir, hits) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') scan(p, hits); continue; }
    if (!e.isFile() || BIN.test(e.name)) continue;
    const buf = fs.readFileSync(p); if (buf.includes(0)) continue;
    const text = buf.toString('utf8'), lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) if (lines[i].includes(WORD) || ESC.test(lines[i])) hits.push(p + ':' + (i + 1) + ' offset ' + Buffer.byteLength(lines.slice(0, i).join('\n') + (i ? '\n' : ''), 'utf8'));
  }
}
function check(root, extra = []) {
  const C = path.join(root, 'creator-build-project');
  const dirs = [path.join(C, 'assets'), path.join(C, 'build-templates'), path.join(C, 'build', 'wechatgame'), path.join(root, 'build', 'wechatgame'), ...extra];
  const hits = [], scanned = [];
  for (const d of dirs) if (fs.existsSync(d)) { scanned.push(d); scan(d, hits); }
  return { hits, scanned };
}
module.exports = { check };
if (require.main === module) {
  const a = process.argv.slice(2); let root = path.resolve(__dirname, '../..'); const extra = [];
  for (let i = 0; i < a.length; i++) if (a[i] === '--root') root = path.resolve(a[++i]); else extra.push(path.resolve(a[i]));
  const r = check(root, extra);
  if (r.hits.length) { console.error('PLACEHOLDER GATE FAILED (' + r.hits.length + '):\n  ' + r.hits.join('\n  ')); process.exit(1); }
  console.log('PLACEHOLDER GATE PASS: 0 hits in ' + r.scanned.length + ' dir(s): ' + r.scanned.map(d => path.relative(root, d) || d).join(', '));
}
