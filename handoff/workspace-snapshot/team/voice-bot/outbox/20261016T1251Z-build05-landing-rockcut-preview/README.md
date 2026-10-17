# PREVIEW, not for merge: Build05 landing rock cut (Voice Bot)
Branch voice/build05-landing-rockcut-preview (local only) · commit dca9c301a0ba51184ca953dc03f044f1bcf75c3a · tree e7447fff0ee1b579639dd2ffcf56eb3b0d80e8c7 · parent 1c21428
Patch SHA256 677e7eaedd47125b8853d7188ce57c6f14db34796a5b05bbf28007d67571b260 (git am on 1c21428 -> same tree)
env_skycity.glb sha256 d3bf7e1d92c74d667796096fc03f68314fa5ed5328736c9611334c4526193564; 1,192,016 -> 1,191,532 B (-484 B, Draco re-encode). Triangles unchanged (palette 24696, foliage 8790) -> .meta NOT changed.
Fixture: only the 2 skycity sha256 pins 1727cfdb -> d3bf7e1d. Fixture triangles NOT rebuilt (they still have the mushroom 2.86 m higher = conservative). GGbot: rebuild with build-fixture.cjs before re-searching lenses.

Coordinates = glb-local (env_skycity), y up. Camera A = /tmp/vid/LA.json (GGbot), converted with journey-scene inv (yaw 241.165°, sOff) from d238881. Plaza focus = anchor_starcourt_center (0,-0.07,30).

## 1. Plaza from A's final lens: NOT FIXED (blocked by constraint)
A final lens (-52.3,-0.2,66.9) is at plaza height (plaza y≈-0.07), so the plaza floor is edge-on. 243 rays to plaza+0.3/1.0/1.5 m (±6 m grid): 211 blocked in 1c21428.
First hits are the plaza's own rim, x -18…-5, z 29…44, y 0…1.4:
- env_sky_static_foliage_cards tris 3393-3397, 3976, 6338, 6460, 6660-6661, 6988-6990, 7453-7557, 8144, 8218-8219, 8428-8429, 8732
- env_sky_ruins tris 5755, 5780, 5808-5822, 5904, 5945-5973, 5987, 6005, 6012, 6027-6068, 6141 (low walls/rubble, x -11.5…-8.8, z 28.9…38)
- env_sky_static_palette tris 15015-15030, 16624-16748 (x -14.2…-5.5, z 35.3…40.3) and a 4.5 m post at x -14.3…-13.5, z 39.7…40.3
Every one of these is inside the real 09 board-background frustum (checked at margin 1.0), so cutting them changes the 09 background. Not done. Lowering anything nearer the lens does not help (no nearer blocker). Options for Grok Bot: allow 09 bg change, or raise A's final lens (plaza needs elevation, not a cut).
(Triangle ids are from the Blender/BVH decode of 1c21428; rc.mjs ids differ.)

## 2. Head/chest at d41-45 with a low lens: FIXED
Low lens = A's lens xz at d41-45, y = her root + 4.5 m (A itself is +6…+11). 150 rays (head 1.5 / 1.3 / chest 1.1 m): 1c21428 122 blocked, now 0. Also 0/150 at +3.5 m and +6 m (base: 115 and 108).
The blocker is the big orange mushroom on the landing island, left of her path: env_sky_static_palette, not rock.
Edit = one rigid vertical move, dy = -2.858 m (no reshaping, colours/UVs unchanged):
- palette verts 16363-16585 (cap, 223 v; bbox before [-49.48,-3.27,64.73]..[-44.63,-0.53,69.66])
- palette verts 16586-16861 (3 stems, 92 v each; x -48.65…-45.45, z 65.6…68.8, y -5…-2.6, now sink into the ground)
- palette 6 small cap-top pieces (verts 20809-20844, 21805-21812, 22189-22200, 22561-22568)
- foliage_cards 64 tufts on the cap (256 verts, ids 1592-…; see tools/rigid_out.json)
(vertex ids = decode order of 1c21428 env_skycity.glb via gltf-transform/draco3dgltf)
Result: the cap top is now ~1.6 m above the ground, a low mushroom dome (cmp *_piece). Route: nearest moved vert ≥3.24 m from her body (0.1–1.6 m) at any route sample; 1 m clearance kept.
Other d41-45 pieces checked: none block once the mushroom is down.
## 09 board check
Board render 1c21428 vs this: day 34 px >8 (max 19/255). Ray-cast puts them all on far city ground (x -17…-4, z -2…25), not on the mushroom: Draco re-encode noise (v4.1 also had 24 px). No edited vertex is in the frustum.
## Suite: 32/37, same as 1c21428 (same 5 known non-journey failures). suite.log
## Images
cmp_day.png / cmp_night.png, top 1c21428, bottom preview: [A final lens 390x844 fov 48] [low lens d41.5] [d43.0] [d44.5] [side view of the mushroom]. Proxy: red cylinder + beige head (≈1.57 m). renders/ also has A's own d41.5/43/44.5 lens (midA*) and board09.
Re-run: node tools/loc.cjs > poses.json; CAMH=4.5 MODE=mid node tools/rc.mjs base.glb tmp.glb rep_mid.json; EXTRA=0.9 node tools/rigid.mjs base.glb rep_mid.json t.glb; node tools/splice.mjs base.glb t.glb out.glb env_sky_static_palette env_sky_static_foliage_cards
