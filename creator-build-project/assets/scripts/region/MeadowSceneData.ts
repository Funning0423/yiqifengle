/** Exact camera nodes from GGbot v0.8 GLB, converted to authored position/target/vertical FOV.
 * SHA256 8349b9a8f39203e6eb9bcc6296a9cf55f690cba7e659058223cc4ff0a6afe712.
 * Camera composition is a current asset candidate; device visual acceptance remains open. */
import type { AuthoredPose } from '../world-r1/CameraPose';
export const MEADOW_SCENE_SOURCE = {
  "version": "v0.8.0",
  "zipSHA256": "24a2d186db21c37e310fdf86d7d326b88b0fe95257b1175203a31607b1d727c8",
  "sourceGLBSHA256": "8349b9a8f39203e6eb9bcc6296a9cf55f690cba7e659058223cc4ff0a6afe712",
  "derivedGLBSHA256": "ab3f6e552cdfab624f64cf1abefa3316740ef0d08d309f0e7366948d04fb9321",
  "windmillSeconds": 8,
  "windPeriodSeconds": 4,
  "nodeCount": 67,
  "meshCount": 23,
  "grassInstances": 1000,
  "flowerInstances": 150
} as const;
/** Phone portrait: the match board covers the middle, so the windmill sits in the open
 * sky above it and the near path and grass sit in the open ground below it.
 * Vertical FOV stays the authored CAM_map_portrait value. Node names and this pose are unchanged. */
const PORTRAIT: AuthoredPose = { position: [0, 24, 45], target: [0, 4, 4], fovVerticalDeg: 49.42635311494791 };
const LANDSCAPE: AuthoredPose = {"position": [-24, -2.977158308029175, 9], "target": [-11.797898652545943, 9.497561769919479, -48.40635941040094], "fovVerticalDeg": 45.747329879468886};
export function meadowScenePose(aspect:number): AuthoredPose {
 if(!Number.isFinite(aspect)||aspect<=0)throw Error('Invalid meadow aspect');
 return aspect < 1.1 ? PORTRAIT : LANDSCAPE;
}
