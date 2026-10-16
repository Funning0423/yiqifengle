/**
 * Island → meadow sailboat transition clock.
 * Frame numbers, fades and the scene-swap point all come from the timing JSON.
 * No engine imports: node tests drive this directly.
 *
 * Audio slots (GameAudio plays them; a missing cine file is not fatal):
 *   region_island / audio_cine/sfx_transition_island_to_meadow — one-shot from the first frame
 *   audio_amb/amb_wind_soft_loop — meadow wind bed. It takes over when a cloud hold
 *   fades the sting out, when a skip fades it out, and when a normal run finishes.
 *   The bed stays up after the handoff. The sting is faded, not cut.
 */
export const SAILBOAT_TIMING_RESOURCE = 'cine/transition_island_to_meadow.timing';
export const SAILBOAT_CINE_FILE = 'audio_cine/sfx_transition_island_to_meadow.mp3';
export const SAILBOAT_CINE_PATH = 'audio_cine/sfx_transition_island_to_meadow';
export const SAILBOAT_CINE_BUNDLE = 'region_island';
/**
 * Cloud-hold sting guard (Mac r4: an 80 ms fade on a 9 ms hold cut the sting for good).
 * The sting keeps playing for the first SAILBOAT_HOLD_FADE_DELAY_SEC of a hold; only a hold
 * that lasts longer fades it, over SAILBOAT_HOLD_FADE_SEC. Leaving the hold before that fade
 * has finished restores the sting. Skip uses the timing file's skipFadeSec instead.
 */
export const SAILBOAT_HOLD_FADE_DELAY_SEC = 0.25;
export const SAILBOAT_HOLD_FADE_SEC = 0.4;
export const SAILBOAT_HOLD_WIND_PATH = 'audio_amb/amb_wind_soft_loop';

export interface SailboatShot {
  id: string;
  startFrame: number;
  endFrame: number;
  durationSec: number;
}
export interface SailboatVec3 { readonly 0: number; readonly 1: number; readonly 2: number }
export interface SailboatTiming {
  clip: string;
  fps: number;
  lastFrame: number;
  frameCount: number;
  durationSec: number;
  shots: SailboatShot[];
  skipEnabledFromFrame: number;
  skipFadeSec: number;
  skipLandingFrame: number;
  cloud: { inStartFrame: number; fullFrom: number; fullTo: number; outEndFrame: number };
  sceneSwapFrame: number;
  preloadFromFrame: number;
  holdCoverIfNotLoaded: boolean;
  hudHidden: readonly [number, number];
  endPose: { position: SailboatVec3; target: SailboatVec3; fovVerticalDeg: number; easeOutSec: number };
}

export type SailboatPhase = 'playing' | 'holding' | 'skip-fade' | 'skip-hold' | 'done';
export interface SailboatView {
  frame: number;
  shotId: string;
  phase: SailboatPhase;
  /** Authored cloud wipe, 0..1. Full while the cover is holding. */
  cloud: number;
  /** Skip dip-to-white, 0..1. */
  white: number;
  scene: 'island' | 'meadow';
  hudVisible: boolean;
  holding: boolean;
  swapped: boolean;
  /** 0 = island start pose, 1 = provisional departure dolly (S2). */
  departure: number;
  /** 0 = meadow arrival under the clouds, 1 = authored end pose. */
  meadowBlend: number;
  fov: number;
  boatSpace: 'island' | 'meadow';
  /** 0 = dock / just-arrived, 1 = at sea (island) or docked (meadow). */
  boatAlong: number;
  preload: boolean;
  paused: boolean;
}
export type SailboatAudioCommand =
  | { kind: 'cine-play'; path: string; bundle: string }
  | { kind: 'cine-pause'; path: string }
  | { kind: 'cine-resume'; path: string }
  | { kind: 'cine-fade'; path: string; seconds: number }
  | { kind: 'cine-restore'; path: string }
  | { kind: 'cine-stop'; path: string }
  | { kind: 'wind-loop'; path: string }
  | { kind: 'wind-fade'; path: string; seconds: number }
  | { kind: 'wind-stop'; path: string };
/** meadowReady is the warmed meadow (hidden frames done), not a bare prefab load. */
export interface SailboatInput { meadowReady?: boolean; tap?: boolean; background?: boolean }
export interface SailboatSample { view: SailboatView; commands: SailboatAudioCommand[] }

