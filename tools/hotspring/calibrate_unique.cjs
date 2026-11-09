'use strict';
// Search move budgets and witness seeds for hot-spring layouts that are not copies of each other.
// Random-play uses the same prng and move window as test_hotspring_wireup / test_cloudsea_wireup.
const path = require('node:path');
const Session = require(path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime/regional-session.js'));
const { layoutKey, duplicateGroups } = require('../region-levels/layout-key.cjs');
const N = +(process.env.N || 36);
const SEEDS = +(process.env.SEEDS || 16);
function prng(s) { return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }
const left = s => {
  const g = s.engine.goals;
  return Object.keys(g).reduce((a, k) => a + Math.max(0, g[k]) * (k === 'chimes' ? 40 : 1), 0) + s.pieces.reduce((a, p) => a + (p.done ? 0 : (p.hits - p.progress) * 8), 0);
};
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
function stageOf(L) {
  return {
    id: L.id, region: L.region, ordinal: L.ordinal, name: L.name, contentRevision: L.revision,
    intendedBand: L.band, pieceKinds: L.pieceKinds, tool: null, seedBank: [1],
    config: { moves: 22, goals: L.goals, moss: L.moss || [], roots: L.roots || [], starters: [] },
    rules: { chimes: L.chimes }, failHint: L.hint,
  };
}
const spring = [
  { id: 'r09-spring-01', region: 'spring', ordinal: 1, name: '泉边的铃', revision: 'spring-2026-11-09', band: 'introduce', target: 0.90, pieceKinds: 5, goals: { chimes: 2 }, chimes: ch([[18, 4], [32, 4]]), hint: '贴着泉边风铃消除，让它响满', movesTry: [14, 16, 18, 20] },
  { id: 'r09-spring-02', region: 'spring', ordinal: 2, name: '灯笼下', revision: 'spring-2026-11-09', band: 'combine', target: 0.74, pieceKinds: 6, goals: { chimes: 4, type2: 14 }, chimes: ch([[8, 3], [15, 3], [16, 3], [23, 3]]), hint: '兼顾灯笼旁的铃，也收集棋子', movesTry: [16, 18, 20, 22] },
  { id: 'r09-spring-03', region: 'spring', ordinal: 3, name: '竹篱的铃', revision: 'spring-2026-11-09', band: 'relief', target: 0.84, pieceKinds: 6, goals: { chimes: 5 }, chimes: ch([[28, 3], [29, 3], [30, 3], [31, 3], [32, 3]]), hint: '顺着竹篱把那一排铃敲响', movesTry: [14, 16, 18, 20] },
  { id: 'r09-spring-04', region: 'spring', ordinal: 4, name: '石池与根', revision: 'spring-2026-11-09', band: 'peak', target: 0.62, pieceKinds: 5, goals: { chimes: 2, roots: 6 }, chimes: ch([[3, 4], [45, 4]]), roots: roots([[8, 1], [12, 1], [20, 1], [24, 1], [36, 1], [40, 1]]), hint: '清掉石池边的树根，再敲响风铃', movesTry: [18, 20, 22] },
  { id: 'r09-spring-05', region: 'spring', ordinal: 5, name: '一排泉铃', revision: 'spring-2026-11-09', band: 'relief', target: 0.80, pieceKinds: 6, goals: { chimes: 5 }, chimes: ch([[4, 2], [10, 2], [16, 2], [22, 2], [28, 2]]), hint: '顺着石阶斜过来的那排铃敲', movesTry: [14, 16, 18, 20] },
  { id: 'r09-spring-06', region: 'spring', ordinal: 6, name: '雾气升起', revision: 'spring-2026-11-09', band: 'story', target: 0.68, pieceKinds: 5, goals: { chimes: 6, type3: 10 }, chimes: ch([[6, 3], [13, 3], [20, 3], [27, 3], [34, 3], [41, 3]]), hint: '趁着雾气把风铃敲满', movesTry: [14, 16, 18, 20, 22] },
  { id: 'r09-spring-07', region: 'spring', ordinal: 7, name: '廊上的铃', revision: 'spring-2026-11-09', band: 'relief', target: 0.86, pieceKinds: 6, goals: { chimes: 4 }, chimes: ch([[31, 3], [32, 3], [38, 3], [39, 3]]), hint: '敲响木廊边靠在一起的四只铃', movesTry: [14, 16, 18] },
  { id: 'r09-spring-08', region: 'spring', ordinal: 8, name: '枫叶落尽', revision: 'spring-2026-11-09', band: 'story', target: 0.64, pieceKinds: 6, goals: { chimes: 7, type0: 20 }, chimes: ch([[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2]]), hint: '沿着枫叶落下的那一排铃敲满', movesTry: [14, 16, 18, 20, 22] },
];
if (require.main !== module) { module.exports = { spring, stageOf }; return; }
const only = process.env.ONLY;
const root = path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime');
const prior = []
  .concat(require(root + '/lakeside-levels-data.js'))
  .concat(require(root + '/snowpass-levels-data.js'))
  .concat(require(root + '/rail-levels-data.js'))
  .concat(require(root + '/cloud-levels-data.js'))
  .concat(require(root + '/catalog-data.js'));
const drafted = spring.map(stageOf);
const dupes = duplicateGroups(drafted.concat(prior));
if (dupes.length) { console.error('draft dupes', JSON.stringify(dupes)); process.exit(1); }
if (process.env.CHECK) { console.log('unique', drafted.length, 'plus prior', prior.length); process.exit(0); }
const levels = only ? spring.filter(L => L.id === only) : spring;
const out = [];
for (const L of levels) {
  const stage = stageOf(L);
  const t0 = Date.now();
  const wins = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const g = lightGreedy(stage, seed, 22);
    if (g.won && g.used <= 22) wins.push({ seed, used: g.used, actions: g.actions });
  }
  wins.sort((a, b) => a.used - b.used || a.seed - b.seed);
  console.error(L.id, 'greedy', wins.length + '/' + SEEDS, 'used', wins.slice(0, 8).map(w => w.used).join(','), 'ms', Date.now() - t0);
  const bySeed = new Map(wins.map(w => [w.seed, w]));
  let best = null;
  for (const moves of L.movesTry) {
    const fit = wins.filter(w => w.used <= moves);
    if (fit.length < 3) { console.error('  moves', moves, 'witnesses', fit.length); continue; }
    const trial = JSON.parse(JSON.stringify(stage)); trial.config.moves = moves;
    const per = {};
    for (const w of fit) per[w.seed] = seedRate(trial, w.seed);
    const pick = bestTriple(per, L.target);
    if (!pick) continue;
    console.error('  moves', moves, 'best', pick.avg, 'seeds', pick.seeds.join(','), JSON.stringify(pick.per));
    if (!best || pick.score < best.score) best = { moves, score: pick.score, avg: pick.avg, per: pick.per, seeds: pick.seeds };
  }
  if (!best) { console.error('  NO FIT'); continue; }
  const bank = best.seeds.map(seed => bySeed.get(seed));
  out.push({ id: L.id, name: L.name, band: L.band, target: L.target, moves: best.moves, avg: best.avg, per: best.per, seeds: best.seeds, witness: bank, layout: layoutKey(stage) });
}
console.log(JSON.stringify(out, null, 1));
