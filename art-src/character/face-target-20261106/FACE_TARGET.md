# Face Target Audit — 2026-11-06

## Approved target (single source of truth)

**Owner-approved target reference (named):**
`art-src/character/reference/char-target-20261106.png`

**Named attachment path from steering:**
`/home/box/agent-data/agents/2724ba5d-8c96-44e1-b75f-a30e83320d4d/attachments/18b2e364d7d542edc900aaeceabe9ddefa0e70e30d561b1be0b9031e4337f82c.png`

### Gap note (binary)
As of this write-up (America/New_York 2026-11-06 ~06:50), the named SHA-256 attachment file **was not present on disk** (box agent attachments, Mac Downloads/Desktop/Pictures, or Cursor app support).  
Interim working copy of `char-target-20261106.png` is seeded from `refs/char-face-fail-20261105.png` (kitchen seated costume/context shot of the same heroine lineage) so paths resolve. **When the owner re-drops `18b2e364…png`, replace that file and re-diff.** Until then, the **written specs below** are the binding target (parent steering, owner-approved).

### Binding visual specs (owner)
| Area | Target |
|------|--------|
| Overall | Matte, soft-shaded toy-figure look |
| Face | Plain porcelain white/cream; very small feature set |
| Eyes | Two **narrow dark almond** eyes; thin upper lash line; **NO highlights**; **NO blush** |
| Mouth / nose | Barely visible |
| Hair | Dark navy short bob of **curly wavy clumps** with volume |
| Dress | **Bright lemon yellow** turtleneck + long sleeves with **white cuff trim** (mustard change was WRONG — revert) |
| Apron | Long pure white, straps + waistband |
| Hands | Small white, clasped on lap |
| Boots | Light tan/camel ankle boots; white stockings |
| Hat | Straw boater with **coral-red** band |

## Repo search — existing design sheets / approved refs

| Path | Role | Approved as face target? |
|------|------|--------------------------|
| `refs/char-face-fail-20261105.png` | Kitchen seated in-game / fail screenshot (anime eyes still visible in close crops) | **No** — costume/context only; historically labeled “fail” |
| `refs/lakeside-fusion-accept-funning-20261105.png` | Lakeside environment accept (Funning 2026-11-05) | **No** — environment, not face design |
| `refs/balloon-inflate-fail-20261105.png` | Balloon fail evidence | **No** |
| `art-src/character/head-r2/share/*` | Head round-2 share sheets | **No** — prior polish direction (larger anime eyes) |
| `art-src/character/body-r2/share/*` | Body round-2 vs V12 refs | **No** — body only |
| `art-src/character/head-sample-20261106/*` | Rejected head-sample (802012a0) | **No** — reviewer rejected |
| `art-src/character/remodel-head-20261106/*` | Abandoned from-scratch remodel | **No** |
| Named `18b2e364…png` | Owner-approved single target | **Yes (intended)** — **file missing on disk at audit time** |

**Conclusion:** There is **no prior reliable owner-approved face design sheet** in-repo besides the new named target. Direction previously drifted (Nahoko almond with highlights → larger anime → rejected remodel). Current binding target is the owner specs above.

## Concrete diffs: e976a733 face vs target

Contact sheet: `face-target/contact_sheet.png`  
Baseline face atlas: `face-target/e976_face_atlas.png`  
Baseline face_close: `head-sample/renders_e976/face_close.png`

| Feature | e976a733 (current) | Owner target | Delta (executable) |
|---------|--------------------|--------------|--------------------|
| Skin | Warm peach (~#F0C9B0 family on atlas) | Porcelain white/cream | Lift atlas base toward #F4EDE4 / #F7F0E6; reduce warm saturation |
| Eyes size/shape | Large round/almond, ~iris rx≈48px on 1024 atlas; shiny anime | Narrow dark almond, much smaller on face | Shrink eye paint ~35–45%; taller almond (w:h ≈ 2.2:1); lower on face slightly |
| Eye highlight | Large white circular specular | **None** | Delete highlight ellipses from open/half/closed cells |
| Upper lash | Thick stylized lash + brow | Thin upper lash only; brows optional/minimal | Thin stroke ~1–2px; fade brows or remove |
| Blush | Soft pink ovals under eyes | **None** | Fill blush with skin tone |
| Nose | Tiny dash / soft mark | Barely visible | Soften to near-invisible shade or omit |
| Mouth | Small red smile curve | Barely visible | Fainter, shorter stroke or omit |
| Face feature scale | Features dominate mid-face | Features tiny vs head | Overall feature footprint ≤ ~55% of current |
| Hair silhouette | Planar bob chunks, sharp fringe spikes, hard specular band | Curly wavy **clumps** with volume | Mesh: add radial undulation / clump lobes on bob shell; soften fringe into waves |
| Hair shading | Hard anisotropic highlight stripe | Soft matte / soft highlight band | Soften hair albedo highlight; lower roughness contrast in paint |
| Collar | Tall lemon cylinder, thin paper edge | Rolled turtleneck thickness | Mesh: extrude/roll top rim outward+down; smoother neck→shoulder (dress top ring) |
| Dress hue | Atlas yellow mean ≈ RGB(252,234,39) — already lemon | Bright lemon (not mustard) | **Keep lemon**; do not reintroduce mustard. Confirm cuff trim white on sleeve ends |
| Apron / boots / hat | Present; coral band OK | Match target | No face-task change; verify apron pure white, boots camel |

## Executable modification plan

### Phase 0 — lock target binary
1. Replace `char-target-20261106.png` with owner file `18b2e364…` when available; regenerate contact sheet.
2. Do **not** treat Nahoko film stills or prior remodel as overrides.

### Phase 1 — face texture (M_G2_FACE / T_G2_FACE_1024) — primary
Script target: `char-polish/hair-collar/scripts/paint_target_face.py`  
- Cover old eyes/blush/mouth/nose with porcelain skin.  
- Redraw **narrow dark almond** eyes (no iris highlight, thin upper lash).  
- Preserve blink atlas cells (open / half / closed) with same language.  
- Minimal mouth; skip blush.  
- Optional: 1–2px soft nose shade only if still readable at game scale.

### Phase 2 — minimal face geometry (optional, approved now)
- Slightly flatten mid-face specular catchers if needed (normals), **no** nose wedge, **no** head scale.  
- Keep e976 head bbox.

### Phase 3 — hair clumps (M_G2_HAIR)
Script: `char-polish/hair-collar/scripts/hair_clumps_collar.py`  
- Displace bob shell into 6–8 azimuthal curly lobes (sin/cos radial + mild Y wave).  
- Soften fringe tips into wavy clumps (not spikes).  
- Soft anisotropic-like highlight via albedo band (not a hard white stripe).  
- Keep overall bob silhouette / hat clearance.

### Phase 4 — rolled turtleneck (LOD0_G2_DRESS collar ring)
- Select dress verts near max-Y collar rim.  
- Add thickness: outward normal push + slight downward roll on rim ring.  
- Smooth transition into shoulder (laplacian on band only).  
- Keep lemon material; ensure white cuff trim untouched.

### Phase 5 — validate
- Render: face_close, face_34, side, game-scale bust; sheet `target | e976 | sample`.  
- Self-judge strictly vs owner specs (not vs prior anime).  
- Commit to `char/hair-collar-20261106` **only** if clearly closer to target.

## Contact sheet
`face-target/contact_sheet.png` — e976 face_close | kitchen costume/context crop | written-spec callouts.