function fail(message: string): never { throw Error('sailboat timing: ' + message); }
function num(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(name + ' must be a finite number');
  return value;
}
function frame(value: unknown, name: string): number {
  const n = num(value, name);
  if (!Number.isInteger(n) || n < 0) fail(name + ' must be a non-negative integer frame');
  return n;
}
function vec3(value: unknown, name: string): SailboatVec3 {
  if (!Array.isArray(value) || value.length !== 3) fail(name + ' must be a 3-vector');
  return [num(value[0], name), num(value[1], name), num(value[2], name)] as unknown as SailboatVec3;
}

/** Parse a timing document. Every threshold below is read from the file. */
export function parseSailboatTiming(raw: unknown): SailboatTiming {
  if (!raw || typeof raw !== 'object') fail('document is not an object');
  const doc = raw as Record<string, unknown>;
  const events = doc.events;
  if (!events || typeof events !== 'object') fail('events missing');
  const ev = events as Record<string, unknown>;
  const fps = num(doc.fps, 'fps');
  if (fps <= 0) fail('fps must be positive');
  const lastFrame = frame(doc.lastFrame, 'lastFrame');
  const frameCount = frame(doc.frameCount, 'frameCount');
  const durationSec = num(doc.durationSec, 'durationSec');
  if (frameCount !== lastFrame + 1) fail('frameCount must be lastFrame + 1');
  if (Math.abs(durationSec - lastFrame / fps) > 1e-6) fail('durationSec must be lastFrame / fps');
  const shotsRaw = ev.shots;
  if (!Array.isArray(shotsRaw) || shotsRaw.length === 0) fail('shots missing');
  const shots: SailboatShot[] = shotsRaw.map((item, index) => {
    if (!item || typeof item !== 'object') fail('shot ' + index);
    const s = item as Record<string, unknown>;
    const id = s.id;
    if (typeof id !== 'string' || !id) fail('shot ' + index + ' id');
    const startFrame = frame(s.startFrame, id + '.startFrame');
    const endFrame = frame(s.endFrame, id + '.endFrame');
    const shotDuration = num(s.durationSec, id + '.durationSec');
    if (endFrame <= startFrame) fail(id + ' endFrame must be after startFrame');
    if (Math.abs(shotDuration - (endFrame - startFrame) / fps) > 1e-6) fail(id + ' durationSec does not match frames');
    return { id, startFrame, endFrame, durationSec: shotDuration };
  });
  for (let i = 0; i < shots.length; i++) {
    if (i === 0) { if (shots[i].startFrame !== 0) fail('first shot must start at frame 0'); }
    else if (shots[i].startFrame !== shots[i - 1].endFrame) fail('shots must be contiguous');
  }
  if (shots[shots.length - 1].endFrame !== lastFrame) fail('last shot must end on lastFrame');
  const cloudRaw = ev.cloudCover;
  if (!cloudRaw || typeof cloudRaw !== 'object') fail('cloudCover missing');
  const c = cloudRaw as Record<string, unknown>;
  const cloud = {
    inStartFrame: frame(c.inStartFrame, 'cloud.inStartFrame'),
    fullFrom: frame(c.fullFrom, 'cloud.fullFrom'),
    fullTo: frame(c.fullTo, 'cloud.fullTo'),
    outEndFrame: frame(c.outEndFrame, 'cloud.outEndFrame'),
  };
  if (!(cloud.inStartFrame <= cloud.fullFrom && cloud.fullFrom <= cloud.fullTo && cloud.fullTo <= cloud.outEndFrame && cloud.outEndFrame <= lastFrame)) {
    fail('cloud cover frames must be ordered inside the clip');
  }
  const sceneSwapFrame = frame(ev.sceneSwapFrame, 'sceneSwapFrame');
  if (sceneSwapFrame < cloud.fullFrom || sceneSwapFrame > cloud.fullTo) fail('scene swap must sit inside the full cloud cover');
  const skipEnabledFromFrame = frame(ev.skipEnabledFromFrame, 'skipEnabledFromFrame');
  if (skipEnabledFromFrame > lastFrame) fail('skip window starts after the clip');
  const skipFadeSec = num(ev.skipFadeSec, 'skipFadeSec');
  if (skipFadeSec < 0) fail('skipFadeSec must be >= 0');
  const landing = ev.skipLanding;
  if (!landing || typeof landing !== 'object') fail('skipLanding missing');
  const skipLandingFrame = frame((landing as Record<string, unknown>).frame, 'skipLanding.frame');
  if (skipLandingFrame !== lastFrame) fail('skip must land on lastFrame');
  const preloadFromFrame = frame(ev.preloadMeadowFromFrame, 'preloadMeadowFromFrame');
  if (preloadFromFrame > lastFrame) fail('preload frame is outside the clip');
  if (typeof ev.holdCoverIfNotLoaded !== 'boolean') fail('holdCoverIfNotLoaded must be boolean');
  const hudRaw = ev.hudHiddenFrames;
  if (!Array.isArray(hudRaw) || hudRaw.length !== 2) fail('hudHiddenFrames must be [start, end]');
  const hudHidden: [number, number] = [frame(hudRaw[0], 'hudHiddenFrames[0]'), frame(hudRaw[1], 'hudHiddenFrames[1]')];
  if (hudHidden[0] > hudHidden[1] || hudHidden[1] > lastFrame) fail('hud hidden range is outside the clip');
  const endRaw = ev.cameraEndPose;
  if (!endRaw || typeof endRaw !== 'object') fail('cameraEndPose missing');
  const end = endRaw as Record<string, unknown>;
  const endPose = {
    position: vec3(end.position, 'cameraEndPose.position'),
    target: vec3(end.target, 'cameraEndPose.target'),
    fovVerticalDeg: num(end.fovVerticalDeg, 'cameraEndPose.fovVerticalDeg'),
    easeOutSec: num(end.easeOutSec, 'cameraEndPose.easeOutSec'),
  };
  if (endPose.fovVerticalDeg <= 0) fail('end fov must be positive');
  if (endPose.easeOutSec < 0) fail('easeOutSec must be >= 0');
  const clip = doc.clip;
  if (typeof clip !== 'string' || !clip) fail('clip name missing');
  return {
    clip, fps, lastFrame, frameCount, durationSec, shots,
    skipEnabledFromFrame, skipFadeSec, skipLandingFrame, cloud, sceneSwapFrame,
    preloadFromFrame, holdCoverIfNotLoaded: ev.holdCoverIfNotLoaded, hudHidden, endPose,
  };
}

