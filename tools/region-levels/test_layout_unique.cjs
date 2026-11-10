'use strict';
// No two stages may share a board layout. Obstacles, chime cells, hit counts, piece kinds and the goal mix
// are the layout. Move budgets and seeds are not.
// A translation, rotation or mirror of the same labeled board is the same layout.
// Two regions whose ordered mechanism-and-shape sequence matches are the same campaign.
const assert = require('node:assert/strict');
const path = require('node:path');
const API = require(path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime/index.js'));
const { duplicateGroups, symmetryGroups, sequenceGroups, layoutKey } = require('./layout-key.cjs');
const dupes = duplicateGroups(API.allStages);
assert.deepEqual(dupes, [], 'duplicate layouts: ' + JSON.stringify(dupes));
const keys = new Set(API.allStages.map(layoutKey));
assert.equal(keys.size, API.allStages.length);
const symmetry = symmetryGroups(API.allStages);
assert.deepEqual(symmetry, [], 'layouts match after mirror, translation or rotation: ' + JSON.stringify(symmetry));
const sequences = sequenceGroups(API.allStages);
assert.deepEqual(sequences, [], 'region sequences share a mechanism structure: ' + JSON.stringify(sequences));
console.log(JSON.stringify({ status: 'PASS', stages: API.allStages.length, uniqueLayouts: keys.size, symmetryGroups: symmetry.length, sequenceGroups: sequences.length }));
