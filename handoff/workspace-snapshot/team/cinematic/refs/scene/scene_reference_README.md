# dot firstslice scene candidate v0.1

Status: isolated, geometry-preserving candidate. Not a final art approval, Cocos import result, physical-contact result or phone test.

## Integrator entry point
- Use `combined_visual_m.glb` once for the indoor-to-island first slice. It already includes interior and exterior. Do not also load `interior_visual_m.glb` (that is a standalone diagnostic alternative).
- `combined_editable_m.blend` is the editable matching source candidate, Blender 4.5.14 LTS, Z-up. GLB is Y-up in metres; conversion is (x,y,z)game = (x,z,-y)Blender. Preserve root identity and original coordinates.
- `combined_anchors_m.json` provides exact node paths and column-major world matrices. Skin mesh roots remain scene-root siblings exactly as original; `scene_root` groups unskinned roots and skeleton parents. Do not apply an additional global scale without validating all skin bounds and skeletons.
- `combined_collision_proxies.json` contains the 14 interior/door proxy geometries removed from render attachments. Bind by matching node name/path; door leaf must follow its moving door, not stay at the rest-world matrix. Instantiate appropriate engine colliders; do not render proxy mesh geometry.
- `exterior_collision_sources/` contains two unchanged original GLBs totaling 8 exterior collision groups. These were absent from the combined visual source GLB and must be imported separately if physics is needed. Groups may contain many disconnected convex pieces; never turn an entire group into one convex hull. Use a reviewed compound/static-mesh representation. Shore barrier is optional. Physics import is untested.

## Small corrections only
1. Added distinct `seat_back` empty at the original upper-back-rail centreline, game position (0.6419572842, 0.8620187793, -4.1118570843). It is a geometry reference; body/clothing contact remains unvalidated. Chair mesh and seat height were not changed.
2. Added explicit `scene_root` with identity transform and documented skin-root mapping.
3. Corrected stale door-handle ring_radius_m .016 to centreline radius .07; tube radius .012. Source door mesh metadata and independent geometry measurement agree (.07000136 radial midpoint; .012 depth half-extent). No handle geometry moved.
4. Removed render attachments from all `col_*`, from the interior-only preview floor skirt, and from the 1.626m height placeholder. Preserved original mesh/buffer data for provenance, so validator may report unused objects. The .blend copies remove preview/placeholders and hide collision objects from rendering.
5. Original GLB mesh, materials, skins, animations, accessors and bufferViews are unchanged; binary payloads byte-identical. Original GLB node world matrices remain exactly identical. Editable .blend mesh position/topology/UV hashes unchanged; parenting roundoff is at most 1.5e-7m.

## Units and contact caution
- Metres are environment delivery convention only. Old CommonR2 GU conversion is metre coordinates x1.415282392026578, inverse 0.7065727699530516m/GU; this is not B-character calibration. Legacy conversion docstring in the original package reverses the explanation; its actual code applies the multiplier.
- B source measurement from character work is 1.532279 source units shoe-to-head, 1.625857 including hat. Do not force .blend body proportions or silently fit the environment using hat height.
- Seat world position is (.4203,.38,-4.2133), yaw -2rad; seat width .494600939m, depth .381549296m. The character diagnostic used a different seat and does not prove this chair fits.
- Door hinge is +X at (.7202203274,0,0), opening +Y rotation outward to +Z, angle86.4deg source, max105deg candidate. Left-open means viewed from inside. Camera passes the character's right and opposite the door swept volume; current package does not prove runtime camera clearance.
- Only controlled locomotion-capsule filtering during sit/stand may be considered. Never globally disable hand/skirt/apron chair contact. Preserve root-motion ownership in the controller.
- Return-path start and exit-path end differ by about .003m. Do not force exact equality or rename semantics silently.

## Verification
- Original archives: interior198/198 manifest entries, exterior234/234, meadow19/19 hashes passed; ZIP CRC and path safety passed.
- Candidate combined/interior GLBs: Khronos glTF Validator2.0.0-dev.3.10, 0errors/0warnings. Unused-object informational messages reflect preserved non-rendered original mesh data.
- Actual .blend candidates open and render in Blender4.5.14 with auto-execution disabled. Same-camera before/after render comparison is in evidence. This is a technical comparison render, not a relighting proposal or quality reference replacing Grok previews.
- No Cocos compilation/import, target-phone performance, character chair/door reach, cloth contact or audio acceptance yet.

## Other scene status
Meadow v0.8.0 is separately preserved and hash-verified. It uses EXT_mesh_gpu_instancing, 1,150 instances, custom _ROOT_COLOR/_DRIFT and COLOR_0 as wind data. Generic PBR/import fallback may change appearance or omit vegetation. Core validator cannot validate the instancing extension. Entry preview currently shows windmill/bells but not the river; camera-only review candidate is the next bounded option. No board_safe_zone anchor was found. No current sky-city package was found in the authorized art folder or sky/whitebox filename lookup.

Original art authors/credits: Grok Bot and Voice Bot, retained in provenance. Latest meadow credits GGbot. All frozen Drive source ZIPs remain unchanged.