export function parseSailboatTimingText(text: string): SailboatTiming {
  return parseSailboatTiming(JSON.parse(text));
}

function shotAt(timing: SailboatTiming, frameIndex: number): SailboatShot {
  for (let i = 0; i < timing.shots.length; i++) {
    const shot = timing.shots[i];
    if (frameIndex >= shot.startFrame && frameIndex < shot.endFrame) return shot;
    if (frameIndex === shot.endFrame && shot.endFrame === timing.lastFrame) return shot;
  }
  return timing.shots[timing.shots.length - 1];
}
function shotProgress(shot: SailboatShot, frameIndex: number): number {
  const span = shot.endFrame - shot.startFrame;
  if (span <= 0) return 1;
  const u = (frameIndex - shot.startFrame) / span;
  return u < 0 ? 0 : u > 1 ? 1 : u;
}
function findPrefix(timing: SailboatTiming, prefix: string): SailboatShot | null {
  for (let i = 0; i < timing.shots.length; i++) if (timing.shots[i].id.startsWith(prefix)) return timing.shots[i];
  return null;
}
function cloudAt(timing: SailboatTiming, frameIndex: number): number {
  const c = timing.cloud;
  if (frameIndex <= c.inStartFrame) return 0;
  if (frameIndex < c.fullFrom) return (frameIndex - c.inStartFrame) / (c.fullFrom - c.inStartFrame);
  if (frameIndex <= c.fullTo) return 1;
  if (frameIndex < c.outEndFrame) return 1 - (frameIndex - c.fullTo) / (c.outEndFrame - c.fullTo);
  return 0;
}
function hudOn(timing: SailboatTiming, frameIndex: number): boolean {
  return frameIndex < timing.hudHidden[0] || frameIndex > timing.hudHidden[1];
}
function easeOutCubic(t: number): number { const u = t < 0 ? 0 : t > 1 ? 1 : t; return 1 - Math.pow(1 - u, 3); }
function blendSettle(u: number, easeFrac: number): number {
  const start = 0.5;
  const cruise = 1 - easeFrac;
  if (easeFrac <= 0) return start + (1 - start) * u;
  const cruiseEnd = start + (1 - start) * (1 - easeFrac);
  if (u <= cruise) return cruise <= 0 ? start : start + (cruiseEnd - start) * (u / cruise);
  const k = easeOutCubic((u - cruise) / easeFrac);
  return cruiseEnd + (1 - cruiseEnd) * k;
}

