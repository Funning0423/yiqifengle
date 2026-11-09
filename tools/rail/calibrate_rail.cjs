'use strict';
// One-shot curve search for r07-rail-01..06. Random play uses the lakeside prng (deterministic).
// Not a player test: it only places the six averages inside about 0.60–0.90, with an up-step between levels.
const path = require('node:path');
const Session = require(path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime/regional-session.js'));
const N = +(process.env.N || 48);
const SEEDS = 20;
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
function greedy(stage, seed, cap) {
  const st = JSON.parse(JSON.stringify(stage)); st.config.moves = cap;
  const s = new Session(st, seed, { authoring: true }); const acts = [];
  while (s.engine.status === 'playing' && acts.length < cap) {
    let best = null, bv = Infinity;
    for (const a of actions(s)) { const f = s.fork(); if (!f._act(a)) continue; const v = f.engine.status === 'won' ? -1 : left(f); if (v < bv) { bv = v; best = a; } }
    if (!best) break; s.act(best); acts.push(best);
  }
  return { won: s.engine.status === 'won', used: acts.length, actions: acts };
}
function randomWin(stage, seed, ps) {
  const s = new Session(JSON.parse(JSON.stringify(stage)), seed, { authoring: true });
  const rnd = prng(ps); let used = 0;
  while (s.engine.status === 'playing' && used < stage.config.moves + 5) {
    const acts = s.legalActions({ tools: false }); if (!acts.length) break;
    s.act(acts[Math.floor(rnd() * acts.length)]); used++;
  }
  return s.engine.status === 'won';
}
function rate(stage, seeds) {
  let w = 0, n = 0; const per = {};
  for (const seed of seeds) { let k = 0; for (let i = 1; i <= N; i++) { n++; if (randomWin(stage, seed, i * 7919)) { w++; k++; } } per[seed] = +(k / N).toFixed(3); }
  return { avg: +(w / n).toFixed(3), per };
}
const ch = (pairs) => pairs.map(([index, hits]) => ({ index, hits }));
const levels = [
  { id: 'r07-rail-01', name: '站台的铃', band: 'introduce', target: 0.90, pieceKinds: 5, goals: { chimes: 2 }, chimes: ch([[23, 5], [25, 5]]), moss: [], roots: [], movesTry: [14, 15, 16, 17, 18] },
  { id: 'r07-rail-02', name: '信号灯下', band: 'combine', target: 0.74, pieceKinds: 6, goals: { chimes: 4, type0: 16 }, chimes: ch([[14, 3], [20, 3], [28, 3], [34, 3]]), moss: [], roots: [], movesTry: [14, 16, 18, 20, 22] },
  { id: 'r07-rail-03', name: '枕木上的苔', band: 'relief', target: 0.84, pieceKinds: 5, goals: { chimes: 3, moss: 7 }, chimes: ch([[16, 4], [18, 4], [24, 4]]), moss: [21, 22, 23, 24, 25, 26, 27], roots: [], movesTry: [14, 16, 18, 20] },
  { id: 'r07-rail-04', name: '落叶与根', band: 'peak', target: 0.62, pieceKinds: 6, goals: { chimes: 3, roots: 4 }, chimes: ch([[22, 3], [24, 3], [26, 3]]), moss: [], roots: [{ index: 8, layers: 1 }, { index: 12, layers: 1 }, { index: 36, layers: 1 }, { index: 40, layers: 1 }], movesTry: [14, 16, 18, 20, 22] },
  { id: 'r07-rail-05', name: '一列秋铃', band: 'relief', target: 0.80, pieceKinds: 6, goals: { chimes: 5 }, chimes: ch([[8, 3], [16, 3], [24, 3], [32, 3], [40, 3]]), moss: [], roots: [], movesTry: [12, 14, 16, 18] },
  { id: 'r07-rail-06', name: '末班的铃', band: 'story', target: 0.66, pieceKinds: 5, goals: { chimes: 6, type4: 10 }, chimes: ch([[10, 3], [16, 3], [22, 3], [26, 3], [32, 3], [38, 3]]), moss: [], roots: [], movesTry: [12, 14, 16, 18] },
];
const out = [];
for (const L of levels) {
  if (process.env.ONLY && L.id !== process.env.ONLY) continue;
  const stage = { id: L.id, region: 'rail', ordinal: 1, name: L.name, contentRevision: 'rail-2026-11-09', pieceKinds: L.pieceKinds, tool: null, seedBank: [1], config: { moves: 24, goals: L.goals, moss: L.moss, roots: L.roots, starters: [] }, rules: { chimes: L.chimes } };
  const wins = [];
  for (let seed = 1; seed <= SEEDS; seed++) { const g = greedy(stage, seed, 24); if (g.won && g.used <= 22) wins.push({ seed, used: g.used, actions: g.actions }); }
  wins.sort((a, b) => a.used - b.used || a.seed - b.seed);
  console.error(L.id, 'greedy', wins.length + '/' + SEEDS, 'used', wins.map(w => w.used).join(','));
  const spread = (list) => {
    const chosen = [];
    for (const p of [0.15, 0.5, 0.85]) { const w = list[Math.min(list.length - 1, Math.floor((list.length - 1) * p))]; if (w && !chosen.some(c => c.seed === w.seed)) chosen.push(w); }
    for (const w of list) if (chosen.length < 3 && !chosen.some(c => c.seed === w.seed)) chosen.push(w);
    return chosen;
  };
  let best = null;
  for (const moves of L.movesTry) {
    const fit = wins.filter(w => w.used <= moves);
    if (fit.length < 3) { console.error('  moves', moves, 'witnesses', fit.length); continue; }
    const bank = spread(fit);
    const trial = JSON.parse(JSON.stringify(stage)); trial.config.moves = moves; trial.seedBank = bank.map(w => w.seed);
    const r = rate(trial, trial.seedBank);
    console.error('  moves', moves, 'seeds', bank.map(w => w.seed + ':' + w.used).join(' '), 'avg', r.avg, JSON.stringify(r.per));
    const score = Math.abs(r.avg - L.target);
    if (!best || score < best.score) best = { moves, score, r, bank };
  }
  if (!best) { console.error('  NO FIT'); continue; }
  out.push({ id: L.id, name: L.name, band: L.band, target: L.target, moves: best.moves, avg: best.r.avg, per: best.r.per, seeds: best.bank.map(w => w.seed), witness: best.bank });
}
console.log(JSON.stringify(out, null, 1));
