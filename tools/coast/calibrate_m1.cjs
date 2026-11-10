'use strict';
// Find seedBank witnesses (1-ply greedy) and measure random / eps-greedy win rates.
// Session construction mirrors regional-r05 createCoast (tide alias + shells:[] + drop pearls).
const path = require('path');
const fs = require('fs');
const R = path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime');
const Session = require(R + '/regional-session.js');
const API = require(R + '/index.js');
const copy = Session.copy;
const freeze = Session.freeze;
const P = Session.prototype;

const N_WIN = +(process.env.N || 200);
const SEED_SCAN = +(process.env.SEED_SCAN || 64);
const OUT = process.env.OUT || '/workspace/product/2026-11-09/coast02-03/calibration.json';

function prng(s) { return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; }
function left(s) {
  const g = s.engine.goals;
  return Object.keys(g).reduce((a, k) => a + Math.max(0, g[k]) * (k === 'beacons' ? 30 : k === 'moss' || k === 'roots' ? 5 : 1), 0);
}
function coastAlias(stage) {
  const a = copy(stage); a.region = 'tide'; a.rules = { shells: [] }; return freeze(a);
}
function dropPearls(s) {
  if (s.pieces.length) return;
  delete s.engine.goals.pearls;
  if (s.engine.initialGoals) delete s.engine.initialGoals.pearls;
}
function coastGuide(stage) {
  const g = stage.config.goals || {};
  if (g.beacons) return { title: stage.name, goalName: '灯标', rule: 'beacon', tool: '本关没有道具。' };
  if (g.moss) return { title: stage.name, goalName: '苔藓', rule: 'moss', tool: '本关没有道具。' };
  return { title: stage.name, goalName: '目标', rule: 'goals', tool: '本关没有道具。' };
}
function patchCoast(s, stage) {
  Object.defineProperty(s, '_coastAlias', { value: coastAlias(stage), enumerable: true, writable: true });
  s.stage = freeze(copy(stage));
  dropPearls(s);
  s._regional = function (w) {
    const self = this, st = self.stage; self.stage = self._coastAlias;
    try { const r = P._regional.call(self, w); dropPearls(self); return r; }
    finally { self.stage = st; }
  };
  s.legalActions = function (o) {
    return P.legalActions.call(this, Object.assign({}, o || {}, { tools: false }));
  };
  s.snapshot = function () {
    const self = this, st = self.stage; self.stage = self._coastAlias;
    let v;
    try { v = copy(P.snapshot.call(self)); }
    finally { self.stage = st; }
    v.region = 'coast'; v.activeRelay = null;
    const guide = coastGuide(this.stage);
    v.guide = Object.assign({}, v.guide, { title: guide.title, goalName: guide.goalName, rule: guide.rule, tool: Object.assign({}, v.guide.tool, { kind: null, charges: 0, description: guide.tool }) });
    return freeze(v);
  };
  return s;
}
function sessionFor(stage, seed) {
  return patchCoast(new Session(coastAlias(stage), seed, { authoring: true }), stage);
}
function greedySolve(stage, seed) {
  const s = sessionFor(stage, seed);
  const actions = [];
  const cap = stage.config.moves;
  while (s.engine.status === 'playing' && actions.length < cap) {
    const acts = s.legalActions({ tools: false });
    let best = null, bv = 1e9;
    for (const a of acts) {
      const f = s.fork();
      // fork copies engine but may lose coast patches — use _act on fork then check goals
      if (!f._act(a)) continue;
      dropPearls(f);
      const v = f.engine.status === 'won' ? -1 : left(f);
      if (v < bv) { bv = v; best = a; }
    }
    if (!best || !s.act(best)) break;
    actions.push(best);
  }
  return { won: s.engine.status === 'won', actions, movesLeft: s.engine.moves, goals: { ...s.engine.goals } };
}
function policyRun(stage, seed, policy, ps) {
  const s = sessionFor(stage, seed);
  const rnd = prng(ps);
  let used = 0;
  const cap = stage.config.moves;
  while (s.engine.status === 'playing' && used < cap) {
    const acts = s.legalActions({ tools: false });
    if (!acts.length) break;
    let a;
    if (policy === 'random') a = acts[Math.floor(rnd() * acts.length)];
    else {
      let bv = Infinity, best = [];
      for (const x of acts) {
        const f = s.fork();
        if (!f._act(x)) continue;
        dropPearls(f);
        const v = f.engine.status === 'won' ? -1 : left(f);
        if (v < bv) { bv = v; best = [x]; }
        else if (v === bv) best.push(x);
      }
      if (!best.length) a = acts[Math.floor(rnd() * acts.length)];
      else if (policy === 'greedy') a = best[0];
      else a = rnd() < (+policy.slice(3)) ? acts[Math.floor(rnd() * acts.length)] : best[Math.floor(rnd() * best.length)];
    }
    s.act(a); used++;
  }
  return s.engine.status === 'won';
}
function winRates(stage, seed, N) {
  const out = { seed, N, moves: stage.config.moves };
  for (const pol of ['random', 'eps0.5', 'eps0.2']) {
    let w = 0;
    for (let i = 1; i <= N; i++) if (policyRun(stage, seed, pol, i * 7919)) w++;
    out[pol] = +(w / N).toFixed(3);
  }
  out.greedy = policyRun(stage, seed, 'greedy', 1) ? 1 : 0;
  return out;
}

const report = { N_WIN, SEED_SCAN, stages: {} };
for (const stage of API.coastPlayable) {
  const witnesses = [];
  for (let seed = 1; seed <= SEED_SCAN; seed++) {
    // skip known COAST01 bank first when scanning 01? still fine to re-find
    const r = greedySolve(stage, seed);
    if (r.won) witnesses.push({ seed, actions: r.actions, movesUsed: stage.config.moves - r.movesLeft, movesLeft: r.movesLeft });
    if (witnesses.length >= 5) break;
  }
  // Prefer existing seedBank order for COAST01
  let bank = witnesses.slice(0, 3).map(w => w.seed);
  if (stage.id === 'r06-coast-01') bank = stage.seedBank.slice();
  const primary = bank[0];
  let rates = null;
  if (primary != null) rates = winRates(stage, primary, stage.id === 'r06-coast-01' ? N_WIN : N_WIN);
  report.stages[stage.id] = {
    name: stage.name,
    moves: stage.config.moves,
    goals: stage.config.goals,
    witnessesFound: witnesses.length,
    seedBankCandidate: bank,
    primarySeed: primary,
    witness0: stage.id === 'r06-coast-01' ? null : (witnesses[0] || null),
    // for coast01 still record a greedy path on seed 22 for the report
    witnessOnPrimary: primary != null ? greedySolve(stage, primary) : null,
    winRates: rates,
  };
  console.error(stage.id, 'witnesses', witnesses.length, 'bank', bank, rates && JSON.stringify(rates));
}
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(OUT);
