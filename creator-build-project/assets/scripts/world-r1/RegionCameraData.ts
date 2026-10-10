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
export type IslandPoseSource = 'legacy-capsule' | 'temporary-6m' | 'yunjing-final';
export type HomePoseSource = 'legacy-capsule' | 'oi-interim-standing';
export type PoseEntry = AuthoredPose & Readonly<{ characterYawDeg?: number; source: string }>;
export const REGION_CAMERA = {
  version: 2,
  fovAxis: 'vertical',
  islandPoseSource: 'temporary-6m' as IslandPoseSource,
  homePoseSource: 'oi-interim-standing' as HomePoseSource,
  island: {
    variants: {
      'legacy-capsule': { position: [-3.4, 2.3, 6.6], target: [-1.5, 1.05, 4.5], fovVerticalDeg: 45, characterYawDeg: 0,
        source: 'old FirstsliceRoutes.cameraIsland (capsule era); ~2.6 m from character, causes OI-FRAME-002' },
      'temporary-6m': { position: [-5.796, 3.323, 9.352], target: [-2.114, 0.9, 5.281], fovVerticalDeg: 45, characterYawDeg: 0,
        source: 'TEMPORARY 0007 v1.2 composition candidate: legacy direction pulled back to 6 m from exit_path_17 chest point. NOT final.' },
      'yunjing-final': null,
    } as Record<IslandPoseSource, PoseEntry | null>,
  },
  home: {
    variants: {
      'legacy-capsule': { position: [-1.1, 1.8, -2.9], target: [0.35, 0.85, -4.1], fovVerticalDeg: 45, source: 'old FirstsliceRoutes.cameraHome' },
      'oi-interim-standing': { position: [-1.1, 1.5, -2.4], target: [0.1, 0.86, -4.35], fovVerticalDeg: 55,
        source: 'Oi OI-FRAME-001 interim home framing (was written every frame by WorldIntegrationBoot.paintNavigation in e87c409, fov 55)' },
    } as Record<HomePoseSource, PoseEntry | null>,
  },
  /** Debug frameCheck limits (NDC). Follow-up: tighten minY to -0.5 once Oi moves the nav buttons to the bottom 25%. */
  frameLimits: { maxAbsX: 0.7, minY: -0.85, maxY: 0.75 },
  /** Frame-check subject at the island landing point (interim B incl. hat 1.7253 m, ~0.6 m wide). */
  islandCharacter: { root: [-2.1135, 0, 5.2814], heightM: 1.7253, halfWidthM: 0.3 },
  /** Future 0007 drag stops; null = region not open (drag only bounces). */
  stops: [
    { id: 'tide', pose: 'island' },
    // meadow (E4 v1.3.1, GGbot): FINAL pose = Grok Bot art v0.8.1a team/art/outbox-to-dot/20261010T0127Z-grokbot2-meadow_camera_pose-v0.8.1a.json
    // (sha256 12525f15...b3ef; identical copy in team/cinematic/inbox/meadow_camera_pose.json), cross-checked by 运镜bot in team/cinematic/work/meadow-pose-check/
    // (SHA256SUMS c1d1deff..., check_alt_x-4.json): passes at aspect 0.46 and 0.75, character box 0.053 above the bottom button band (NDC y -0.5).
    // Same AuthoredPose form as island 'yunjing-final' (position + target + fovVerticalDeg, up +Y, no rotation). position/target are meadow-root LOCAL
    // (meadow_greybox_v0_8.glb scene_root at the origin); world = local + rootOffset. rootOffset: where the meadow root sits in the region world was NOT FOUND
    // in 0007 code/scenes (no region_meadow bundle, meadow scene or placement code in this project) -> explicit [0, 0, 0]; change it here once the meadow root is placed.
    { id: 'meadow', pose: { position: [-4, 24, 62], target: [0.3151, 3.4577, -0.6059], fovVerticalDeg: 45, rootOffset: [0, 0, 0], status: 'final',
      source: 'Grok Bot meadow_camera_pose v0.8.1a (sha256 12525f15...b3ef); 运镜bot meadow-pose-check: pass 0.46/0.75, 0.053 margin to button band; meadow-root local' } },
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
export function homePoseEntry(): PoseEntry { return pick('home', REGION_CAMERA.home.variants, REGION_CAMERA.homePoseSource, 'legacy-capsule'); }
