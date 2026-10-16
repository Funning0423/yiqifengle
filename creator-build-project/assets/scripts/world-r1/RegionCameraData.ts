/**
 * 0007 v1.2 camera pose DATA table (mirror of the regionCamera.json schema; no logic here).
 * Switching to 运镜bot's final island pose is a data-only change:
 *   1) fill island.variants['yunjing-final'] from island_camera_pose.json (Cocos coordinates),
 *   2) set islandPoseSource = 'yunjing-final'.
 * v1.3 contract: every authored pose = position + target + fovVerticalDeg (ALL mandatory, Cocos world metres).
 * rotation is never authored; it is derived with fromLookAt(up=+Y, roll 0) and transitions interpolate position/target.
 * fovVerticalDeg replaces the old fovDeg field.
 */
import type { AuthoredPose } from './CameraPose';
export type IslandPoseSource = 'legacy-capsule' | 'temporary-6m' | 'yunjing-final' | 'v23-wide' | 'v23-girl' | 'v24-readable';
export type HomePoseSource = 'legacy-capsule' | 'oi-interim-standing' | 'sitting-room' | 'corner-all-four';
export type PoseEntry = AuthoredPose & Readonly<{ characterYawDeg?: number; source: string }>;
export const REGION_CAMERA = {
  version: 2,
  fovAxis: 'vertical',
  islandPoseSource: 'v24-readable' as IslandPoseSource,
  /** Arrival framing. Stable island view stays on islandPoseSource; arrival close-up remains unchanged. */
  characterPoseSource: 'v23-girl' as IslandPoseSource,
  homePoseSource: 'sitting-room' as HomePoseSource,
  island: {
    variants: {
      'legacy-capsule': { position: [-3.4, 2.3, 6.6], target: [-1.5, 1.05, 4.5], fovVerticalDeg: 45, characterYawDeg: 0,
        source: 'old FirstsliceRoutes.cameraIsland (capsule era); ~2.6 m from character, causes OI-FRAME-002' },
      'temporary-6m': { position: [-5.796, 3.323, 9.352], target: [-2.114, 0.9, 5.281], fovVerticalDeg: 45, characterYawDeg: 0,
        source: 'TEMPORARY 0007 v1.2 composition candidate: legacy direction pulled back to 6 m from exit_path_17 chest point. NOT final.' },
      'yunjing-final': { position: [-15.5, 9, 14], target: [-2, 2.5, 1], fovVerticalDeg: 60, characterYawDeg: 0,
        source: '运镜bot exit-cam-v2 2026-10-15 candidate: pitch -30, y 15.5 (suite end height), fov 70, island ~47% H (lighthouse top to beach), lighthouse+hut centred (ref FUNNING-exit-final-frame-ref.png). Funning pick pending. Kept unchanged as the B5 end pose.' },
      // art/island/v2.3-cursor-cam/island_camera_wide.json (CAM-01). Position+target+fov only; rotation is derived.
      'v23-wide': { position: [-49.6623, 26.7215, 56.2639], target: [-2.1535, -4.5424, 3.7359], fovVerticalDeg: 42, characterYawDeg: 0,
        source: 'island_camera_wide.json sha256 32e289e6854b057e1498ab86938ba045b0d92e4a171b363ff31b3216d71b028b' },
      // Exterior-only composition: a more frontal +Z view reveals character, door and beach without scaling terrain.
      'v24-readable': { position: [-12, 15.5, 48], target: [1, .5, 1], fovVerticalDeg: 42, characterYawDeg: 0,
        source: '2026-10-11 exterior readability candidate; actual O geometry proxy audited. Native HUD/transition acceptance pending.' },
      // art/island/v2.3-cursor-cam/island_camera_girl.json (CAM-02). No character scale.
      'v23-girl': { position: [3.7149, 2.9395, 12.8396], target: [-2.9587, 1.4228, 4.9526], fovVerticalDeg: 38, characterYawDeg: 0,
        source: 'island_camera_girl.json sha256 7921d477415707789209ef51adcc8dc91b093e67dd99df8503fbd4962c784309' },
    } as Record<IslandPoseSource, PoseEntry | null>,
  },
  home: {
    variants: {
      'legacy-capsule': { position: [-1.1, 1.8, -2.9], target: [0.35, 0.85, -4.1], fovVerticalDeg: 45, source: 'old FirstsliceRoutes.cameraHome' },
      'oi-interim-standing': { position: [-1.1, 1.5, -2.4], target: [0.1, 0.86, -4.35], fovVerticalDeg: 55,
        source: 'Oi OI-FRAME-001 interim home framing (was written every frame by WorldIntegrationBoot.paintNavigation in e87c409, fov 55)' },
      // User-approved 2026-10-10 room/window portrait, pulled back only 0.10 m. Original actor route and transition timing stay unchanged.
      'sitting-room': { position: [-1.32022071, 1.38613379, -2.11374307], target: [0.04, 1.22, -4.45], fovVerticalDeg: 75,
        source: 'Approved rear-room-profile-e composition, 10 cm pullback. True arch/sea/palm. Static camera clearance 7.87 cm; native transition/HUD review required.' },
      // T2+ CANDIDATE, NOT ACTIVE: the only lens volume in the existing room (CPU search over decoded GLB, LOS-checked)
      // that frames seated girl + chair + front arched window + door at once in 586x1266 portrait. Needs fov 92 > CAMERA_FIXED.maxFov 75
      // (pose would be rejected) and is a high back-wall angle (pitch -38), not a 3/4 side shot. Lead decision pending.
      'corner-all-four': { position: [0.3, 2.35, -4.95], target: [0.8430, 0.8108, -3.0563], fovVerticalDeg: 92,
        source: 'T2+ 运镜bot 2026-10-11 homesearch2 best (clearance 0.27 m, girl 45% H, door 12/20 + window 12 samples visible). Requires maxFov change.' },
    } as Record<HomePoseSource, PoseEntry | null>,
  },
  /** Debug frameCheck limits (NDC). Follow-up: tighten minY to -0.5 once Oi moves the nav buttons to the bottom 25%. */
  frameLimits: { maxAbsX: 0.7, minY: -0.85, maxY: 0.75 },
  /** Frame-check subject at the island landing point (interim B incl. hat 1.7253 m, ~0.6 m wide). */
  islandCharacter: { root: [-2.1135, 0, 5.2814], heightM: 1.7253, halfWidthM: 0.3 },
  /** Future 0007 drag stops; null = region not open (drag only bounces). */
  stops: [
    { id: 'tide', pose: 'island' },
    { id: 'meadow', pose: null },
    { id: 'sky', pose: null },
  ],
} as const;

