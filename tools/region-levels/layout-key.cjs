'use strict';
// Identity of a board layout: obstacles, chime cells and hit counts, piece kinds, and the goal mix.
// Move budgets, seeds, names and ids are tuning, not a different layout.
// symmetryKey also treats a translation, rotation or mirror of that labeled board as the same layout.
// structureKey is the coarser sequence slot (shape class + which mechanisms), so two regions can be
// the same campaign even when no single board is an exact transform of another.
function sortedPairs(list, a, b) {
  return (list || []).map(item => [item[a], item[b]]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}
function layoutKey(stage) {
  const goals = Object.assign({}, stage.config && stage.config.goals);
  return JSON.stringify({
    pieceKinds: stage.pieceKinds,
    tool: stage.tool || null,
    goals,
    chimes: sortedPairs(stage.rules && stage.rules.chimes, 'index', 'hits'),
    moss: [...((stage.config && stage.config.moss) || [])].sort((a, b) => a - b),
    roots: sortedPairs(stage.config && stage.config.roots, 'index', 'layers'),
    starters: (stage.config && stage.config.starters) || [],
    shells: (stage.rules && stage.rules.shells) || null,
    blooms: (stage.rules && stage.rules.blooms) || null,
    relays: (stage.rules && stage.rules.relays) || null,
  });
}
function groupsOf(stages, keyOf) {
  const groups = new Map();
  for (const stage of stages) {
    const key = keyOf(stage);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(stage.id);
  }
  return [...groups.values()].filter(ids => ids.length > 1);
}
function duplicateGroups(stages) {
  return groupsOf(stages, layoutKey);
}
function put(map, index, tag) {
  if (!Number.isInteger(index)) return;
  if (!map.has(index)) map.set(index, []);
  map.get(index).push(tag);
}
function labeledPoints(stage) {
  const map = new Map();
  const rules = stage.rules || {}, config = stage.config || {};
  for (const c of rules.chimes || []) put(map, c.index, 'C' + c.hits);
  for (const c of rules.shells || []) put(map, c.index, 'Sh' + c.layers);
  for (const c of rules.blooms || []) put(map, c.index, 'Bl' + (c.pollen || []).join('.'));
  for (const c of rules.relays || []) put(map, c.index, 'Ry' + c.hits + ':' + (c.type === undefined ? '*' : c.type) + ':' + c.polarity);
  for (const index of config.moss || []) put(map, index, 'M');
  for (const root of config.roots || []) put(map, root.index, 'R' + root.layers);
  for (const starter of config.starters || []) put(map, starter.index, 'S' + starter.special);
  for (const index of config.beacons || []) put(map, index, 'B');
  (config.beaconTypes || []).forEach((type, i) => put(map, (config.beacons || [])[i], 'T' + type));
  return [...map.entries()].map(([index, tags]) => ({ x: index % 7, y: Math.floor(index / 7), t: tags.slice().sort().join('+') }));
}
function symmetryKey(stage) {
  const pts = labeledPoints(stage);
  if (!pts.length) return '[]';
  const rots = [
    p => ({ x: p.x, y: p.y, t: p.t }),
    p => ({ x: p.y, y: -p.x, t: p.t }),
    p => ({ x: -p.x, y: -p.y, t: p.t }),
    p => ({ x: -p.y, y: p.x, t: p.t }),
  ];
  const refs = [
    p => p,
    p => ({ x: -p.x, y: p.y, t: p.t }),
  ];
  let best = null;
  for (const ref of refs) for (const rot of rots) {
    const q = pts.map(p => rot(ref(p)));
    const minX = Math.min(...q.map(p => p.x)), minY = Math.min(...q.map(p => p.y));
    q.forEach(p => { p.x -= minX; p.y -= minY; });
    q.sort((a, b) => a.y - b.y || a.x - b.x || (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
    const text = JSON.stringify(q);
    if (!best || text < best) best = text;
  }
  return best;
}
function symmetryGroups(stages) {
  return groupsOf(stages, symmetryKey);
}
function chimeForm(stage) {
  const cs = (stage.rules && stage.rules.chimes || []).map(c => ({ x: c.index % 7, y: Math.floor(c.index / 7), h: c.hits }));
  if (!cs.length) return 'none';
  if (cs.length === 4) {
    const xs = new Set(cs.map(c => c.x)), ys = new Set(cs.map(c => c.y));
    if (xs.size === 2 && ys.size === 2) return 'block';
  }
  if (cs.length >= 2) {
    const dx = cs[1].x - cs[0].x, dy = cs[1].y - cs[0].y;
    if ((dx !== 0 || dy !== 0) && cs.every(c => (c.x - cs[0].x) * dy === (c.y - cs[0].y) * dx)) return cs.length === 2 ? 'pair' : 'chain';
  }
  if (cs.length === 2) return 'pair';
  return 'cluster';
}
function structureKey(stage) {
  const rules = stage.rules || {}, config = stage.config || {};
  const goals = Object.keys(config.goals || {}).filter(k => !['chimes', 'pearls', 'blooms', 'relays'].includes(k)).map(k => /^type\d$/.test(k) ? 'type' : k).sort();
  const cycle = rules.phaseCycle || rules.windCycle || rules.polarityCycle || [];
  return JSON.stringify({
    form: chimeForm(stage),
    hits: (rules.chimes || []).map(c => c.hits).sort((a, b) => a - b),
    shells: (rules.shells || []).length,
    blooms: (rules.blooms || []).length,
    relays: (rules.relays || []).length,
    roots: (config.roots || []).map(r => r.layers).sort((a, b) => a - b),
    moss: (config.moss || []).length,
    starters: (config.starters || []).map(s => s.special).sort(),
    beacons: (config.beacons || []).length,
    goals,
    tool: (stage.tool && stage.tool.kind) || null,
    cycle: cycle.join(','),
  });
}
function sequenceGroups(stages) {
  const byRegion = new Map();
  for (const stage of stages) {
    if (!byRegion.has(stage.region)) byRegion.set(stage.region, []);
    byRegion.get(stage.region).push(stage);
  }
  const seq = new Map();
  for (const [region, list] of byRegion) {
    list.sort((a, b) => a.ordinal - b.ordinal);
    const key = JSON.stringify(list.map(structureKey));
    if (!seq.has(key)) seq.set(key, []);
    seq.get(key).push(region);
  }
  return [...seq.values()].filter(regions => regions.length > 1);
}
module.exports = { layoutKey, duplicateGroups, symmetryKey, symmetryGroups, structureKey, sequenceGroups };
