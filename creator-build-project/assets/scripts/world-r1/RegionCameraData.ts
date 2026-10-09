/**
 * 0007 v1.2 camera pose DATA table (mirror of the regionCamera.json schema; no logic here).
 * Switching to 运镜bot's final island pose is a data-only change:
 *   1) fill island.variants['yunjing-final'] from island_camera_pose.json (Cocos coordinates),
 *   2) set islandPoseSource = 'yunjing-final'.
 * fovVerticalDeg replaces the old fovDeg field. `target` is authoring-only; CameraPose.fromLookAt converts it once.
 */
import type { LookAtPose } from './CameraPose';
export type IslandPoseSource = 'legacy-capsule' | 'temporary-6m' | 'yunjing-final';
export type HomePoseSource = 'legacy-capsule' | 'oi-interim-standing';
export type PoseEntry = LookAtPose & Readonly<{ characterYawDeg?: number; source: string }>;
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
export function homePoseEntry(): PoseEntry { return pick('home', REGION_CAMERA.home.variants, REGION_CAMERA.homePoseSource, 'legacy-capsule'); }