function pick<K extends string>(kind: string, variants: Record<K, PoseEntry | null>, wanted: K, fallback: K): PoseEntry {
  const v = variants[wanted];
  if (v) return v;
  console.warn(`[0007] ${kind} pose source "${wanted}" has no data yet; falling back to "${fallback}"`);
  const f = variants[fallback]; if (!f) throw Error(`[0007] ${kind} fallback pose "${fallback}" missing`); return f;
}
export function islandPoseEntry(): PoseEntry { return pick('island', REGION_CAMERA.island.variants, REGION_CAMERA.islandPoseSource, 'temporary-6m'); }
export function characterPoseEntry(): PoseEntry { return pick('character', REGION_CAMERA.island.variants, REGION_CAMERA.characterPoseSource, 'v23-girl'); }
export function homePoseEntry(): PoseEntry { return pick('home', REGION_CAMERA.home.variants, REGION_CAMERA.homePoseSource, 'legacy-capsule'); }

/** Camera-only clearance correction against combined_visual_m.glb sha256 7777f80c… .
 * Original actor roots, targets, FOVs, key progress and transition durations stay unchanged.
 * The original -X offset crossed the stair/wall; a uniform 0.5–0.7 m shift also cropped the body.
 * These positions retain the same room side and route. Guard keys avoid straight-line wall/stair cuts.
 * Blender mesh/render checks are diagnostic; native Cocos/HUD acceptance is still required. */
export const INTERIOR_CAMERA_CLEARANCE = {
  followPositions: [
    [-1.788817, 1.6, -4.100484],
    [-1.783123, 1.8, -3.500552],
    [-1.244974, 1.6, -3.032838],
    [-1.222318, 1.6, -2.151880],
    [-1.244438, 1.6, -1.806574],
  ],
  homeGuard: { position: [-0.8, 1.8, -2.9], progress: 0.5 },
  doorGuards: [
    { position: [-0.40, 1.62, -0.65], progress: 0.35 },
    { position: [-0.42, 1.6275, 0.12], progress: 0.55 },
  ],
  outsidePosition: [-1.28, 1.65, 1.6],
} as const;

