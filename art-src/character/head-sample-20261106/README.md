# Head SAMPLE 2026-11-06 — refine e976 toward Nahoko (sample only)

**Not a merge candidate for runtime.** Does not replace
`creator-build-project/.../chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb`.

## Baseline / rollback
- `heroine_e976_baseline.glb` — bit-copy of live e976a733 heroine (expression/feel preserved as starting point).
- `heroine_head_sample.glb` — sample only (face atlas + light cheek/fringe/collar-clear edits).

## What changed (rationale)
| Change | Why |
|---|---|
| Eyes redrawn almond, size between e976 & round2, one soft highlight | Clear at game distance; less shiny-anime doll; keep character readable |
| Soft nose + mouth paint only (no geometric wedge) | Avoid dark faceted nose from prior remodel; keep soft Ghibli read |
| Mid-cheek +~3 mm outward | Rounder natural face; **no** head scale / blanket smooth |
| Fringe tip soften + mild side sweep; collar-clear nudge | Better hair silhouette; clean hair→original collar join |
| Original collar / neck / hat / body | Keep e976 polish and dress collar; body untouched |

## Rebuild
```bash
python3 scripts/paint_sample_face.py heroine_e976_baseline.glb heroine_painted.glb
python3 scripts/soft_sample_mesh.py heroine_painted.glb heroine_head_sample.glb
# renders: scripts/render_char.py, render_face_extra.py, render_game_scale.py
```

## Sheets
- `sheets/face_{close,34,side}_e976_vs_sample.jpg`
- `sheets/game_scale_bust_e976_vs_sample.jpg`
- `sheets/sample_with_ref_and_rationale.jpg` (Nahoko ref + e976 + sample + notes)

## Gaps
- Still not a full Nahoko likeness — sample direction only.
- Hair silhouette improvement is light; fringe still low-poly chunky.
- Eyes may need one more size/placement pass after Cocos/IBL check.
- No blink atlas re-author beyond open/half/closed paint cells.
- Not verified in Cocos / WeChat.
