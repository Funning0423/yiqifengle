/** Voice Bot r4 exit footsteps: live steps on the character's real foot plants (home room -> doorstep -> island path,
 *  and the walk back). Created by WorldIntegrationBoot once the flow-reference stand-in exists, fed every world state
 *  and ticked in Boot.lateUpdate (after WorldFlowComponent.update advanced the character this frame).
 *  - Which frame: FootstepCore.FootstepTracker observes the stand-in's motion clock (read-only) and fires each plant
 *    of FOOTSTEP_PLANTS (derived offline from the shipped character GLB) whose clip time was crossed (+ STEP_LEAD_S).
 *  - Which surface: FOOTSTEP_GROUND (0.1 m map of the shipped room/island GLB) under the planted sole.
 *  - How: GameAudio.play(step_<surface>_<n>, STEP_GAIN x +-1.5 dB). play() drops it when muted, sfx-muted, hidden or
 *    interrupted, so nothing is queued and nothing bursts on return; the tracker keeps following the clock meanwhile.
 *  Clips: region_island/audio_steps (20 x ~1.4 KB mono mp3), loaded on 'home' (before she stands up). */
import { assetManager, AudioClip } from 'cc';
import { GameAudio, qfAudioLog } from './GameAudio';
import { FootstepTracker, StepGround, StepVariantPicker, STEP_ASSETS, STEP_STATES, footPoint, StepClock, StepSurface } from './FootstepCore';

export type FootstepSourceSample = { clock: StepClock | null; x: number; z: number; yaw: number };

export class FootstepAudio {
  private tracker = new FootstepTracker();
  private ground: StepGround | null = null;
  private picker = new StepVariantPicker();
  private state = '';
  private loading = false;
  private loaded = false;
  private disposed = false;
  private log: Array<{ clip: string; bone: string; surface: StepSurface; name: string; volume: number; played: boolean }> = [];
  constructor(private source: () => FootstepSourceSample | null) { }

  onWorldState(state: string) {
    if (this.disposed) return;
    this.state = state;
    if (state === 'home' || STEP_STATES.indexOf(state) >= 0) this.load();
  }

  tick(dt: number) {
    if (this.disposed) return;
    let s: FootstepSourceSample | null = null;
    if (STEP_STATES.indexOf(this.state) >= 0) { try { s = this.source(); } catch { s = null; } }
    if (!s || !s.clock) { this.tracker.reset(); return; }
    const hits = this.tracker.observe(s.clock, dt);
    if (!hits.length) return;
    const audio = GameAudio.instance;
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i], p = footPoint(s.x, s.z, s.yaw, h);
      if (!this.ground) this.ground = new StepGround();
      const surface = this.ground.surfaceAt(p[0], p[1]), v = this.picker.pick(surface);
      const played = !!audio && audio.hasClip(v.name);
      try { audio?.play(v.name, v.volume); } catch (e) { console.warn('[FootstepAudio] play failed', String(e)); }
      this.log.push({ clip: h.clip, bone: h.bone, surface, name: v.name, volume: +v.volume.toFixed(3), played });
      if (this.log.length > 40) this.log.shift();
      qfAudioLog('step', { clip: h.clip, bone: h.bone, surface, name: v.name, volume: +v.volume.toFixed(3), loaded: played, state: this.state });
    }
  }

  private load() {
    if (this.loaded || this.loading) return;
    this.loading = true;
    const done = (err: any, list: AudioClip[] | null) => {
      this.loading = false;
      if (this.disposed) return;
      if (err || !Array.isArray(list) || !list.length) { console.warn('[FootstepAudio] footsteps unavailable', String(err || 'empty')); return; }
      const audio = GameAudio.instance;
      if (!audio || audio.adoptClips(list) <= 0) return;   // retried on the next state change
      this.loaded = true;
      qfAudioLog('steps-loaded', { clips: list.length });
    };
    try {
      const b = assetManager.getBundle(STEP_ASSETS.bundle);
      if (b) { b.loadDir(STEP_ASSETS.dir, AudioClip, done as any); return; }
      assetManager.loadBundle(STEP_ASSETS.bundle, (err: any, bundle: any) => {
        if (err || !bundle) { done(err || new Error('bundle ' + STEP_ASSETS.bundle + ' unavailable'), null); return; }
        bundle.loadDir(STEP_ASSETS.dir, AudioClip, done);
      });
    } catch (e) { done(e, null); }
  }

  diagnostics() {
    return { loaded: this.loaded, loading: this.loading, state: this.state, active: STEP_STATES.indexOf(this.state) >= 0, log: this.log.slice() };
  }
  dispose() { this.disposed = true; this.tracker.reset(); }
}