/** T2/T3a (运镜bot, 2026-10-11): transition camera keys. DATA only; FirstsliceRoutes turns each key into a look-at pose
 * whose target is the girl's controller root at the key's walk progress + targetHeight (m). Designed by
 * tools/camera-frame-test against the Blender room/door/exterior meshes: every sampled frame keeps hat, feet and a
 * 0.6 m body box inside the NO-HUD safe area of a 586x1266 portrait screen (top = capsule bottom + 4% H, bottom/side
 * 4%) with >= 2.5% spare, lens >= 0.15 m from any surface except at the approved cameraHome (0.079 m), and clear line
 * of sight to head/chest/feet. Rollback: set enabled=false (pre-T2 linear tracks, keys and timings come back unchanged). */
export const TRANSITION_CAMERA = Object.freeze({
  enabled: true,
  version: 'T2-T3a-2026-10-11',
  keys: {
    ST1:{position:[-1.1,1.75,-2.9],targetHeight:1.05,fovVerticalDeg:72},
    R1:{position:[-0.533,1.6,0.822],targetHeight:1.0,fovVerticalDeg:73},
    R2:{position:[-0.37,1.5,-0.1],targetHeight:1.0,fovVerticalDeg:73},
    R3:{position:[-0.34,1.52,-1.0],targetHeight:1.0,fovVerticalDeg:70},
    G:{position:[-1.137,1.795,-3.121],targetHeight:1.08,fovVerticalDeg:71.9},
    D0:{position:[-1.934,1.82,-3.55],targetHeight:0.8,fovVerticalDeg:67.2},
    D1:{position:[-1.786,1.799,-3.503],targetHeight:1.137,fovVerticalDeg:71.5},
    D2:{position:[-1.212,1.665,-3.08],targetHeight:0.91,fovVerticalDeg:71.8},
    D3:{position:[-1.135,1.7,-2.675],targetHeight:1.141,fovVerticalDeg:71},
    D4:{position:[-1.214,1.694,-2.307],targetHeight:1.024,fovVerticalDeg:68},
    X1:{position:[-0.647,1.498,-1.448],targetHeight:0.978,fovVerticalDeg:69.2},
    X2:{position:[-0.4,1.454,-1.2],targetHeight:0.879,fovVerticalDeg:71.6},
    O:{position:[-0.353,1.394,-0.923],targetHeight:1.065,fovVerticalDeg:71.9},
    I1:{position:[0.174,1.15,0.115],targetHeight:1.064,fovVerticalDeg:55},
    T2:{position:[0.226,1.152,-0.256],targetHeight:0.806,fovVerticalDeg:60.2},
    OR:{position:[-0.287,1.537,-1.584],targetHeight:1,fovVerticalDeg:70.1},
    C1:{position:[-0.053,1.549,-1.353],targetHeight:0.966,fovVerticalDeg:67.8},
    C2:{position:[0.154,1.884,-1.411],targetHeight:0.945,fovVerticalDeg:67.3},
    C3:{position:[0.842,1.696,-1.721],targetHeight:1.007,fovVerticalDeg:68.8},
    IR:{position:[1.338,1.532,-1.515],targetHeight:0.933,fovVerticalDeg:72},
    S1:{position:[1.89,1.562,-1.926],targetHeight:1.044,fovVerticalDeg:70.5},
    S2:{position:[1.864,1.588,-2.044],targetHeight:0.98,fovVerticalDeg:69.3},
    S3:{position:[1.902,1.563,-2.459],targetHeight:0.979,fovVerticalDeg:67.2},
    S4:{position:[1.76,1.611,-2.17],targetHeight:0.968,fovVerticalDeg:71.5},
    S5:{position:[0.953,1.604,-1.57],targetHeight:1.032,fovVerticalDeg:72},
    S6:{position:[0.016,1.549,-1.699],targetHeight:1.038,fovVerticalDeg:71.7}
  } as Record<string, { position: [number, number, number]; targetHeight: number; fovVerticalDeg: number }>,
  /** Ease windows are fractions of the move's duration (C2 remap, see CameraPose.remapProgress). */
  tracks: {
    homeToDoor: { interpolation: 'pchip', easeIn: .3, easeOut: .3 },
    standTurn: { interpolation: 'pchip', easeIn: .35, easeOut: .12 },
    toDoor: { interpolation: 'pchip', easeIn: .15, easeOut: .15 },
    outbound: { interpolation: 'pchip', easeIn: .02, easeOut: .11 },
    inbound: { interpolation: 'pchip', easeIn: .35, easeOut: .08 },
    toSeat: { interpolation: 'pchip', easeIn: .2, easeOut: .2 },
  },
  /** T5 room-light weight w over walk progress (linear rig blend, 2462ce4): ~0 well before restore() on the island,
   *  back to 1 before the door closes. Driven by WorldFlowCore.roomLightRamp from the camera segment's walk. */
  lighting: { toIsland: { from: 1, to: 0, start: 0, end: .5 }, toThreshold: { from: 0, to: 1, start: .45, end: 1 } },
  /** R3 (GGbot, Mac r3 "回家时女孩全黑"): exterior key k over toThreshold walk progress (RoomLightingRig "R3 exterior key").
   *  The authored sun lights +Z faces; walking home she faces -Z, towards the lens, and was lit by ambient only until the w
   *  ramp. k mirrors the sun's yaw across the house axis (same elevation/illuminance) while the crane looks DOWN on her
   *  (walk progress .02-.22 = pitch about -40 to -78 deg; she faces the lens from ~.26), so the swing never plays on a
   *  frontal view. Rollback: delete this entry (authored sun until the w ramp, the r3 look). */
  exteriorKey: { toThreshold: { from: 0, to: 1, start: .02, end: .22 } },
  /** T2+ stand-up + turn: ONE move cameraHome -> (dolly back to medium, at fraction `mid` of stand+turn) -> D0. */
  standTurn: { mid: .5, key: 'ST1' },
  /** T2+ exterior rail: lens beside the walk at `distance` m on `side` of the walk tangent (+1 right / -1 left; outbound
   *  seaward = -1), `lead` m ahead along the tangent, `height` m above the root; target `look` m ahead at targetHeight
   *  (look > 0 keeps her on the trailing third line). Keys are generated by FirstsliceRoutes.railPose at each progress. */
  /** T2+ crossing-out end key (rail form on outCrossing at progress 1): behind her in the doorway. */
  crossOutEnd: { progress: 1, side: -1, distance: -0.1, height: 1.519, lead: -1.902, look: 0.466, targetHeight: 0.943, fovVerticalDeg: 69.541 } as RailKey,
  /** Exit arc (replaces the swing-then-dolly-then-crane railOut). After the doorway the lens turns, dollies back
   *  and rises together (crane.pace.depart): one curve swings to a bearing just in front of her while the radius
   *  and the height grow, then continues to cameraIsland. railOutSide below is the old side-rail rollback, not this move. */
  railOut: [] as RailKey[],
  /** Lens-clearance reroute (Mac round 2 / lens_rays.cjs): the frontal + hold-end keys were raised so the lens no longer passes
   *  0.47 m from the ~2 m shrub in env_island_props_merged (x -4.4..-3.25, z 2.4..3.9) during the hold. Previous values:
   *  frontal { progress 0.408, distance 0.828, height 1.984, lead 3.142, look 0.093, targetHeight 1.191, fov 52.77 },
   *  hold end { progress 0.538, distance 2.022, height 1.884, lead 4.782, look -0.104, targetHeight 1.146, fov 48.738 }, crane.startProgress 0.538. */
  /** Pre-swing side rail (rollback: copy into railOut, crane.startProgress 0.354933, settleSeconds 3.48131, crossOutEnd
   *  { distance 0.649, height 1.6, lead -2.25, look 0.399, targetHeight 1, fov 72 }). */
  railOutSide: [{ progress: 0.15, side: -1, distance: 0.994, height: 2.173, lead: -1.319, look: 0.063, targetHeight: 1.001, fovVerticalDeg: 61.591 }, { progress: 0.3, side: -1, distance: 3.765, height: 2.634, lead: -0.641, look: 0.031, targetHeight: 1, fovVerticalDeg: 58 }, { progress: 0.354933, side: -1, distance: 4.246, height: 3.19, lead: -0.103, look: 0.079, targetHeight: 1, fovVerticalDeg: 49.636 }] as RailKey[],
  /** T2+ return rail (palm-avoidance, mirrors the outbound frontal language): after the crane-down the lens is AHEAD of
   *  her on the landward side (between her and the door) - the old 3.5 m landward key put the lens inside
   *  env_prop_palm_tall_01's canopy. Old: { progress 0.42, side 1, distance 3.5, height 2.78, lead 1.723, look 0.1,
   *  targetHeight 1, fov 58 }, craneDown.endProgress 0.42, leadSeconds 1.2. */
  railIn: [{ progress: 0.42, side: 1, distance: 1.478, height: 2.2, lead: 3, look: 0, targetHeight: 1.1, fovVerticalDeg: 58.298 }] as RailKey[],
  /** T2+ return door approach: absolute keys (TRANSITION_CAMERA.keys) at toThreshold progress, after railIn. */
  railInDoor: [{ key: 'R1', progress: .6 }, { key: 'R2', progress: .72 }, { key: 'R3', progress: .86 }] as ReadonlyArray<{ key: string; progress: number }>,
  /** T2+ exit arc: one motion from the doorway pose (crossOutEnd) to cameraIsland, reached `settleSeconds` after she
   *  stops. paceOutbound fillets off the door tangent onto an orbit shifted through the opening: aimDeg is the
   *  seaward bearing in front of her, radial grows the distance, climb raises the lens, all on that one curve.
   *  handle / lead are the cubic that continues that same arc to cameraIsland. Rotation, dolly-back and the
   *  lift overlap on that arc. blendMetres stays as a non-negative tune (the portal tangents are fixed).
   *  paceOutbound plays that arc at cruiseMps after the doorway, on the walk-distance clock the game
   *  actually plays (the island stop is slower than 0.7 m/s, so the middle of the same walkDuration is
   *  faster than the span's time clock). rampSeconds is the smoothstep off the doorway follow (about
   *  1 m/s) onto that cruise: short, then flat. It is not a one-second run from about 1.4 m/s up to 9.
   *  settleSeconds is the time after she stops, chosen so that distance clock's flat cruise is cruiseMps
   *  rather than the doorway gear or a faster overshoot. Outbound ease-in is a short leave from rest
   *  before the door; ease-out is only the landing brake, onto cameraIsland near height 15.5.
   *  frontalDeg: wind reaches 1 the first time the lens is within this many
   *  degrees of her facing, and stays 1 while it remains within holdMaxDeg (same arc, not a later phase). She does not wait. */
  crane: { settleSeconds: 22,
    pace: { sampleMetres: 0.05, rampSeconds: 1.03, cruiseMps: 7,
      depart: { turn: 1, straightM: 0.45, rayMps: 1.15, blendMetres: 0.5, aimDeg: 22, radial: 1.55, climb: 1.35, seconds: 7.4, handle: 8, lead: [0.34, 0.67, 0.34] as [number, number, number] },
      chest: 1.05, frontalDeg: 20, holdMaxDeg: 36,
      /** B5 (运镜bot 2026-10-16, Funning rejected B4: mid-way surge + abrupt lift). Follow her at walking pace, then ONE
       *  minimum-jerk (smootherstep) rise from her right to cameraIsland; all seconds after the doorway key. */
      /* Rollback to B4: delete this b5 entry (depart above is the B4 arc). */
      b5: { smoothSeconds: 0.45, followIn: 1.2, sideDelay: 1.2, sideIn: 3.6, riseAt: 1.2, side: 2.0, back: 2.0, height: 1.8, look: 0.2, targetHeight: 0.68, fovVerticalDeg: 73, matchSeconds: 1.2, turnShare: 1, heightShare: 0.52, cruiseRamp: 0.15, cartesian: 1, cruiseRampIn: 0.3, nudge: { at: 4.8, width: 4.5, up: 0.35 } } } },
  /** T2+ wind strength (outbound only; WorldFlowComponent.getWindStrength). 0 indoors -> `base` as she steps over the
   *  door sill (outCrossing progress doorProgress) -> held to toIsland progress swingStart -> rises to exactly 1 when
   *  the exit arc first faces her -> held while she stays in front -> eases to exactly 0 when the camera settles on
   *  cameraIsland. Smoothstep between these keys on the camera track's eased progress. */
  windOut: { doorProgress: 0.12, base: 0.15, swingStart: 0 },
  /** T2+ doorway-clean (lead B): seen from the island the open doorway showed the whole cluttered interior. Props stay put;
   *  the door drifts (wind) to islandDeg after she has walked clear and reopens before she walks back in, so the island and
   *  frontal/crane/return frames show a warm half-opening (a chair + the rug) instead of the whole room. islandDeg picked from
   *  offline renders of 86.4/45/30/20 (30 = floor sliver only, 20 reads closed). Rollback: delete this entry (door stays at openDeg). */
  doorDrift: { islandDeg: 86.4, closeAfter: 1.2, closeSeconds: 2.6, openBefore: 4.1, openSeconds: 2.4 },
  /** T2+ return entry (Funning, Mac round 3: "进门/关门那一下像切机位"). Old: the crossing-in move swung the lens 1.6 m to the
   *  right of the doorway (C1..IR, up to 2.1 m/s / 57 deg/s), STOPPED dead for the 1 s door close, then a new track hovered
   *  at the right wall (S1..S3) and whipped 3.2 m back behind her to cameraHome (S4..S6, up to 1.73 m/s / 68 deg/s): three
   *  separate set-ups. New: ONE move from the doorway key OR through crossing-in, the door close, the walk to the seat and the
   *  sit, continuing the return span (no stop at the threshold or the door): the lens backs into the room ahead of her on the
   *  right, lets her pass at the right wall while panning with her, then arcs once behind her (left, never back) and lands
   *  on cameraHome while she sits. Keys: seg = cross (inCrossing walk progress) | door (door-close time fraction, she stands
   *  at entrance_point) | seat (toSeat walk progress) | sit (turn + sit_down time fraction); target = her root at that
   *  moment + targetHeight (sit: seated root). The last key is always cameraHome (appended by the route builder). Keys are
   *  placed on the span clock so the lens is where she is (route remapProgress). doorCloseFraction: the leaf closes
   *  (smoothstep) from 0.1 to this fraction of the door segment. Rollback: enabled=false (old C1..IR / stop / S1..S6 moves). */
  entry: {
    enabled: true,
    doorSeconds: 1.0,
    doorCloseFraction: 0.9,
    keys: [
      { seg: 'cross', progress: 0.5, position: [0.15, 1.56, -2.05], targetHeight: 1.0, fovVerticalDeg: 70 },
      { seg: 'cross', progress: 1.0, position: [0.75, 1.58, -2.35], targetHeight: 0.98, fovVerticalDeg: 70 },
      { seg: 'door', progress: 1.0, position: [1.22, 1.58, -2.55], targetHeight: 0.98, fovVerticalDeg: 72 },
      { seg: 'seat', progress: 0.25, position: [1.66, 1.58, -2.55], targetHeight: 0.97, fovVerticalDeg: 73 },
      { seg: 'seat', progress: 0.5, position: [1.86, 1.6, -2.3], targetHeight: 0.97, fovVerticalDeg: 73 },
      { seg: 'seat', progress: 0.75, position: [1.3, 1.6, -1.75], targetHeight: 1.0, fovVerticalDeg: 71 },
      { seg: 'seat', progress: 1.0, position: [0.3, 1.55, -1.65], targetHeight: 1.0, fovVerticalDeg: 72 },
      { seg: 'sit', progress: 0.5, position: [-0.7, 1.45, -1.85], targetHeight: 0.95, fovVerticalDeg: 74 },
    ] as EntryKey[],
  },
  /** T2+ return crane-down: cameraIsland -> rail by toThreshold progress endProgress; starts leadSeconds before her turn.
   *  positions (optional, steps-1 entries): authored lens positions for the intermediate crane keys (target/fov still from
   *  the spherical crane). Gull keep-out (Mac round 3 night, video 41.7 s = sim ~26.0-26.3 s: a dark wing swept a corner):
   *  the generated keys descended through y 9..6.6 at 4.3-5.9 m from the orbit centre (0, -2.65) of the GLB idle_loop gull
   *  env_anim_seagull_fly_01_v22 (6 m radius, y 6.6-8.1 incl. wings; _02: 8 m, y 7.8-9.0) and passed 0.54 m from its swept
   *  envelope. The gull's clip phase is not tied to the flow clock, so the lens must clear the WHOLE orbit: these keys reach
   *  the column above her path before dropping, inside the ring (min 2.48 m from either swept orbit, no frustum ray meets it within 2.5 m; key 1 stays
   *  high/out so the descent's peak acceleration is <= 14.4 m/s^2 also with the accel/chained walk profiles).
   *  Generated (rollback: delete positions): [-3.38,11.04,3.89], [-2.56,7.34,1.33], [-1.96,4.36,0.24]. */
  craneDown: { endProgress: 0.42, steps: 4, leadSeconds: 1.6, positions: [[-3.1, 11.6, 2.6], [-1.7, 7.8, -0.3], [-1.75, 4.4, 0]] as Array<[number, number, number]> },
  /** Mac r4 return FOLLOW (Funning 2026-10-11: "从外面回到灯塔的时候，镜头就一直跟随着人就好了，等他坐下的时候再把机位回归到最初
   *  进入游戏的那个机位" + "人从外面回到房间的时候画面不能一亮一暗"). Replaces railIn/railInDoor/entry.keys (the lens no longer backs
   *  into the room ahead of her, overtakes her at the right wall and swings back): when enabled the route builder generates
   *  - crane-down: cameraIsland -> the follow rig at toThreshold progress craneEnd (spherical about her root, craneSteps keys);
   *  - follow rig: the lens trails her OWN path `distance` m behind her (so it goes through the doorway where she did, never
   *    beside or ahead of her), `height` m up; target = her root + targetHeight, `look` m ahead along her path. Path smoothed
   *    over `smoothing` m (no kinks at path vertices); keys every keySpacing m of her walk. out/in values blend (smoothstep)
   *    over her arclength [blend[0], blend[1]] m around the point where SHE crosses the door plane;
   *  - she does not stop at the entrance any more (entry.doorSeconds 0): the leaf closes behind the lens (smoothstep over
   *    doorClose.seconds, starting when the LENS is doorClose.lensInside m inside the door plane: door-drift >= 1.0 m rule),
   *    layers go HOME when it is shut;
   *  - room light: the unchanged T5 walk ramps (interiorLighting.toThreshold / crossIn, linear in her walk) take w 0 -> 1
   *    from roomLight.before m short of the door plane to the end of her crossing, and the R3 exterior key is not run
   *    (cameraEntry.noExteriorKey: the lens sees her back, lit by the authored sun). Measured (Blender, same rig state):
   *    the old k swing gave -0.15 then +0.09 mean brightness on the walk home; now the doorway passage stays within 0.03;
   *  - sit: one move from the last follow key to cameraHome over turn + the runtime sit_down settle (actionSettleSeconds).
   *  Rollback: enabled=false (entry.keys one-move entry of 17eaaf5 comes back unchanged). */
  returnFollow: {
    enabled: true,
    craneEnd: 0.4,
    craneSteps: 4,
    out: { distance: 2.3, height: 1.95, targetHeight: 0.86, look: 0, fovVerticalDeg: 60 },
    in: { distance: 1.9, height: 1.85, targetHeight: 0.87, look: 0, fovVerticalDeg: 66 },
    blend: [-1.2, 1.4] as [number, number],
    keySpacing: 0.25,
    smoothing: 0.6,
    /** room light w ramps (T5 walk ramps, linear in her walk) from `before` m short of the door plane to the end of her
     *  crossing; the exterior key is not run (cameraEntry.noExteriorKey). */
    roomLight: { before: 2.5 },
    doorClose: { lensInside: 1.05, seconds: 2.4 },
    /** the lens eases to rest over her last `settle` m (C1 soft stop, it stops settle/2 m short of pure trailing). */
    settle: 1.2,
    /** time-domain ease of the whole return move (s): crane start from rest / landing on cameraHome. */
    easeInSeconds: 4.0,
    easeOutSeconds: 1.2,
  },
});
export type EntryKey = Readonly<{ seg: 'cross' | 'door' | 'seat' | 'sit'; progress: number; position: [number, number, number]; targetHeight: number; fovVerticalDeg: number }>;
export type RailKey = Readonly<{ progress: number; side: 1 | -1; distance: number; height: number; lead: number; look: number; targetHeight: number; fovVerticalDeg: number; frontal?: boolean }>;
