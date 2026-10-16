/**
 * Exit cinematic sound (Voice Bot B5.3 convention, GGbot 2026-10-16).
 * - sfx_exit_outbound starts on frame 0 of the exit shot: the flow enters 'standing' (leaveHome).
 * - Skip (explicit skip(), or the exit is cancelled / fails / is disposed before 'island'):
 *   0.3 s fade, same as the sailboat sting skip, and WindAudio.releaseExitDuck().
 * - Background (Game.EVENT_HIDE / wx.onHide): stop at once and releaseExitDuck().
 * - Natural end ('island'): nothing. The file fades itself to 0 by frame 599.
 * Pure state machine; WorldFlowComponent applies the commands. No Cocos import.
 */
export const EXIT_AUDIO_PATH = 'audio_cine/sfx_exit_outbound';
export const EXIT_AUDIO_BUNDLE = 'region_island';
export const EXIT_AUDIO_SKIP_FADE_S = 0.3;
export const EXIT_AUDIO_STATES: readonly string[] = ['standing', 'turning-out', 'walking-out', 'opening-door', 'crossing-out'];

export type ExitAudioCommand =
  | { kind: 'play'; path: string; bundle: string }
  | { kind: 'fade'; seconds: number }
  | { kind: 'stop' }
  | { kind: 'release-duck' };

export interface ExitAudioCue {
  /** Feed every flow state change. */
  state(next: string): ExitAudioCommand[];
  /** Explicit skip of the exit shot. */
  skip(): ExitAudioCommand[];
  /** Game went to the background. */
  background(): ExitAudioCommand[];
  readonly playing: boolean;
}

export function createExitAudioCue(): ExitAudioCue {
  let prev = '';
  let playing = false;
  const exiting = (s: string) => EXIT_AUDIO_STATES.indexOf(s) >= 0;
  const end = (cmd: ExitAudioCommand): ExitAudioCommand[] => { if (!playing) return []; playing = false; return [cmd, { kind: 'release-duck' }]; };
  return {
    state(next: string) {
      const was = prev; prev = next;
      if (next === 'standing' && !exiting(was)) { playing = true; return [{ kind: 'play', path: EXIT_AUDIO_PATH, bundle: EXIT_AUDIO_BUNDLE }]; }
      if (!playing || exiting(next)) return [];
      if (next === 'island') { playing = false; return []; }
      return end({ kind: 'fade', seconds: EXIT_AUDIO_SKIP_FADE_S });
    },
    skip() { return end({ kind: 'fade', seconds: EXIT_AUDIO_SKIP_FADE_S }); },
    background() { return end({ kind: 'stop' }); },
    get playing() { return playing; },
  };
}
