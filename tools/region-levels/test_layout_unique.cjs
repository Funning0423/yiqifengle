'use strict';
// No two stages may share a board layout. Obstacles, chime cells, hit counts, piece kinds and the goal mix
// are the layout. Move budgets and seeds are not.
const assert = require('node:assert/strict');
const path = require('node:path');
const API = require(path.resolve(__dirname, '../../creator-build-project/assets/scripts/regional-r05/runtime/index.js'));
const { duplicateGroups, layoutKey } = require('./layout-key.cjs');
const dupes = duplicateGroups(API.allStages);
assert.deepEqual(dupes, [], 'duplicate layouts: ' + JSON.stringify(dupes));
const keys = new Set(API.allStages.map(layoutKey));
assert.equal(keys.size, API.allStages.length);
console.log(JSON.stringify({ status: 'PASS', stages: API.allStages.length, uniqueLayouts: keys.size }));
