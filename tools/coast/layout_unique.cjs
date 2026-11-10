'use strict';
// layout-unique: 7×7 mask canonicalization under D4 (rotations + reflections).
// Two layouts collide if any dihedral image of A equals B. Compares coast playable
 // masks to each other (adjacent + all pairs) and to tide/meadow/sky/lake masks.
const path = require('path');
const R = path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime');
const API = require(R + '/index.js');
const cat = require(R + '/catalog-data.js');
const lake = require(R + '/lakeside-levels-data.js');

const N = 7;
function idx(r, c) { return r * N + c; }
function rc(i) { return [Math.floor(i / N), i % N]; }
function transform(cells, kind) {
  const out = [];
  for (const i of cells) {
    let [r, c] = rc(i);
    switch (kind) {
      case 0: break;
      case 1: [r, c] = [c, N - 1 - r]; break; // 90
      case 2: [r, c] = [N - 1 - r, N - 1 - c]; break; // 180
      case 3: [r, c] = [N - 1 - c, r]; break; // 270
      case 4: c = N - 1 - c; break; // mirror V
      case 5: r = N - 1 - r; break; // mirror H
      case 6: [r, c] = [c, r]; break; // transpose
      case 7: [r, c] = [N - 1 - c, N - 1 - r]; break; // anti-transpose
      default: throw new Error('bad kind');
    }
    out.push(idx(r, c));
  }
  return out.slice().sort((a, b) => a - b);
}
function canonical(cells) {
  if (!cells.length) return '';
  let best = null;
  for (let k = 0; k < 8; k++) {
    const key = transform(cells, k).join(',');
    if (best === null || key < best) best = key;
  }
  return best;
}
function masksOf(stage) {
  const moss = (stage.config.moss || []).slice();
  const roots = (stage.config.roots || []).map(r => (typeof r === 'number' ? r : r.index));
  const beacons = Array.isArray(stage.config.beacons) ? stage.config.beacons.filter((v, i, a) => a.indexOf(v) === i) : [];
  return {
    id: stage.id,
    region: stage.region,
    ordinal: stage.ordinal,
    moss: canonical(moss),
    roots: canonical(roots),
    beacons: canonical(beacons),
    mossRaw: moss.slice().sort((a, b) => a - b),
    rootsRaw: roots.slice().sort((a, b) => a - b),
    beaconsRaw: beacons.slice().sort((a, b) => a - b),
    goals: Object.keys(stage.config.goals || {}).sort().join('+'),
  };
}
function combo(stage) {
  const g = Object.keys(stage.config.goals || {}).sort().join('+');
  const has = [];
  if ((stage.config.moss || []).length) has.push('mossMask');
  if ((stage.config.roots || []).length) has.push('roots');
  if (Array.isArray(stage.config.beacons) && stage.config.beacons.length) has.push('beacons');
  const st = (stage.config.starters || []).map(s => s.special).sort().join(',') || 'noStart';
  return g + '|' + (has.join(',') || 'open') + '|' + st;
}

const coast = API.coastPlayable.slice().sort((a, b) => a.ordinal - b.ordinal);
const others = [...cat, ...lake];
const report = { ok: true, coastCombos: [], adjacentComboClash: [], coastLayoutClash: [], crossRegionLayoutClash: [], sequenceVsRegions: [], notes: [] };

for (const s of coast) report.coastCombos.push({ id: s.id, ordinal: s.ordinal, combo: combo(s), moves: s.config.moves });

for (let i = 1; i < coast.length; i++) {
  const a = combo(coast[i - 1]), b = combo(coast[i]);
  if (a === b) {
    report.ok = false;
    report.adjacentComboClash.push({ a: coast[i - 1].id, b: coast[i].id, combo: a });
  }
}

const coastMasks = coast.map(masksOf);
for (let i = 0; i < coastMasks.length; i++) {
  for (let j = i + 1; j < coastMasks.length; j++) {
    for (const kind of ['moss', 'roots', 'beacons']) {
      const A = coastMasks[i][kind], B = coastMasks[j][kind];
      if (A && B && A === B) {
        report.ok = false;
        report.coastLayoutClash.push({ a: coastMasks[i].id, b: coastMasks[j].id, kind, canonical: A });
      }
    }
  }
}

const otherMasks = others.map(masksOf);
for (const cm of coastMasks) {
  for (const om of otherMasks) {
    for (const kind of ['moss', 'roots', 'beacons']) {
      const A = cm[kind], B = om[kind];
      if (A && B && A === B) {
        report.ok = false;
        report.crossRegionLayoutClash.push({ coast: cm.id, other: om.id, kind, canonical: A });
      }
    }
  }
}

// Sequence structure: first three ordinal goal-families vs other regions' first three
function family(stage) {
  const g = stage.config.goals || {};
  if (g.beacons) return 'beacons';
  if (g.chimes) return 'chimes';
  if (g.moss && !g.roots && !Object.keys(g).some(k => /^type/.test(k))) return 'moss';
  if (g.moss) return 'moss+';
  if (g.roots) return 'roots+';
  if (Object.keys(g).some(k => /^type/.test(k))) return 'type';
  return 'other';
}
const nSeq = Math.min(5, coast.length);
const coastSeq = coast.slice(0, nSeq).map(family).join('→');
report.notes.push('coast sequence (ordinals 1..' + nSeq + '): ' + coastSeq);
for (const region of ['tide', 'meadow', 'sky', 'lake']) {
  const rows = others.filter(s => s.region === region).sort((a, b) => a.ordinal - b.ordinal).slice(0, nSeq);
  const seq = rows.map(family).join('→');
  // Compare equal-length prefixes: full coastSeq vs region prefix of same length
  const clash = seq === coastSeq || (rows.length >= nSeq && seq === coastSeq);
  if (clash) report.ok = false;
  report.sequenceVsRegions.push({ region, seq, length: rows.length, clashWithCoast: clash });
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);
