/** Robot clips share one skeleton. Ambient sky_ambient_loop is a different clip and may keep looping. */
export const ROBOT_IDLE = 'robot_idle';
export const ROBOT_GESTURES = ['robot_watering', 'robot_give_flower'] as const;
export type RobotGestureName = typeof ROBOT_GESTURES[number];
export function exclusiveRobot(gesture: string | null): { loop: typeof ROBOT_IDLE; once: RobotGestureName | null } {
  if (gesture === 'robot_watering' || gesture === 'robot_give_flower') return { loop: ROBOT_IDLE, once: gesture };
  return { loop: ROBOT_IDLE, once: null };
}
