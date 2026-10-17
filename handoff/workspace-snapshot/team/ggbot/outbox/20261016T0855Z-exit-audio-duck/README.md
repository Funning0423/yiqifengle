# GGbot: exit cinematic WindAudio duck + audio_cine .meta (2026-10-16)
Draft, local only, not pushed. Branch `ggbot/exit-audio-duck` in work/exit-duck (worktree of yiqifengle).

- Base: 00fea63 (运镜bot exit-cam B5.3, present in /workspace/wechat-game/yiqifengle) + Voice Bot 0001 (2fba62f, tree 42ff9ed5, patch SHA256 7cbd058d…19dd8 verified).
- Commit 3ad4f9135b9afb211e9eec184543cbb4cf3e0a4e, tree 7f47caa7aece5ccfda282791c7805cf187ebf6d9 (verified: clean 00fea63 + git am both patches).
- Patch SHA256: see SHA256SUMS (fcc0d8df…952f).

## Changes
- WindAudio.ts: during the exit cinematic (WorldFlow state standing/turning-out/walking-out/opening-door/crossing-out) the wind loops are ducked -12 dB, 0.5 s fade in and out (linear in dB), multiplied on top of the music slider.
  Released (0.5 s fade) when the state leaves the exit segment (island, cancelled back to home, error, disposed), or right away via
  `WindAudio.releaseExitDuck()` / `globalThis.__voiceWind.releaseExitDuck()` (for sail transition start or skip). Hard reset on scene change (no WorldFlowComponent), mute/hide (not allowed), component destroy.
  snapshot() now reports exitDuck / exitDuckGain.
- region_island/audio_cine.meta (directory 1.2.0, userData {} like sibling folders, so it belongs to the region_island bundle) and sfx_exit_outbound.mp3.meta (audio-clip 1.0.0, downloadMode 0), new uuids.
- assets/text manifests refreshed with `node tools/test_manifests.cjs --write` (base was already stale; the diff includes those pre-existing entries).
- New test tools/voice-bot/wind/test_wind_exit_duck.cjs (19 cases).

## Not done / risks
- On this base nothing plays sfx_exit_outbound yet and there is no sail transition / skip code (those are on the PR #56 line). The duck follows WorldFlow state; when merged with the sail transition, call releaseExitDuck() where it starts (otherwise the release happens when the state becomes `island`, after the settle).
- Not listened to. Needs Mac Creator build: .meta import, bundle size.
