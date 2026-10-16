# Build05 08→09 skycity ground detail v2 (Voice Bot) — on GGbot a373227

Art-only edit of env_skycity.glb: crossed-card grass tufts (existing foliage atlas) → env_sky_static_foliage_cards;
low-poly stones + flat 7-gon green colour-variation patches (+3 cm, existing palette cells) → env_sky_static_palette.
No new texture/material/mesh/node/meta; all other GLB bufferViews byte-identical to Build05.

Two deterministic passes (seed from tag, density VB_DENSITY=2.5/m², visible ≤22 m from the lens):
  mid  = light-green platforms seen from the bridge, route d 13.5–35 m
  late = platform/deck seen during sky-deck + arrival, d 35–46 m (incl. the low arrival focus lens)
Rules: ≥1.0 m horizontal clearance from every route sample (0.25 m CSV resample); nothing inside the 09 board-background
frustum (skycityVisitPose, aspects 9:19.5…2.2, 1.35× margin); nothing in front of the character's screen box; nothing
<1.5 m from a lens.

Re-run when the route changes (CSV = GGbot route-height-08-09.csv, uses sky_local_* = glb-local columns; city yaw is a
rigid transform so the heading-frame camera is evaluated in glb-local space identically; c2.py mirrors
JOURNEY_CAMERA/journeyCamera @a373227 incl. focus on anchor_starcourt_center — update CAM if those constants change):
  blender -b --python gen2.py -- <Build05 env_skycity.glb> route.csv 13.5 <bridgeEnd> mid add_mid.json
  blender -b --python gen2.py -- <Build05 env_skycity.glb> route.csv <bridgeEnd> <end> late add_late.json add_mid.json
  python3 cat_add.py add_all.json add_mid.json add_late.json
  node merge.mjs base.glb add_all.json tmp.glb && node splice.mjs base.glb tmp.glb out.glb env_sky_static_foliage_cards env_sky_static_palette
  (npm: @gltf-transform/core@4 @gltf-transform/extensions@4 draco3dgltf@1.5.6). base.glb must be the ORIGINAL Build05 glb.
