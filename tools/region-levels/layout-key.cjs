'use strict';
// Identity of a board layout: obstacles, chime cells and hit counts, piece kinds, and the goal mix.
// Move budgets, seeds, names and ids are tuning, not a different layout.
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
function duplicateGroups(stages) {
  const groups = new Map();
  for (const stage of stages) {
    const key = layoutKey(stage);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(stage.id);
  }
  return [...groups.values()].filter(ids => ids.length > 1);
}
module.exports = { layoutKey, duplicateGroups };
