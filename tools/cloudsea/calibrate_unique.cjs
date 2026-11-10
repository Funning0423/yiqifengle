'use strict';
// Search move budgets and witness seeds for layouts that are not copies of each other.
// Random-play uses the same prng and move window as test_cloudsea_wireup / test_rail_wireup.
const path = require('node:path');
const Session = require(path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime/regional-session.js'));
const { layoutKey, duplicateGroups } = require('../region-levels/layout-key.cjs');
const N = +(process.env.N || 36);
const SEEDS = +(process.env.SEEDS || 18);
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
    const sample = all.length > 20 ? all.filter((_, i) => i % Math.ceil(all.length / 20) === (acts.length % Math.ceil(all.length / 20))) : all;
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
const snow = [
  { id: 'r06-snow-01', region: 'snow', ordinal: 1, name: '雪里的手套', revision: 'snowpass-2026-11-09b', band: 'introduce', target: 0.88, pieceKinds: 5, goals: { chimes: 2 }, chimes: ch([[17, 5], [31, 5]]), hint: '贴着风铃消除，让它在雪里响满', movesTry: [14, 16, 18, 20, 22] },
  { id: 'r06-snow-02', region: 'snow', ordinal: 2, name: '灯下的铃', revision: 'snowpass-2026-11-09b', band: 'combine', target: 0.78, pieceKinds: 6, goals: { chimes: 4, type1: 12 }, chimes: ch([[15, 3], [16, 3], [22, 3], [23, 3]]), hint: '兼顾灯边的铃，也收集棋子', movesTry: [14, 16, 18, 20] },
  { id: 'r06-snow-03', region: 'snow', ordinal: 3, name: '霜下的铃', revision: 'snowpass-2026-11-09b', band: 'relief', target: 0.82, pieceKinds: 5, goals: { chimes: 3, moss: 10 }, chimes: ch([[16, 4], [17, 3], [23, 4]]), moss: [8, 9, 10, 15, 16, 17, 22, 23, 24, 29], hint: '先清掉风铃旁的霜苔', movesTry: [14, 16, 18, 20] },
  { id: 'r06-snow-04', region: 'snow', ordinal: 4, name: '石阶的根', revision: 'snowpass-2026-11-09b', band: 'peak', target: 0.64, pieceKinds: 6, goals: { chimes: 4, roots: 5 }, chimes: ch([[9, 4], [11, 4], [37, 4], [39, 4]]), roots: roots([[15, 1], [19, 1], [24, 1], [29, 1], [33, 1]]), hint: '清掉石阶边的树根，再敲响风铃', movesTry: [16, 18, 20, 22] },
  { id: 'r06-snow-05', region: 'snow', ordinal: 5, name: '一排雪铃', revision: 'snowpass-2026-11-09b', band: 'relief', target: 0.80, pieceKinds: 5, goals: { chimes: 5 }, chimes: ch([[6, 3], [12, 3], [18, 3], [24, 3], [30, 3]]), hint: '顺着斜过来的那排雪铃敲', movesTry: [14, 16, 18, 20] },
  { id: 'r06-snow-06', region: 'snow', ordinal: 6, name: '山口的星座', revision: 'snowpass-2026-11-09b', band: 'story', target: 0.68, pieceKinds: 6, goals: { chimes: 6, type2: 14 }, chimes: ch([[1, 3], [2, 3], [3, 3], [45, 3], [46, 3], [47, 3]]), hint: '顺着星座的位置把风铃敲满', movesTry: [14, 16, 18, 20, 22] },
];
const rail = [
  { id: 'r07-rail-01', region: 'rail', ordinal: 1, name: '站台的铃', revision: 'rail-2026-11-09b', band: 'introduce', target: 0.90, pieceKinds: 5, goals: { chimes: 2 }, chimes: ch([[30, 4], [31, 4]]), hint: '贴着站台风铃消除，让它响满', movesTry: [14, 16, 18] },
  { id: 'r07-rail-02', region: 'rail', ordinal: 2, name: '信号灯下', revision: 'rail-2026-11-09b', band: 'combine', target: 0.74, pieceKinds: 6, goals: { chimes: 4, type0: 14 }, chimes: ch([[9, 3], [10, 3], [16, 3], [17, 3]]), hint: '兼顾信号灯旁的铃，也收集棋子', movesTry: [14, 16, 18, 20] },
  { id: 'r07-rail-03', region: 'rail', ordinal: 3, name: '枕木的铃', revision: 'rail-2026-11-09b', band: 'relief', target: 0.84, pieceKinds: 6, goals: { chimes: 5 }, chimes: ch([[4, 4], [11, 4], [18, 4], [25, 4], [32, 4]]), hint: '顺着枕木把这一列铃敲满', movesTry: [14, 16, 18, 20, 22] },
  { id: 'r07-rail-04', region: 'rail', ordinal: 4, name: '落叶与根', revision: 'rail-2026-11-09b', band: 'peak', target: 0.62, pieceKinds: 5, goals: { chimes: 2, roots: 6 }, chimes: ch([[17, 4], [31, 4]]), roots: roots([[0, 1], [6, 1], [14, 1], [28, 1], [42, 1], [48, 1]]), hint: '清掉落叶下的树根，再敲响风铃', movesTry: [16, 18, 20, 22] },
  { id: 'r07-rail-05', region: 'rail', ordinal: 5, name: '一列秋铃', revision: 'rail-2026-11-09b', band: 'relief', target: 0.80, pieceKinds: 6, goals: { chimes: 5 }, chimes: ch([[35, 4], [36, 4], [37, 4], [38, 4], [39, 4]]), hint: '顺着铁轨斜过来的那排铃敲', movesTry: [14, 16, 18, 20, 22] },
  { id: 'r07-rail-06', region: 'rail', ordinal: 6, name: '末班的铃', revision: 'rail-2026-11-09b', band: 'story', target: 0.66, pieceKinds: 5, goals: { chimes: 6, type2: 8 }, chimes: ch([[4, 3], [12, 3], [20, 3], [28, 3], [36, 3], [44, 3]]), hint: '顺着末班车的位置把风铃敲满', movesTry: [14, 16, 18, 20] },
];
const cloud = [
  { id: 'r08-cloud-01', region: 'cloud', ordinal: 1, name: '云台的铃', revision: 'cloud-2026-11-09b', band: 'introduce', target: 0.90, pieceKinds: 5, goals: { chimes: 2 }, chimes: ch([[10, 4], [24, 4]]), hint: '贴着云台风铃消除，让它响满', movesTry: [14, 16, 18, 20] },
  { id: 'r08-cloud-02', region: 'cloud', ordinal: 2, name: '晨旗下', revision: 'cloud-2026-11-09b', band: 'combine', target: 0.74, pieceKinds: 6, goals: { chimes: 4, type0: 16 }, chimes: ch([[7, 3], [14, 3], [21, 3], [22, 3]]), hint: '兼顾晨旗旁的铃，也收集棋子', movesTry: [16, 18, 20, 22] },
  { id: 'r08-cloud-03', region: 'cloud', ordinal: 3, name: '栈道的铃', revision: 'cloud-2026-11-09b', band: 'relief', target: 0.84, pieceKinds: 6, goals: { chimes: 5 }, chimes: ch([[7, 3], [8, 3], [9, 3], [10, 3], [11, 3]]), hint: '顺着栈道把那一排铃敲响', movesTry: [14, 16, 18, 20] },
  { id: 'r08-cloud-04', region: 'cloud', ordinal: 4, name: '石根与雾', revision: 'cloud-2026-11-09b', band: 'peak', target: 0.62, pieceKinds: 5, goals: { chimes: 2, roots: 6 }, chimes: ch([[11, 4], [39, 4]]), roots: roots([[1, 1], [7, 1], [15, 1], [29, 1], [43, 1], [47, 1]]), hint: '清掉石台上的树根，再敲响风铃', movesTry: [18, 20, 22] },
  { id: 'r08-cloud-05', region: 'cloud', ordinal: 5, name: '一排晨铃', revision: 'cloud-2026-11-09b', band: 'relief', target: 0.80, pieceKinds: 6, goals: { chimes: 5 }, chimes: ch([[0, 2], [8, 2], [16, 2], [24, 2], [32, 2]]), hint: '顺着晨光斜过来的那排铃敲', movesTry: [14, 16, 18, 20] },
  { id: 'r08-cloud-06', region: 'cloud', ordinal: 6, name: '日出之前', revision: 'cloud-2026-11-09b', band: 'story', target: 0.68, pieceKinds: 5, goals: { chimes: 6, type4: 8 }, chimes: ch([[5, 3], [11, 3], [17, 3], [23, 3], [29, 3], [35, 3]]), hint: '赶在日出前把风铃敲满', movesTry: [14, 16, 18, 20, 22] },
  { id: 'r08-cloud-07', region: 'cloud', ordinal: 7, name: '云隙的光', revision: 'cloud-2026-11-09b', band: 'relief', target: 0.86, pieceKinds: 6, goals: { chimes: 4 }, chimes: ch([[28, 3], [29, 3], [35, 3], [36, 3]]), hint: '敲响云隙里靠在一起的四只铃', movesTry: [14, 16, 18] },
  { id: 'r08-cloud-08', region: 'cloud', ordinal: 8, name: '海平线上', revision: 'cloud-2026-11-09b', band: 'story', target: 0.64, pieceKinds: 6, goals: { chimes: 7, type1: 18 }, chimes: ch([[42, 2], [43, 2], [44, 2], [45, 2], [46, 2], [47, 2], [48, 2]]), hint: '沿着海平线把那一排铃敲满', movesTry: [14, 16, 18, 20, 22] },
];
if (require.main !== module) { module.exports = { snow, rail, cloud, stageOf }; return; }
const pack = process.env.PACK || 'cloud';
const levels = pack === 'snow' ? snow : pack === 'rail' ? rail : pack === 'all' ? snow.concat(rail, cloud) : cloud;
const only = process.env.ONLY;
const lake = require(path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime/lakeside-levels-data.js'));
const drafted = (pack === 'all' ? snow.concat(rail, cloud) : levels).map(stageOf);
const dupes = duplicateGroups(drafted.concat(lake));
if (dupes.length) { console.error('draft dupes', JSON.stringify(dupes)); process.exit(1); }
if (process.env.CHECK) { console.log('unique', drafted.length, 'plus lake', lake.length); process.exit(0); }
const out = [];
for (const L of levels) {
  if (only && L.id !== only) continue;
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
