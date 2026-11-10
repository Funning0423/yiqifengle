'use strict';
// Reworked hot-spring layouts, plus the cloud and rail boards that were the same shape
// after a turn or a slide. Random-play matches test_hotspring_wireup / test_cloudsea_wireup.
const path = require('node:path');
const Session = require(path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime/regional-session.js'));
const { symmetryKey, structureKey, symmetryGroups, sequenceGroups } = require('../region-levels/layout-key.cjs');
const N = +(process.env.N || 36);
const SEEDS = +(process.env.SEEDS || 14);
function prng(s) { return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }
const left = s => {
  const g = s.engine.goals;
  return Object.keys(g).reduce((a, k) => a + Math.max(0, g[k]) * (k === 'chimes' ? 40 : k === 'lines' || k === 'specials' ? 25 : 1), 0) + s.pieces.reduce((a, p) => a + (p.done ? 0 : (p.hits - p.progress) * 8), 0);
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
const starters = pairs => pairs.map(([index, special]) => ({ index, special }));
function stageOf(L) {
  return {
    id: L.id, region: L.region, ordinal: L.ordinal, name: L.name, contentRevision: L.revision,
    intendedBand: L.band, pieceKinds: L.pieceKinds, tool: null, seedBank: [1],
    config: { moves: L.movesTry[L.movesTry.length - 1], goals: L.goals, moss: L.moss || [], roots: L.roots || [], starters: L.starters || [], beacons: L.beacons || [] },
    rules: { chimes: L.chimes }, failHint: L.hint,
  };
}
const spring = [
  { id: 'r09-spring-01', region: 'spring', ordinal: 1, name: '灯笼初亮', revision: 'spring-2026-11-09c', band: 'introduce', target: 0.90, pieceKinds: 5, goals: { chimes: 2 }, starters: starters([[24, 'column']]), chimes: ch([[30, 4], [32, 4]]), hint: '点着两盏灯笼中间的纵线，让铃响起来', movesTry: [14, 16] },
  { id: 'r09-spring-02', region: 'spring', ordinal: 2, name: '石池', revision: 'spring-2026-11-09c', band: 'combine', target: 0.74, pieceKinds: 6, goals: { chimes: 4, moss: 4, type2: 16 }, moss: [24, 25, 31, 32], chimes: ch([[16, 2], [17, 2], [18, 2], [10, 3]]), hint: '清掉池里的苔，敲响池沿的铃，也收集棋子', movesTry: [16, 18, 20] },
  { id: 'r09-spring-03', region: 'spring', ordinal: 3, name: '竹篱后面', revision: 'spring-2026-11-09c', band: 'relief', target: 0.84, pieceKinds: 5, goals: { chimes: 3, roots: 5 }, roots: roots([[43, 1], [44, 1], [45, 1], [46, 1], [47, 1]]), chimes: ch([[36, 2], [38, 2], [33, 3]]), hint: '拆掉这一段竹篱，再敲响篱后的铃', movesTry: [14, 16, 18] },
  { id: 'r09-spring-04', region: 'spring', ordinal: 4, name: '泉眼', revision: 'spring-2026-11-09c', band: 'peak', target: 0.62, pieceKinds: 6, goals: { chimes: 2, roots: 5, lines: 1 }, roots: roots([[24, 2], [17, 1], [23, 1], [25, 1], [31, 1]]), chimes: ch([[8, 4], [40, 4]]), hint: '挖开泉眼里的厚根，并做出一条横线', movesTry: [20, 22, 24] },
  { id: 'r09-spring-05', region: 'spring', ordinal: 5, name: '蒸汽升起来', revision: 'spring-2026-11-09c', band: 'relief', target: 0.80, pieceKinds: 5, goals: { chimes: 4, specials: 2 }, chimes: ch([[38, 2], [30, 2], [32, 2], [24, 2]]), hint: '做出两颗特殊果实，敲响升起来的铃', movesTry: [16, 18, 20] },
  { id: 'r09-spring-06', region: 'spring', ordinal: 6, name: '红枫叶子', revision: 'spring-2026-11-09c', band: 'story', target: 0.68, pieceKinds: 6, goals: { chimes: 5, type1: 8, type4: 8 }, chimes: ch([[8, 3], [12, 3], [24, 4], [36, 3], [40, 3]]), hint: '收集两种棋子，敲响散开的枫叶铃', movesTry: [18, 20, 22] },
  { id: 'r09-spring-07', region: 'spring', ordinal: 7, name: '木廊的潮气', revision: 'spring-2026-11-09c', band: 'relief', target: 0.86, pieceKinds: 5, goals: { chimes: 4, moss: 2 }, moss: [23, 30], starters: starters([[38, 'row']]), chimes: ch([[9, 3], [16, 3], [17, 3], [18, 4]]), hint: '顺着木廊清掉潮苔，敲响石阶上的铃', movesTry: [14, 16, 18] },
  { id: 'r09-spring-08', region: 'spring', ordinal: 8, name: '夜泉', revision: 'spring-2026-11-09c', band: 'story', target: 0.64, pieceKinds: 6, goals: { chimes: 3, roots: 4, moss: 4, type0: 18 }, roots: roots([[14, 1], [28, 1], [20, 1], [34, 1]]), moss: [24, 23, 25, 17], chimes: ch([[22, 4], [10, 4], [26, 4]]), hint: '清掉石沿的根和池上的苔，再收集棋子', movesTry: [18, 20, 22] },
];
const fixes = [
  { id: 'r08-cloud-07', region: 'cloud', ordinal: 7, name: '云隙的光', revision: 'cloud-2026-11-09c', band: 'relief', target: 0.86, pieceKinds: 6, goals: { chimes: 4 }, chimes: ch([[16, 3], [24, 3], [32, 3], [40, 3]]), hint: '顺着云隙斜下来的四只铃敲', movesTry: [14, 16] },
  { id: 'r07-rail-02', region: 'rail', ordinal: 2, name: '信号灯下', revision: 'rail-2026-11-09c', band: 'combine', target: 0.74, pieceKinds: 6, goals: { chimes: 4, type0: 16 }, chimes: ch([[9, 3], [16, 3], [32, 3], [39, 3]]), hint: '兼顾两处信号灯旁的铃，也收集棋子', movesTry: [14, 16, 18] },
  { id: 'r07-rail-05', region: 'rail', ordinal: 5, name: '一列秋铃', revision: 'rail-2026-11-09c', band: 'relief', target: 0.80, pieceKinds: 6, goals: { chimes: 5 }, chimes: ch([[8, 4], [16, 4], [24, 4], [32, 4], [40, 4]]), hint: '顺着斜过来的铁轨把那排铃敲满', movesTry: [16, 18, 20, 22] },
];
const allDraft = spring.concat(fixes);
if (require.main !== module) { module.exports = { spring, fixes, stageOf }; }
function draftedStages() {
  const root = path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime');
  const prior = []
    .concat(require(root + '/catalog-data.js'))
    .concat(require(root + '/lakeside-levels-data.js'))
    .concat(require(root + '/snowpass-levels-data.js'))
    .concat(require(root + '/rail-levels-data.js'))
    .concat(require(root + '/cloud-levels-data.js'));
  const replace = new Map(allDraft.map(L => [L.id, stageOf(L)]));
  const merged = prior.map(s => replace.get(s.id) || s).concat(spring.map(stageOf));
  return merged;
}
if (process.env.CHECK) {
  const merged = draftedStages();
  const sym = symmetryGroups(merged), seq = sequenceGroups(merged);
  console.log(JSON.stringify({ symmetry: sym, sequences: seq, spring: spring.map(L => structureKey(stageOf(L))) }, null, 1));
  process.exit(sym.length || seq.length ? 1 : 0);
}
if (require.main !== module) return;
const only = process.env.ONLY;
const pack = process.env.PACK || 'spring';
const levels = (pack === 'fixes' ? fixes : pack === 'all' ? allDraft : spring).filter(L => !only || L.id === only);
const out = [];
for (const L of levels) {
  const stage = stageOf(L);
  const t0 = Date.now();
  const wins = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const g = lightGreedy(stage, seed, L.movesTry[L.movesTry.length - 1]);
    if (g.won && g.used <= L.movesTry[L.movesTry.length - 1]) wins.push({ seed, used: g.used, actions: g.actions });
  }
  wins.sort((a, b) => a.used - b.used || a.seed - b.seed);
  console.error(L.id, 'greedy', wins.length + '/' + SEEDS, 'used', wins.slice(0, 6).map(w => w.used).join(','), 'ms', Date.now() - t0);
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
  out.push({ id: L.id, name: L.name, moves: best.moves, avg: best.avg, per: best.per, seeds: best.seeds, witness: best.seeds.map(seed => bySeed.get(seed)), symmetry: symmetryKey(stage), structure: structureKey(stage) });
}
console.log(JSON.stringify(out, null, 1));
