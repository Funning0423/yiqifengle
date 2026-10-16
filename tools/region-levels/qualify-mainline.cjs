'use strict';
// Regenerate deterministically. The policy uses legal on-board swaps/activations;
// no bombs, inventory grants, direct completion writes, or progress fixtures.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const base = path.resolve(__dirname, '../../creator-build-project/assets/scripts/mainline-r1/runtime');
const Session = require(base + '/mainline-session'), banks = require(base + '/verified-seeds');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const entries = [];
for (let level = 0; level < 12; level++) for (const seed of banks[level]) {
  const session = new Session(level, seed);
  while (session.engine.status === 'playing') {
    const hint = session.hint();
    assert(hint && ['swap', 'activate'].includes(hint.action[0]), 'No legal zero-tool hint');
    assert(session.act(hint.action, false));
  }
  assert.equal(session.engine.status, 'won', `${Session.stageId(level)} seed ${seed}`);
  entries.push({stageId: Session.stageId(level), level, seed, actions: session.actions,
    movesRemaining: session.engine.moves, score: session.engine.score,
    contentSignature: session.checkpoint().contentSignature,
    expectedStateSHA256: hash(session.checkpoint().expectedState)});
}
const result = {schemaVersion: 1, scope: '36 shipped openings; legal zero-tool winning witnesses, not human playtest or every strategy winning',
  engineSHA256: hash(fs.readFileSync(base + '/vendor/engine.js')), entries};
const out = path.join(__dirname, 'verified-mainline.json');
if (process.argv.includes('--check')) assert.deepEqual(JSON.parse(fs.readFileSync(out, 'utf8')), result);
else fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(`PASS ${entries.length} shipped mainline seeds, zero inventory tools/bombs`);
