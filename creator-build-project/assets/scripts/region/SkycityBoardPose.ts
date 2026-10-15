import type { AuthoredPose } from '../world-r1/CameraPose';
/** Rest world position of anchor_robot_root in env_skycity.glb. The board camera
 * keeps this offset so a floating-island bob does not lose the robot. */
export const SKYCITY_ROBOT_REST: readonly [number, number, number] = [3.6, -0.07, 28.2];
/** Phone portrait 402×874. The eye sits in front of the robot, above the floating rock.
 * The hat and visor fall in the open strip under the debug banner, the watering can
 * stays above the tray, and the cloud layer fills the open ground below it. */
const PORTRAIT: AuthoredPose = { position: [1.26, 20.49, 68.76], target: [3.29, -14.43, 28.57], fovVerticalDeg: 64 };
const LANDSCAPE: AuthoredPose = { position: [48, 28, 150], target: [4, -8, 20], fovVerticalDeg: 52 };
export function skycityBoardPose(aspect: number): AuthoredPose {
  if (!Number.isFinite(aspect) || aspect <= 0) throw Error('Invalid skycity aspect');
  return aspect < 1.1 ? PORTRAIT : LANDSCAPE;
}
export function skycityBoardPoseAt(robot: readonly [number, number, number], aspect: number): AuthoredPose {
  if (robot.length !== 3 || !robot.every(Number.isFinite)) throw Error('Invalid skycity robot anchor');
  const pose = skycityBoardPose(aspect);
  const d = [robot[0] - SKYCITY_ROBOT_REST[0], robot[1] - SKYCITY_ROBOT_REST[1], robot[2] - SKYCITY_ROBOT_REST[2]];
  return {
    position: [pose.position[0] + d[0], pose.position[1] + d[1], pose.position[2] + d[2]],
    target: [pose.target[0] + d[0], pose.target[1] + d[1], pose.target[2] + d[2]],
    fovVerticalDeg: pose.fovVerticalDeg,
  };
}
