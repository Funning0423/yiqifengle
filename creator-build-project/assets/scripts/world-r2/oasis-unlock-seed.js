'use strict';
// Replays the first verified win of every stage before the oasis onto the CALLER's
// platform. qfPre=unlock-oasis passes the isolated test profile. Real save keys are never opened here.
const WIT = require('./oasis-unlock-witnesses.js');
function seedOasisUnlock(profile, opts) {
  if (!opts || opts.allowQa !== true) throw Error('test-build-only');
  const platform = profile && profile.r5 ? profile.r5.platform : profile && profile.platform;
  const journey = profile && profile.r5 ? profile.r5.journey : profile && profile.journey;
  if (!platform || !journey) throw Error('oasis-seed-needs-profile');
  const Provider = require('../regional-r05/runtime/board-session-provider.js');
  const P = new Provider({ platform, journey });
  for (const w of WIT) {
    const started = P.startStage(w.id, { seed: w.seed });
    if (!started.ok) throw Error('oasis-seed-start ' + w.id + ' ' + (started.reason || ''));
    P.resume();
    for (const a of w.actions) {
      const preview = P.previewAction(a);
      if (!preview.ok) throw Error('oasis-seed-preview ' + w.id);
      const committed = P.commitAction(preview.token);
      if (!committed.ok) throw Error('oasis-seed-commit ' + w.id);
      let visual = P.snapshot().visual;
      while (visual) {
        if (!P.finishVisualStep(visual.token).ok) throw Error('oasis-seed-visual ' + w.id);
        visual = P.snapshot().visual;
      }
    }
    const shot = P.snapshot();
    if (!shot.result || !shot.result.completionRecorded) throw Error('oasis-seed-unregistered ' + w.id);
  }
  return { cleared: WIT.map(w => w.id) };
}
module.exports = seedOasisUnlock;
