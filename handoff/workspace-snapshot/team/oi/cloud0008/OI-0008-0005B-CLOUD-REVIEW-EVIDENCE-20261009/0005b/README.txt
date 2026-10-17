0005b reviewer evidence — 2026-10-09 UTC

Conclusion: keep as an isolated diagnostic candidate, do not merge as accepted audio interruption fix. No Mac/Creator/DevTools/device action was performed by this review.

Reproduce (Node.js 24 used; no packages, installs, browser, network, real audio or system writes):
  node 0005b/evidence/test_audio_review.cjs
  node 0005b/evidence/test_bridge_review.cjs
Run from bundle root, or use the equivalent full script paths. Scripts write results beside themselves. They use node:module.stripTypeScriptTypes, remove only imports/export keywords/decorator for VM evaluation, and provide mocked cc/wx/storage/clock. This is a logic harness, not TypeScript type checking or Cocos compilation. ExperimentalWarning is expected.

Patch applicability:
- R6 GameAudio extracted verbatim from the verified increment delta's new-file hunk.
- R6 SHA256 a2f40503278f6237c325aabb7816372da37db718b9caacec18b51a830ef7272e.
- Applied only 0001-0005b-GameAudio-v0.3.1-interrupt-suspend-Voice-Bot-o.patch with git apply --check --directory=creator-build-project, then git apply, in a disposable cloud copy.
- Candidate SHA256 7f6b580822dae4986f3217ecd70af34ad3b19153e2ffd6e8d3120e37bba3d377.
- AudioBridge is byte-identical before/after: e20ff1da689696cd0c92e854ef7eb04f8d84d56ed481c8ad20cbcfbba51d3a75.
- No actual user's repo or Mac changed. The package's combined-vs-0005 reference diff was not applied.

Results: 22 GameAudio scenarios: 15 supported normal-path behaviors, 1 intentional policy limitation, 6 reproduced defect/risk cases (two cases are the same option-failure bug). Seven unchanged AudioBridge lifecycle cases pass. These counts describe assertions of observed behavior, not 29 product acceptance passes.

Main findings (candidate GameAudio.ts line numbers):
1. Lines 158–162: onShowEvent always clears interrupted, including when hidden is already cleared. Injected order HIDE -> Cocos SHOW -> new interruption BEGIN -> duplicate wx SHOW drops the new interruption and allows new SFX before End. A simple duplicated-show test without an intervening new Begin passes and misses this. Real device ordering/frequency not measured.
2. Lines 61,148–162: after Show resets an old interruption, a late End can clear a newer Begin. The API callbacks in this implementation carry no identity; an explicit ordering/recovery policy is needed. This is a simulated adversarial ordering, not evidence it happened on a device.
3. Lines 177–185: innerAudioOptionApplied is set before the option succeeds and is not reset by failure/throw; later component recreation never retries it. Claims about applied mute/mixing policy therefore need success evidence.
4. Lines 74–92 (inherited R6 weakness): repeated ensure is safe, but onLoad has no duplicate-instance rejection. A second manually/scene-added GameAudio overwrites static instance and leaves both components/listeners alive. Mock: 4 AudioSources, 8 wx callbacks, both components able to emit SFX. This does not contradict prior single-instance Mac observations.
5. Lines 111–113: update re-pauses a suspended loop but ignores muted. If the engine resumes a previously playing loop after Show while mute is true, it remains playing. The current supplied file assigns no loop clip, so this is a latent loop/BGM risk; real engine ordering not tested.
6. Intentional product tradeoff: foreground Show clears interruption even without End, permitting sounds during an ongoing call. README explicitly accepts possible overlap. Do not describe this behavior as 'silence until interruption ends'.
7. Existing one-shots are not canceled by this code. Cocos 3.8 documentation says playOneShot cannot be paused/stopped after launch: https://docs.cocos.com/creator/3.8/manual/zh/audio-system/audiosource.html . Thus 'no new SFX while suspended' is supported in basic mock paths; instantaneous silence on hide/mute/interruption is not.

What is genuinely preserved/fixed in tested code:
- Union of hidden/interrupted suppresses new SFX; End alone does not resume hidden audio.
- Basic duplicate Hide/Show idempotence and no replay queue.
- Normal mute/read/write and storage failures handled without crashing.
- Destruction removes supported wx/Cocos callbacks, balances clip references, clears instance conditionally.
- Without wx.off* callbacks remain registered but alive guard makes old callbacks inert.
- Old asynchronous resource load after destroy/recreate or replacement fails node/instance identity guards without adding references. These guards come from R6, not a new 0005b fix.
- AudioBridge remains R6: one initial director listener; repeated ensure/tag no duplicate; destroy removes only its own callbacks/tag; remount retags; board disappearance resets render baseline.

Not run / not established:
- Creator 3.8.8 full compilation/build, decorator/engine registration, API type validation.
- WeChat DevTools execution, first-open red-error verification, production save data migration.
- Seven actual clip audibility/duration/channel behavior; physical mute switch; Android/iOS device behavior.
- Incoming/declined calls, switching into an ongoing call, voice message/music mixing, Bluetooth/headphone/speaker policy.
- Actual engine-versus-wx event order or duplicate/stale event timing.
- Real pause/resume under dropped End; setInnerAudioOption success; platform compatibility/unsupported callbacks.
- Full-game E2E, assets, character/art/cinematics.

Safe next gate:
Return event-order policy/option-failure/duplicate-instance issues for correction; rerun these isolated tests against a uniquely hashed revision. Only then apply that revision to a disposable Mac worktree with the exact R6 base verified, preserve the original save key namespace unless production-key use is explicitly intended, and perform the listed runtime/device checks. Do not overwrite an already repaired finalizer or infer first-open success from this audio patch.
