import { createManagedMainlineBinding } from './ManagedMainlineBinding';
/** Pure host seam: pass the same persistent port.journey to both R4 and R5. */
export function openMainlineSession(options: {
  port: any;
  stageId: string;
  seed?: number;
  navigation: { exit: () => any; resume: () => any };
}) {
  const controller = options.port.createController();
  const initial = controller.snapshot();
  if (initial.readOnly) throw Error('Mainline storage requires recovery');
  if (initial.active) {
    // GGbot fix-1: a finished attempt (lost, or won with its completion recorded) is not resumable; start a fresh attempt
    // of the requested stage. An unrecorded win is kept so its save can be retried.
    const finished = initial.active.status === 'lost' || (initial.active.status === 'won' && !!initial.result?.completionRecorded);
    if (initial.active.stageId !== options.stageId || finished) {
      const opened = controller.startStage(options.stageId, { seed: options.seed });
      if (!opened.ok) throw Error('Preserved active mainline attempt: ' + opened.reason);
    }
    // A restored playing attempt stays paused. The view shows an explicit resume.
  } else {
    const opened = controller.startStage(options.stageId, { seed: options.seed });
    if (!opened.ok) throw Error('Mainline start refused: ' + opened.reason);
  }
  return {
    controller,
    binding: createManagedMainlineBinding(options.port, controller, options.navigation),
    snapshot: () => controller.snapshot(),
    requestExit: () => controller.requestExit(),
    resume: () => controller.resume(),
  };
}
