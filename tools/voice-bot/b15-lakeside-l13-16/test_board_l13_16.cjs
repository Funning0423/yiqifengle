// Main-line levels 13-16 (lakeside, plan B) resolve to the lakeside profile on the board; 9-12 stay sky city; 1 and 17 island.
'use strict';
const path = require('path'), fs = require('fs');
const S = path.resolve(__dirname, '../../../creator-build-project/assets/scripts');
const ts = require(process.env.QF_TYPESCRIPT_MODULE || '/tmp/qfts/node_modules/typescript');
const load = f => { const m = { exports: {} }; const code = ts.transpileModule(fs.readFileSync(path.join(S, f), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  new Function('exports', 'require', 'module', code)(m.exports, r => mods[r.replace('../', '')], m); return m.exports; };
const mods = {}; mods['world-r2/LevelRegion'] = load('world-r2/LevelRegion.ts');
const T = load('audio/SceneAudioTable.ts');
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('FAIL ' + m); } };
const board = id => T.resolveSceneAudio({ state: 'level', stable: 'level', boardPresent: true, boardStageId: id, boardProvider: 'mainline' });
for (let i = 13; i <= 16; i++) { const p = board('mainline-' + i); ok(p.place === 'lakeside' && p.track === 'lakeside' && p.layers.join() === 'lake', 'L' + i + ' lakeside'); const m = T.lakesideBoardMix('mainline-' + i); ok(m && m.bedVol <= 0.55 && m.bedVol >= 0.35 && m.birdsInterval[0] >= 14, 'L' + i + ' mix sane'); }
for (const i of ['09', '10', '11', '12']) ok(board('mainline-' + i).place === 'skycity', 'L' + i + ' sky');
for (const i of ['01', '17']) ok(board('mainline-' + i).place === 'island', 'L' + i + ' island');
ok(T.lakesideBoardMix('mainline-12') === null, 'L12 no lake mix');
ok(board('r04-lake-03').place === 'lakeside', 'r04 lake still lakeside');
const vols = T.LAKESIDE_BOARD_LEVELS.map(m => m.bedVol); ok(vols.every((v, i) => i === 0 || v <= vols[i - 1]), 'bed monotone non-increasing');
console.log(fail ? `FAIL ${fail}/${n}` : `ALL PASS lakeside L13-16 board (${n} checks)`); process.exit(fail ? 1 : 0);
