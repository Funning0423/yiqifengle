// SailAudioCore.ts — 帆船段音效（Voice Bot r5）：登船木头吱呀、升帆鼓风+起航、航行水声/帆布循环、靠岸轻碰+缆绳。
// 纯逻辑（无 cc 引用，tools/journey-integration/test-journey-background-audio.cjs 直接驱动）。素材：CC0 实录（docs/audio-credits.md）。
// 时间轴同步：每个声音记住它在「帆船时钟」上的起点；帆船时钟只在航行没被隐藏时走（SailRide.step 在 hidden 时不推进 t，
// 这里同样不推进）。切后台：声源 pause()（位置保留，不 stop）；回来：按 时钟-起点 校准位置后接着放（偏差 > 50 ms 才 seek）。
// 静音 / 音效关：航行照走、时钟照走，声源暂停；恢复时跳到时间轴上的正确位置（还没放完就接着放，已放完就不再出声）。
// TransitAudioHooks 回前台时重发的 'sail-cruise-loop-start'（region 'resume'）不会让循环从头开始。
export const SAIL_AUDIO = Object.freeze({
  bundle: 'transport_sail',
  clips: Object.freeze({ board: 'audio_sail/sfx_sail_board', unfurl: 'audio_sail/sfx_sail_unfurl', cruise: 'audio_sail/amb_sail_cruise', dock: 'audio_sail/sfx_sail_dock' }),
  /** Source lengths (s, before mp3 padding); the cruise bed is a 16 s seamless loop. */
  durS: Object.freeze({ board: 3.4, unfurl: 4.6, cruise: 16.0, dock: 4.4 }),
  vol: Object.freeze({ board: 0.7, unfurl: 0.7, cruise: 0.45, dock: 0.7 }),  // sits 4-8 dB under the v2 sail BGM + open-sea bed (voice/v2-scene-audio)
  cruiseFadeInS: 1.0,   // bed rises under the unfurl tail
  cruiseFadeOutS: 2.0,  // loop-stop (= S-e start): bed sinks while the dock sound comes in, never a hard cut
  skipFadeS: 0.4,       // transit-skip: everything fades, no click
  resumeRampS: 0.12,    // every (re)start after a pause / mute ramps in (no click)
  syncTolS: 0.05,       // seek only when the source is > 50 ms off the timeline
});
export type SailVoiceId = 'board' | 'unfurl' | 'cruise' | 'dock';
export const SAIL_VOICES: readonly SailVoiceId[] = Object.freeze(['board', 'unfurl', 'cruise', 'dock'] as SailVoiceId[]);
export interface SailSource { volume: number; loop: boolean; readonly playing: boolean; currentTime: number; play(): void; pause(): void; stop(): void; }
type Voice = { src: SailSource; on: boolean; start: number; fade: number; fadeTo: number; fadeRate: number; ramp: number; playing: boolean; stops: number };
type Log = (event: string, data: Record<string, unknown>) => void;
/** Cue -> voice. Cues not listed here are ignored (walk / balloon cues belong to other owners). */
export function sailVoiceOf(cue: string): SailVoiceId | null {
  return cue === 'sail-board' ? 'board' : cue === 'sail-unfurl' ? 'unfurl' : cue === 'sail-cruise-loop-start' ? 'cruise' : cue === 'sail-dock' ? 'dock' : null;
}
export class SailAudioCore {
  clock = 0;
  private v: Record<SailVoiceId, Voice>;
  constructor(src: Record<SailVoiceId, SailSource>, private log: Log = () => {}) {
    const mk = (s: SailSource, loop: boolean): Voice => { s.loop = loop; s.volume = 0; return { src: s, on: false, start: 0, fade: 1, fadeTo: 1, fadeRate: 0, ramp: 0, playing: false, stops: 0 }; };
    this.v = { board: mk(src.board, false), unfurl: mk(src.unfurl, false), cruise: mk(src.cruise, true), dock: mk(src.dock, false) };
  }
  /** Seconds into the clip where the timeline says this voice is now (null = not active). */
  position(id: SailVoiceId): number | null {
    const v = this.v[id]; if (!v.on) return null; const e = this.clock - v.start, d = SAIL_AUDIO.durS[id];
    return id === 'cruise' ? e % d : e;
  }
  active(id: SailVoiceId): boolean { return this.v[id].on; }
  diagnostics() {
    const o: Record<string, unknown> = { clock: +this.clock.toFixed(3) };
    for (let i = 0; i < SAIL_VOICES.length; i++) { const id = SAIL_VOICES[i], v = this.v[id]; o[id] = v.on ? { pos: +(this.position(id) as number).toFixed(3), fade: +v.fade.toFixed(3), playing: v.src.playing } : null; }
    return o;
  }
  cue(cue: string, info?: { region?: string; resumed?: boolean } | null): void {
    if (cue === 'sail-cruise-loop-stop') { this.fadeOut('cruise', SAIL_AUDIO.cruiseFadeOutS); return; }
    if (cue === 'transit-skip') { for (let i = 0; i < SAIL_VOICES.length; i++) this.fadeOut(SAIL_VOICES[i], SAIL_AUDIO.skipFadeS); return; }
    const id = sailVoiceOf(cue); if (!id) return;
    const v = this.v[id];
    // The hooks re-send the pending loop-start on return ('resume' / resumed): the bed that is already running continues.
    if (id === 'cruise' && v.on && v.fadeTo > 0) { this.log('sail-audio-resume-cue', { region: info?.region || '', pos: this.position(id) }); return; }
    if (v.on) this.halt(v);
    v.on = true; v.start = this.clock; v.ramp = 0; v.playing = false;
    if (id === 'cruise') { v.fade = 0; v.fadeTo = 1; v.fadeRate = 1 / SAIL_AUDIO.cruiseFadeInS; } else { v.fade = 1; v.fadeTo = 1; v.fadeRate = 0; }
    try { v.src.stop(); v.src.currentTime = 0; } catch { }
    this.log('sail-audio-cue', { cue, voice: id, clock: +this.clock.toFixed(3) });
  }
  private fadeOut(id: SailVoiceId, s: number) { const v = this.v[id]; if (!v.on) return; v.fadeTo = 0; v.fadeRate = Math.max(v.fadeRate, v.fade / Math.max(1e-3, s)); }
  private halt(v: Voice) { try { v.src.volume = 0; v.src.stop(); } catch { } v.on = false; v.playing = false; v.stops++; }
  /** Leaving the sail (ride disposed / home): stop everything at once. */
  reset(): void { for (let i = 0; i < SAIL_VOICES.length; i++) { const v = this.v[SAIL_VOICES[i]]; if (v.on) this.halt(v); } this.clock = 0; }
  /** running: the sail timeline advances (not hidden). audible: sound allowed (not muted, SFX on, not suspended). */
  step(dt: number, running: boolean, audible: boolean, master = 1): void {
    const d = running && Number.isFinite(dt) ? Math.max(0, Math.min(0.25, dt)) : 0;
    this.clock += d;
    for (let i = 0; i < SAIL_VOICES.length; i++) {
      const id = SAIL_VOICES[i], v = this.v[id]; if (!v.on) continue;
      const e = this.clock - v.start;
      if (id !== 'cruise' && e >= SAIL_AUDIO.durS[id]) { this.halt(v); continue; }   // natural end (the file carries its own tail)
      if (v.fadeRate > 0) {
        if (v.fade < v.fadeTo) v.fade = Math.min(v.fadeTo, v.fade + v.fadeRate * d); else v.fade = Math.max(v.fadeTo, v.fade - v.fadeRate * d);
        if (v.fade === v.fadeTo) { v.fadeRate = 0; if (v.fadeTo === 0) { this.halt(v); continue; } }
      }
      if (!running || !audible) {   // hidden / muted: pause, keep the position (never stop)
        if (v.playing || v.src.playing) { try { v.src.volume = 0; v.src.pause(); } catch { } }
        v.playing = false; continue;
      }
      if (!v.playing) {   // (re)start on the timeline
        const pos = this.position(id) as number;
        try { if (Math.abs(v.src.currentTime - pos) > SAIL_AUDIO.syncTolS) v.src.currentTime = pos; v.src.play(); } catch { }
        v.playing = true; v.ramp = 0;
      }
      v.ramp = Math.min(1, v.ramp + d / SAIL_AUDIO.resumeRampS);
      try { v.src.volume = SAIL_AUDIO.vol[id] * v.fade * v.ramp * master; } catch { }
    }
  }
}
