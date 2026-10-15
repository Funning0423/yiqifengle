import type { AuthoredPose } from '../world-r1/CameraPose';
/** Rest world position of anchor_robot_root in env_skycity.glb. The board camera
 * keeps this offset so a floating-island bob does not lose the robot. */
export const SKYCITY_ROBOT_REST: readonly [number, number, number] = [3.6, -0.07, 28.2];
/** Phone portrait 402×874. The eye is in front of the robot, close enough that the
 * hat brim, the visor, and the watering can are separate shapes. The hat and visor
 * sit above the goal chips, the can sits in the gap above the tray, and the cloud
 * sea stays in the open area below the tray. */
const PORTRAIT: AuthoredPose = { position: [1.3, 17.87, 62], target: [3.29, -12.13, 28.57], fovVerticalDeg: 46 };
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