export function sailboatCoverAlpha(view: SailboatView): number {
  if (view.phase === 'done') return 0;
  return view.cloud > view.white ? view.cloud : view.white;
}

/**
 * Frames the meadow must actually render under a full cloud bank before the cover may open.
 * Frame 1 compiles pipelines; frame 2 is the first lit result. Neither is shown.
 */
export const SAILBOAT_WARM_FRAMES = 2;
export function meadowRevealReady(warmFrames: number): boolean {
  return warmFrames >= SAILBOAT_WARM_FRAMES;
}

/**
 * Start gate: frame 0 is "the first frame after the exit camera settles on the island final pose".
 * (The r3 "sting 1.8 s early" reading was a recorder audio-alignment artifact; re-aligned it was ~0.1 s.
 * The gate stays as the guarantee of the timing file's frame-0 definition.) The playback (sting + countdown) begins only once the live camera has
 * held still for `stillFrames` consecutive rendered frames, each of them no longer than `maxFrameDt`.
 * `timeoutSec` is the fallback so a camera that never settles still gets a transition.
 */
export const SAILBOAT_START_STILL_FRAMES = 3;
export const SAILBOAT_START_MAX_FRAME_DT = 0.05;
export const SAILBOAT_START_TIMEOUT_SEC = 3;
export const SAILBOAT_START_POS_EPS = 0.002;
export const SAILBOAT_START_DIR_EPS = 0.0005;
/** Per-frame dt cap for the timeline. 0.1 s silently stretched heavy (night) frames; substeps stay 1/30. */
export const SAILBOAT_MAX_FRAME_DT = 0.25;
export interface SailboatCameraSample { position: readonly number[]; forward: readonly number[] }
export interface SailboatStartGate { feed(dt: number, camera: SailboatCameraSample | null): boolean; readonly open: boolean; readonly waitedSec: number; readonly reason: string }
export function createSailboatStartGate(options?: { stillFrames?: number; maxFrameDt?: number; timeoutSec?: number }): SailboatStartGate {
  const need = options?.stillFrames ?? SAILBOAT_START_STILL_FRAMES;
  const maxDt = options?.maxFrameDt ?? SAILBOAT_START_MAX_FRAME_DT;
  const timeout = options?.timeoutSec ?? SAILBOAT_START_TIMEOUT_SEC;
  let last: SailboatCameraSample | null = null;
  let still = 0;
  let waited = 0;
  let open = false;
  let reason = 'waiting';
  return {
    get open() { return open; },
    get waitedSec() { return waited; },
    get reason() { return reason; },
    feed(dt: number, camera: SailboatCameraSample | null): boolean {
      if (open) return true;
      const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
      waited += step;
      if (camera && last) {
        const dp = Math.hypot(camera.position[0] - last.position[0], camera.position[1] - last.position[1], camera.position[2] - last.position[2]);
        const df = Math.hypot(camera.forward[0] - last.forward[0], camera.forward[1] - last.forward[1], camera.forward[2] - last.forward[2]);
        if (dp <= SAILBOAT_START_POS_EPS && df <= SAILBOAT_START_DIR_EPS && step > 0 && step <= maxDt) still++;
        else still = 0;
      } else still = 0;
      last = camera ? { position: [camera.position[0], camera.position[1], camera.position[2]], forward: [camera.forward[0], camera.forward[1], camera.forward[2]] } : null;
      if (still >= need) { open = true; reason = 'settled'; }
      else if (waited >= timeout) { open = true; reason = 'timeout'; }
      return open;
    },
  };
}

type CineState = 'idle' | 'playing' | 'paused' | 'fading' | 'stopped';

export interface SailboatPlayback {
  begin(): SailboatSample;
  advance(dt: number, input?: SailboatInput): SailboatSample;
}

