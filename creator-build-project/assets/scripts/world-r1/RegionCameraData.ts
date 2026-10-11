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
export type HomePoseSource = 'legacy-capsule' | 'oi-interim-standing' | 'sitting-room';
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
      'yunjing-final': null,
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
    G:{position:[-1.137,1.795,-3.121],targetHeight:1.08,fovVerticalDeg:71.9},
    D0:{position:[-1.954,1.823,-3.567],targetHeight:0.8,fovVerticalDeg:67.2},
    D1:{position:[-1.786,1.799,-3.503],targetHeight:1.137,fovVerticalDeg:71.5},
    D2:{position:[-1.212,1.635,-3.08],targetHeight:0.91,fovVerticalDeg:71.8},
    D3:{position:[-1.135,1.7,-2.675],targetHeight:1.141,fovVerticalDeg:71},
    D4:{position:[-1.214,1.694,-2.307],targetHeight:1.024,fovVerticalDeg:68},
    X1:{position:[-0.647,1.498,-1.448],targetHeight:0.978,fovVerticalDeg:69.2},
    X2:{position:[-0.4,1.454,-1.2],targetHeight:0.879,fovVerticalDeg:71.6},
    O:{position:[-0.353,1.394,-0.923],targetHeight:1.065,fovVerticalDeg:71.9},
    I1:{position:[0.174,1.15,0.115],targetHeight:1.064,fovVerticalDeg:55},
    T2:{position:[0.226,1.152,-0.256],targetHeight:0.806,fovVerticalDeg:60.2},
    OR:{position:[-0.287,1.537,-1.584],targetHeight:1,fovVerticalDeg:70.1},
    C1:{position:[0.1,1.549,-1.251],targetHeight:0.966,fovVerticalDeg:67.8},
    C2:{position:[0.628,1.61,-1.409],targetHeight:0.983,fovVerticalDeg:63.5},
    C3:{position:[1.13,1.557,-1.621],targetHeight:0.977,fovVerticalDeg:62.6},
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
    toDoor: { interpolation: 'pchip', easeIn: .15, easeOut: .15 },
    outbound: { interpolation: 'pchip', easeIn: .08, easeOut: .15 },
    inbound: { interpolation: 'pchip', easeIn: .1, easeOut: .08 },
    toSeat: { interpolation: 'pchip', easeIn: .2, easeOut: .2 },
  },
  /** Interior lighting weight (1 = room rig, 0 = exterior) over walk progress, smoothstep. */
  lighting: { toIsland: { from: 1, to: 0, start: 0, end: .5 }, toThreshold: { from: 0, to: 1, start: .45, end: 1 } },
});
