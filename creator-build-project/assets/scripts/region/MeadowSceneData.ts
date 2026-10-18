/** Exact camera nodes from GGbot v0.8 GLB, converted to authored position/target/vertical FOV.
 * SHA256 8349b9a8f39203e6eb9bcc6296a9cf55f690cba7e659058223cc4ff0a6afe712.
 * Camera composition is a current asset candidate; device visual acceptance remains open. */
import type { AuthoredPose } from '../world-r1/CameraPose';
export const MEADOW_SCENE_SOURCE = {
  "version": "v0.8.0",
  "zipSHA256": "24a2d186db21c37e310fdf86d7d326b88b0fe95257b1175203a31607b1d727c8",
  "sourceGLBSHA256": "8349b9a8f39203e6eb9bcc6296a9cf55f690cba7e659058223cc4ff0a6afe712",
  "derivedGLBSHA256": "de91dcc3e2860ebdd5fbd02be97e7e141c581be56aab8e2c5044c45e5543d041",
  "windmillSeconds": 8,
  "windPeriodSeconds": 4,
  "nodeCount": 67,
  "meshCount": 23,
  "grassInstances": 1000,
  "flowerInstances": 150
} as const;
const PORTRAIT: AuthoredPose = {"position": [9, 19, 42], "target": [0.3274661665889038, 5.509406509325702, -15.81687522999821], "fovVerticalDeg": 49.42635311494791};
const LANDSCAPE: AuthoredPose = {"position": [-24, -2.977158308029175, 9], "target": [-11.797898652545943, 9.497561769919479, -48.40635941040094], "fovVerticalDeg": 45.747329879468886};
export function meadowScenePose(aspect:number): AuthoredPose {
 if(!Number.isFinite(aspect)||aspect<=0)throw Error('Invalid meadow aspect');
 return aspect < 1.1 ? PORTRAIT : LANDSCAPE;
}