export function createSailboatPlayback(timing: SailboatTiming, options?: { startFov?: number }): SailboatPlayback {
  const startFov = options && Number.isFinite(options.startFov) ? options.startFov as number : timing.endPose.fovVerticalDeg;
  const endFov = timing.endPose.fovVerticalDeg;
  let elapsed = 0;
  let phase: SailboatPhase = 'playing';
  let skipT = 0;
  let swapped = false;
  let wind = false;
  let cine: CineState = 'idle';
  let paused = false;
  let started = false;
  let holdT = 0;
  let holdFadeT = -1;

  const frameNow = () => frameAt(elapsed);
  function frameAt(seconds: number): number {
    if (seconds <= 0) return 0;
    const index = Math.floor(seconds * timing.fps + 1e-4);
    return index >= timing.lastFrame ? timing.lastFrame : index;
  }
  function presentation(frameIndex: number): Pick<SailboatView, 'departure' | 'meadowBlend' | 'fov' | 'boatAlong'> {
    const s2 = findPrefix(timing, 'S2');
    const s4 = findPrefix(timing, 'S4');
    const s5 = findPrefix(timing, 'S5');
    let departure = 0;
    if (s2) departure = frameIndex >= s2.endFrame ? 1 : frameIndex >= s2.startFrame ? shotProgress(s2, frameIndex) : 0;
    let meadowBlend = 0;
    if (s5 && frameIndex >= s5.startFrame) {
      const easeFrac = s5.durationSec > 0 ? Math.min(1, timing.endPose.easeOutSec / s5.durationSec) : 1;
      meadowBlend = blendSettle(shotProgress(s5, frameIndex), easeFrac);
    } else if (s4 && frameIndex >= s4.startFrame) meadowBlend = 0.5 * shotProgress(s4, frameIndex);
    if (phase === 'done' || phase === 'skip-hold') meadowBlend = 1;
    let fov = endFov;
    if (s2 && frameIndex < s2.startFrame) fov = startFov;
    else if (s2 && frameIndex < s2.endFrame) fov = startFov + (endFov - startFov) * shotProgress(s2, frameIndex);
    let boatAlong = 0;
    if (!swapped) boatAlong = departure;
    else if (phase === 'done' || phase === 'skip-hold') boatAlong = 1;
    else if (s4 && frameIndex >= s4.startFrame && (!s5 || frameIndex < s5.startFrame)) boatAlong = shotProgress(s4, frameIndex);
    else if (s5 && frameIndex >= s5.startFrame) boatAlong = 1;
    return { departure, meadowBlend, fov, boatAlong };
  }
  function view(): SailboatView {
    const frameIndex = phase === 'done' ? timing.skipLandingFrame : frameNow();
    const shot = shotAt(timing, frameIndex);
    const pose = presentation(frameIndex);
    const holding = phase === 'holding' || phase === 'skip-hold';
    let cloud = cloudAt(timing, frameIndex);
    let white = 0;
    if (phase === 'skip-fade') {
      white = timing.skipFadeSec <= 0 ? 1 : Math.min(1, skipT / timing.skipFadeSec);
    } else if (phase === 'skip-hold') { cloud = 1; white = 1; }
    else if (phase === 'done') { cloud = 0; white = 0; }
    return {
      frame: frameIndex, shotId: shot.id, phase, cloud, white,
      scene: swapped || phase === 'done' ? 'meadow' : 'island',
      hudVisible: phase === 'done' ? hudOn(timing, timing.skipLandingFrame) : hudOn(timing, frameIndex),
      holding, swapped: swapped || phase === 'done',
      departure: pose.departure, meadowBlend: pose.meadowBlend, fov: pose.fov,
      boatSpace: swapped || phase === 'done' ? 'meadow' : 'island',
      boatAlong: phase === 'done' ? 1 : pose.boatAlong,
      preload: frameIndex >= timing.preloadFromFrame,
      paused,
    };
  }
  function windOn(commands: SailboatAudioCommand[]) {
    if (wind) return;
    wind = true;
    commands.push({ kind: 'wind-loop', path: SAILBOAT_HOLD_WIND_PATH });
  }
  function windFade(commands: SailboatAudioCommand[]) {
    if (!wind) return;
    wind = false;
    commands.push({ kind: 'wind-fade', path: SAILBOAT_HOLD_WIND_PATH, seconds: timing.skipFadeSec });
  }
  function windStop(commands: SailboatAudioCommand[]) {
    if (!wind) return;
    wind = false;
    commands.push({ kind: 'wind-stop', path: SAILBOAT_HOLD_WIND_PATH });
  }
  function cineTo(next: CineState, commands: SailboatAudioCommand[], fadeSec?: number) {
    if (cine === next || cine === 'stopped' && next !== 'stopped') return;
    if (next === 'paused' && cine !== 'playing') return;
    if (next === 'playing' && cine !== 'paused') return;
    if (next === 'fading' && cine !== 'playing' && cine !== 'paused') return;
    cine = next;
    if (next === 'paused') commands.push({ kind: 'cine-pause', path: SAILBOAT_CINE_PATH });
    else if (next === 'playing') commands.push({ kind: 'cine-resume', path: SAILBOAT_CINE_PATH });
    else if (next === 'fading') commands.push({ kind: 'cine-fade', path: SAILBOAT_CINE_PATH, seconds: fadeSec ?? timing.skipFadeSec });
    else if (next === 'stopped') commands.push({ kind: 'cine-stop', path: SAILBOAT_CINE_PATH });
  }
  function enterHold(commands: SailboatAudioCommand[]) {
    elapsed = timing.sceneSwapFrame / timing.fps;
    if (phase !== 'holding') phase = 'holding';
    holdT = 0;
    holdFadeT = -1;
    windOn(commands);
  }
  function tickHold(step: number, commands: SailboatAudioCommand[]) {
    holdT += step;
    if (holdFadeT >= 0) { holdFadeT += step; return; }
    if (holdT > SAILBOAT_HOLD_FADE_DELAY_SEC + 1e-9 && cine === 'playing') {
      cineTo('fading', commands, SAILBOAT_HOLD_FADE_SEC);
      holdFadeT = 0;
    }
  }
  function leaveHold(commands: SailboatAudioCommand[]) {
    swapped = true;
    if (phase === 'holding') phase = 'playing';
    if (holdFadeT >= 0 && cine === 'fading') {
      if (holdFadeT < SAILBOAT_HOLD_FADE_SEC - 1e-9) {
        cine = 'playing';
        commands.push({ kind: 'cine-restore', path: SAILBOAT_CINE_PATH });
      } else cine = 'stopped';
    }
    holdFadeT = -1;
  }
  function land(commands: SailboatAudioCommand[]) {
    phase = 'done';
    elapsed = timing.durationSec;
    swapped = true;
    windOn(commands);
  }

  return {
    begin(): SailboatSample {
      if (started) fail('playback already started');
      started = true;
      cine = 'playing';
      return { view: view(), commands: [{ kind: 'cine-play', path: SAILBOAT_CINE_PATH, bundle: SAILBOAT_CINE_BUNDLE }] };
    },
    advance(dt: number, input?: SailboatInput): SailboatSample {
      if (!started) fail('begin() before advance()');
      const commands: SailboatAudioCommand[] = [];
      const ready = !!input?.meadowReady;
      const background = !!input?.background;
      const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
      if (background && !paused) {
        paused = true;
        cineTo('stopped', commands);
        windStop(commands);
      } else if (!background && paused) {
        paused = false;
        if ((phase === 'holding' || phase === 'skip-hold') && !swapped) windOn(commands);
      }
      if (paused || phase === 'done') return { view: view(), commands };
      const tap = !!input?.tap && (phase === 'playing' || phase === 'holding');
      if (tap && frameNow() >= timing.skipEnabledFromFrame) {
        phase = 'skip-fade';
        skipT = 0;
        cineTo('fading', commands, timing.skipFadeSec);
        windOn(commands);
      }
      if (phase === 'skip-fade') {
        skipT += step;
        if (timing.skipFadeSec <= 0 || skipT >= timing.skipFadeSec - 1e-9) {
          // Stay shut on this sample. Landing in the same advance drops the cover
          // before the meadow camera has drawn a frame.
          phase = 'skip-hold';
          swapped = true;
        }
      } else if (phase === 'skip-hold') {
        if (ready) land(commands);
      } else if (phase === 'holding') {
        if (ready) leaveHold(commands);
        else tickHold(step, commands);
      }
      if (phase === 'playing') {
        const swapAt = timing.sceneSwapFrame / timing.fps;
        const next = Math.min(timing.durationSec, elapsed + step);
        if (!swapped && timing.holdCoverIfNotLoaded && !ready && elapsed < swapAt && next >= swapAt - 1e-9) enterHold(commands);
        else {
          elapsed = next;
          if (!swapped && ready && frameNow() >= timing.sceneSwapFrame) swapped = true;
          if (elapsed >= timing.durationSec - 1e-9) land(commands);
        }
      }
      return { view: view(), commands };
    },
  };
}
