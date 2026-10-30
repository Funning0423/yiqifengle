# System panels: implementation notes (GGbot, branch ggbot/fg-system-panels)
SPEC: ui-design/system-panels/SPEC.md (UI设计部 6c629efc, approved by Grok Bot). This file only records how it was built
and where it differs from the SPEC. The UI team's worktree is not touched.

## Advisory page (§1)
- Drawn by `tools/first-screen/src/first-screen.js` (readable source). The shipped file
  `creator-build-project/build-templates/wechatgame/first-screen.js` is its minified copy: Creator copies build-templates
  verbatim. Regenerate it with `node tools/first-screen/minify.cjs`. `test_minified_parity.cjs` checks it matches the
  source and runs the same behaviour tests on both files.
- Cold start only: the file runs once per process. A warm start (onShow) does not re-run it, and it never runs during a transition.
- **Parallel boot.** `start()` resolves as soon as the loading picture is decoded. It never waits for the advisory, so
  game.js keeps booting the engine and loading subpackages while the advisory is up. Only `end()` (engine ready → GL
  handoff) waits for the advisory to finish.
- **Handoff.** The fade-out starts at 2.7 s, or at a tap after the 1.5 s lock, but never before the engine is ready. If
  the engine is late, the full advisory frame stays on screen: no blank, no loading look. When `end()` arrives, the page
  fades out over 300 ms and the engine takes over.
- **Added cold-start time** (`test_advisory_boot_timing.cjs`, fake clock, 60 Hz, compared with the same boot without the advisory):

  | engine ready | added |
  |---|---|
  | 0.3 s | 2.70 s |
  | 1.0 s | 1.98 s |
  | 2.0 s | 1.00 s |
  | ≥2.7 s (expected on device) | ≈0.3 s (the fade only) |
- **Logged marks** (performance.now ms): `[QF_BOOT] start= advisoryEnd= engineReady= released= firstGameFrame= addedMs=`,
  also kept on `GameGlobal.__firstScreen.t`.
- **Never a loading page.** The advisory paint has no progress bar, no percentage and no loading text; a test checks this.
  The only extra line is 「轻点继续」, shown after the lock ends.
- **Font.** `"Noto Serif SC","Songti SC",serif,sans-serif`, then the system default. Sizes: title 22 pt Bold, body 17 pt,
  line height 40 pt. `fitFont` uses measureText: the widest line keeps the design size if it fits (screen width − 48 pt),
  otherwise everything shrinks together, letter-spacing included. Lines never wrap and stay centred. No font subset is
  shipped (package budget).
- Publication info: `PublicationInfo.ts` is mirrored as `PUBLICATION_INFO` in first-screen.js (plain ES5, can't import
  TS), and a test keeps them equal. All four fields must be present, or the block is not drawn.

## Popups (§4), settings (§2), update (§3)
- PopupKit (`ui/PopupMotion.ts`): enter 320 ms / exit 180 ms on the two approved béziers.
  - The pressed look is applied on the touch-start event itself, on the same frame (U3 ≤100 ms).
  - Release springs back over 120 ms easeOutBack(1.4). The action fires on release without waiting for the spring.
  - If the action closes the popup, the face snaps to rest and the exit starts that frame (`test_press_state.cjs`).
- Update popup pinwheel:
  - Sizes, at 750/390 px per pt: blades R28 → 54 px; glow R46 / blur 12 → 88 / 23 px; hub Ø8 → r 7.7 px; 0.5 turn/s.
  - Colours are the SPEC hex values.
  - Graphics has no MSAA, so edges are feathered with a 1.6 px stroke at half alpha.
  - The glow is approximated with 8 stacked circles.
- Update signal: first-screen `onUpdateReady` only sets `GameGlobal.__qfUpdate.ready` (approved). The popup opens
  600 ms into a quiet island-home moment. 「稍后」 asks again only after leaving and coming back, at most twice per session.
- Icons: `icon_vibrate.png` is the 128-colour version (220×252, .meta unchanged, 24,874 → 6,039 B). Music and SFX were
  not converted: visible banding at 2×. Comparisons are in outbox 20261029-system-panels.

## Mac steps (device)
1. Import in Creator 3.8.8 so it generates .meta files for the new TS files (PopupMotion, PublicationInfo,
   UpdatePromptCore), then run a guarded wechat build (artifact 占位 scan included).
2. Cold-start on device 3 times. Copy the `[QF_BOOT]` line from vConsole/DevTools each time.
   - Expected: `addedMs` ≈ 300 when the engine is ready after 2.7 s. In any case `released − engineReady` should be ≤ 350 ms.
   - Also record `firstGameFrame − start`.
   - Repeat once with the network throttled to slow 3G: the advisory must stay up, with no blank frame and no loading look.
3. Warm start (background → foreground): the advisory must not appear.
