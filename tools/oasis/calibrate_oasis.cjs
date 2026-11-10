'use strict';
// Search move budgets and witness seeds for the oasis layouts.
// Random-play uses the same prng and move window as test_oasis_wireup.
const fs = require('node:fs'), path = require('node:path');
const Session = require(path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime/regional-session.js'));
const { symmetryKey, structureKey, symmetryGroups, sequenceGroups } = require('../region-levels/layout-key.cjs');
const N = +(process.env.N || 36);
const SEEDS = +(process.env.SEEDS || 12);
function prng(s) { return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }
function left(s) {
  const g = s.engine.goals;
  const w = k => k === 'chimes' ? 40 : k === 'beacons' ? 36 : k === 'lines' || k === 'specials' ? 25 : k === 'roots' || k === 'moss' ? 6 : 1;
  return Object.keys(g).reduce((a, k) => a + Math.max(0, g[k]) * w(k), 0) + s.pieces.reduce((a, p) => a + (p.done ? 0 : (p.hits - p.progress) * 8), 0);
}
function actions(s) {
  const out = [];
  for (let i = 0; i < 49; i++) { if (i % 7 < 6) out.push(['swap', i, i + 1]); if (i < 42) out.push(['swap', i, i + 7]); out.push(['activate', i]); }
  return out.filter(a => s._valid(a));
}
function lightGreedy(stage, seed, cap) {
  const st = JSON.parse(JSON.stringify(stage)); st.config.moves = cap;
  const s = new Session(st, seed, { authoring: true }); const acts = [];
  while (s.engine.status === 'playing' && acts.length < cap) {
    const all = actions(s);
    const sample = all.length > 16 ? all.filter((_, i) => i % Math.ceil(all.length / 16) === (acts.length % Math.ceil(all.length / 16))) : all;
    let best = null, bv = Infinity;
    for (const a of (sample.length ? sample : all)) {
      const f = s.fork(); if (!f._act(a)) continue;
      const v = f.engine.status === 'won' ? -1 : left(f);
      if (v < bv) { bv = v; best = a; }
    }
    if (!best) break; s.act(best); acts.push(best);
  }
  return { won: s.engine.status === 'won', used: acts.length, actions: acts };
}
function randomWin(stage, seed, ps) {
  const s = new Session(JSON.parse(JSON.stringify(stage)), seed, { authoring: true });
  const rnd = prng(ps); let used = 0;
  while (s.engine.status === 'playing' && used < stage.config.moves + 2) {
    const acts = s.legalActions({ tools: false }); if (!acts.length) break;
    s.act(acts[Math.floor(rnd() * acts.length)]); used++;
  }
  return s.engine.status === 'won';
}
function seedRate(stage, seed) {
  let k = 0; for (let i = 1; i <= N; i++) if (randomWin(stage, seed, i * 7919)) k++;
  return +(k / N).toFixed(3);
}
function bestTriple(per, target) {
  const seeds = Object.keys(per).map(Number);
  let best = null;
  for (let i = 0; i < seeds.length; i++) for (let j = i + 1; j < seeds.length; j++) for (let k = j + 1; k < seeds.length; k++) {
    const avg = +((per[seeds[i]] + per[seeds[j]] + per[seeds[k]]) / 3).toFixed(3);
    const score = Math.abs(avg - target);
    if (!best || score < best.score) best = { score, avg, seeds: [seeds[i], seeds[j], seeds[k]], per: { [seeds[i]]: per[seeds[i]], [seeds[j]]: per[seeds[j]], [seeds[k]]: per[seeds[k]] } };
  }
  return best;
}
const ch = pairs => pairs.map(([index, hits]) => ({ index, hits }));
const roots = pairs => pairs.map(([index, layers]) => ({ index, layers }));
const starters = pairs => pairs.map(([index, special]) => ({ index, special }));
function stageOf(L, moves) {
  const goals = Object.assign({}, L.goals);
  const chimes = L.chimes || [];
  if (chimes.length) goals.chimes = chimes.length;
  else delete goals.chimes;
  if (L.beacons && L.beacons.length) goals.beacons = L.beacons.length;
  return {
    id: L.id, region: 'oasis', ordinal: L.ordinal, name: L.name, contentRevision: 'oasis-2026-11-10b',
    intendedBand: L.band, pieceKinds: L.pieceKinds, tool: null, seedBank: [1],
    config: { moves: moves || L.movesTry[L.movesTry.length - 1], goals, moss: L.moss || [], roots: L.roots || [], starters: L.starters || [], beacons: L.beacons || [] },
    rules: { chimes }, failHint: L.hint,
  };
}
const oasis = [
  { id: 'r11-oasis-01', ordinal: 1, name: '拱门椰影', band: 'introduce', target: 0.88, pieceKinds: 5, goals: { chimes: 2 }, starters: starters([[31, 'column']]), chimes: ch([[9, 3], [11, 5]]), hint: '点着两棵椰枣中间的纵线，把铃敲满', movesTry: [14] },
  { id: 'r11-oasis-02', ordinal: 2, name: '陶罐青苔', band: 'combine', target: 0.70, pieceKinds: 6, goals: { moss: 4, type0: 16 }, moss: [22, 23, 24, 25], starters: starters([[21, 'row']]), chimes: [], hint: '顺着陶罐那一行清掉苔，也收集棋子', movesTry: [14, 16, 18] },
  { id: 'r11-oasis-03', ordinal: 3, name: '喷泉灯序', band: 'relief', target: 0.80, pieceKinds: 5, goals: { beacons: 2 }, beacons: [17, 31], chimes: [], hint: '按顺序点亮两盏喷泉灯', movesTry: [14, 16, 18] },
  { id: 'r11-oasis-04', ordinal: 4, name: '沙砖根须', band: 'peak', target: 0.62, pieceKinds: 6, goals: { roots: 4, lines: 2 }, roots: roots([[2, 2], [9, 2], [16, 2], [23, 1]]), chimes: [], hint: '挖开一列厚根，再做出两条线', movesTry: [22, 24] },
  { id: 'r11-oasis-05', ordinal: 5, name: '布篷流苏', band: 'relief', target: 0.74, pieceKinds: 5, goals: { specials: 2 }, starters: starters([[18, 'color'], [24, 'row']]), chimes: [], hint: '用同色和横线，做出两枚特殊块', movesTry: [14, 16, 18] },
  { id: 'r11-oasis-06', ordinal: 6, name: '水池倒影', band: 'story', target: 0.66, pieceKinds: 6, goals: { moss: 2, type1: 12, type3: 12 }, moss: [25, 26], chimes: [], hint: '清掉池边两块苔，收集两种棋子', movesTry: [16, 18, 20] },
  { id: 'r11-oasis-07', ordinal: 7, name: '黄昏灯标', band: 'relief', target: 0.82, pieceKinds: 5, goals: { chimes: 2, beacons: 2 }, beacons: [24, 17], starters: starters([[24, 'bomb'], [17, 'column']]), chimes: ch([[30, 2], [32, 3]]), hint: '先点灯，再敲响黄昏的两只铃', movesTry: [14, 16] },
  { id: 'r11-oasis-08', ordinal: 8, name: '绿洲夜风', band: 'story', target: 0.62, pieceKinds: 6, goals: { chimes: 3, roots: 3, moss: 2, specials: 1, type2: 12 }, roots: roots([[8, 2], [22, 1], [36, 1]]), moss: [5, 41], chimes: ch([[14, 3], [27, 3], [34, 4]]), hint: '清掉厚根和苔，做出特殊块，再敲满铃', movesTry: [20, 22, 24] },
];
const root = path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime');
const prior = []
  .concat(require(root + '/lakeside-levels-data.js'))
  .concat(require(root + '/snowpass-levels-data.js'))
  .concat(require(root + '/rail-levels-data.js'))
  .concat(require(root + '/cloud-levels-data.js'))
  .concat(require(root + '/spring-levels-data.js'))
  .concat(require(root + '/fjord-levels-data.js'))
  .concat(require(root + '/catalog-data.js'));
const drafted = oasis.map(L => stageOf(L));
const sym = symmetryGroups(drafted.concat(prior));
if (sym.length) { console.error('symmetry', JSON.stringify(sym)); process.exit(1); }
const sequences = sequenceGroups(prior.concat(drafted));
if (sequences.length) { console.error('sequence', JSON.stringify(sequences)); process.exit(1); }
const keys = drafted.map(structureKey);
if (new Set(keys).size !== keys.length) { console.error('structure clash', keys); process.exit(1); }
console.error('layouts unique', drafted.map(s => s.id + ' ' + structureKey(s)).join('\n'));
if (process.env.CHECK) process.exit(0);
const only = process.env.ONLY;
const levels = only ? oasis.filter(L => L.id === only) : oasis;
const out = [];
for (const L of levels) {
  const stage = stageOf(L);
  const t0 = Date.now();
  const wins = [];
  const cap = Math.max(...L.movesTry);
  for (let seed = 1; seed <= SEEDS; seed++) {
    const g = lightGreedy(stage, seed, cap);
    if (g.won && g.used <= cap) wins.push({ seed, used: g.used, actions: g.actions });
  }
  wins.sort((a, b) => a.used - b.used || a.seed - b.seed);
  console.error(L.id, 'greedy', wins.length + '/' + SEEDS, 'used', wins.slice(0, 8).map(w => w.used).join(','), 'ms', Date.now() - t0);
  const bySeed = new Map(wins.map(w => [w.seed, w]));
  let best = null;
  for (const moves of L.movesTry) {
    const fit = wins.filter(w => w.used <= moves);
    if (fit.length < 3) { console.error('  moves', moves, 'witnesses', fit.length); continue; }
    const trial = stageOf(L, moves);
    const per = {};
    for (const w of fit) per[w.seed] = seedRate(trial, w.seed);
    const pick = bestTriple(per, L.target);
    if (!pick) continue;
    console.error('  moves', moves, 'best', pick.avg, 'seeds', pick.seeds.join(','), JSON.stringify(pick.per));
    if (!best || pick.score < best.score) best = { moves, score: pick.score, avg: pick.avg, per: pick.per, seeds: pick.seeds };
  }
  if (!best) { console.error('  NO FIT', L.id); continue; }
  const bank = best.seeds.map(seed => bySeed.get(seed));
  out.push({ id: L.id, name: L.name, band: L.band, target: L.target, moves: best.moves, avg: best.avg, per: best.per, seeds: best.seeds, witness: bank, hint: L.hint, stage: stageOf(L, best.moves) });
}
if (out.length !== levels.length) { console.error('incomplete', out.map(x => x.id)); process.exit(2); }
const rates = out.map(x => x.avg);
console.error('rates', rates.join(' → '));
const wave = rates[1] < rates[0] - 0.08 && rates[2] > rates[1] + 0.04 && rates[3] < rates[2] - 0.1 && rates[4] > rates[3] + 0.08 && rates[5] < rates[4] - 0.04 && rates[6] > rates[5] + 0.08 && rates[7] < rates[6] - 0.08 && rates[0] >= 0.86 && rates[3] <= 0.72 && rates[3] >= 0.60 && rates[7] >= 0.60 && rates.every(r => r >= 0.60 && r <= 0.90);
console.error('wave', wave);
const levelsOut = out.map(x => {
  const s = x.stage;
  s.seedBank = x.seeds;
  s.calibration = { status: 'greedy-witness', meaning: s.name + '. Random-play on seeds ' + x.seeds.join('/') + ' = ' + x.avg.toFixed(3) + ' (N=' + N + ') at ' + x.moves + ' moves. Layout is not shared with another stage. Not a human playtest.' };
  return s;
});
const witnesses = out.map(x => ({ id: x.id, witness: x.witness.map(w => ({ seed: w.seed, used: w.used, actions: w.actions })) }));
const dataPath = path.join(root, 'oasis-levels-data.js');
const header = '// 沙漠绿洲庭院 r11-oasis-01..08. Existing mechanisms only: chimes, moss, layered roots, starters, lines, specials, type goals, beacons.\n'
  + '// Layouts are not translations, mirrors or rotations of another stage, and the sequence is not another region\'s.\n'
  + '// Random-play win rate (3 seeds, N=' + N + ') steps ' + rates.map(r => r.toFixed(3)).join(' → ') + '. Moves stay between 14 and 24.\n';
console.log(JSON.stringify({ rates, moves: out.map(x => x.moves), wave }, null, 1));
if (!only && !wave) process.exit(3);
if (only) process.exit(0);
fs.writeFileSync(dataPath, header + 'module.exports=' + JSON.stringify(levelsOut) + ';\n');
fs.writeFileSync(path.join(__dirname, 'witnesses.json'), JSON.stringify(witnesses, null, 1) + '\n');
