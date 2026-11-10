'use strict';
// Replays the first verified win of every stage before the moss garden onto the CALLER's
// platform. qfPre=unlock-mossgarden passes the isolated test profile. Real save keys are never opened here.
const WIT = require('./mossgarden-unlock-witnesses.js');
function seedMossgardenUnlock(profile, opts) {
  if (!opts || opts.allowQa !== true) throw Error('test-build-only');
  const platform = profile && profile.r5 ? profile.r5.platform : profile && profile.platform;
  const journey = profile && profile.r5 ? profile.r5.journey : profile && profile.journey;
  if (!platform || !journey) throw Error('mossgarden-seed-needs-profile');
  const Provider = require('../regional-r05/runtime/board-session-provider.js');
  const P = new Provider({ platform, journey });
  for (const w of WIT) {
    const started = P.startStage(w.id, { seed: w.seed });
    if (!started.ok) throw Error('mossgarden-seed-start ' + w.id + ' ' + (started.reason || ''));
    P.resume();
    for (const a of w.actions) {
      const preview = P.previewAction(a);
      if (!preview.ok) throw Error('mossgarden-seed-preview ' + w.id);
      const committed = P.commitAction(preview.token);
      if (!committed.ok) throw Error('mossgarden-seed-commit ' + w.id);
      let visual = P.snapshot().visual;
      while (visual) {
        if (!P.finishVisualStep(visual.token).ok) throw Error('mossgarden-seed-visual ' + w.id);
        visual = P.snapshot().visual;
      }
    }
    const shot = P.snapshot();
    if (!shot.result || !shot.result.completionRecorded) throw Error('mossgarden-seed-unregistered ' + w.id);
  }
  return { cleared: WIT.map(w => w.id) };
}
module.exports = seedMossgardenUnlock;
