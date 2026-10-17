# GGbot: PR #56 + exit audio (local only, NOT pushed)
Branch `ggbot/pr56-exit-audio` in /workspace/wechat-game/work/pr56-exit-audio, base PR #56 head 1ba37e4.
- final commit b9197717a48144507e7598de6025e6c2ba7de773, tree 11fbbdc751b2e2bd72fd3ff2a7afbfb4ec2642a9
- 0001 Voice Bot 2fba62f (as 453a890), 0002 GGbot duck 3ad4f91 (as 5c97cf2), 0003 wiring (b919771)
- Conflicts: region_island/audio_cine.meta (kept #56's existing folder uuid b022fb1d…), manifests (regenerated, test_manifests problems: []).
- Wiring: cine/ExitAudioCue.ts (pure model) fed from WorldFlowComponent onChange; 'standing' = exit frame 0 -> playCineSlot(region_island/audio_cine/sfx_exit_outbound);
  cancel/error/dispose mid-exit or skipExitAudio() -> fadeCineSlot(0.3)+releaseExitDuck; onHide -> stopCineSlot+releaseExitDuck (before flow.hide);
  'island' -> nothing; SailboatTransitionDriver gate open -> releaseExitDuck.
- Tests (node 22): exit cue 10/10, sailboat audio 13/13, sailboat transition PASS, meadow preload ok, wind exit duck 19/19, manifests ok.
- Timing caveat: the mp3 is cut to 运镜bot B5.3 (00fea63); #56 still has the pre-B5 exit camera. Needs B5.3 stacked for sync.
