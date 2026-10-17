// LakeAmbienceCore.ts — 风铃湖畔环境声（Voice Bot）：湖水 + 微风 + 稀疏五声风铃的循环（amb_lake_loop，自合成，region_lakeside 分包）。
// 纯逻辑（无 cc 引用，tools/test_lake_ambience.cjs 直接驱动）：何时要湖声、音量平滑、静音/后台、两声源交叉循环。
/** Loop facts of the shipped file (tools/audio/lakeside/synth_lake_amb.py): circular period, LAME encoder delay at 24 kHz. */
export const LAKE_AMB = Object.freeze({
  bundle: 'region_lakeside', path: 'audio/amb_lake_loop',
  loopS: 19.0,            // circular period; the file carries a 0.15 s duplicate of its own start after it
  encoderDelayS: 0.046,   // 1105 samples @ 24 kHz (decoders that do not trim it play it at the head)
  xfadeS: 0.15,           // same length as GameAudio LOOP_XFADE_S; overlap is identical audio, so linear (equal-gain)
  maxVol: 0.55,           // = AmbienceAudio WAVES_MAX_VOL; file is −22.4 LUFS (waves −20.9, soft wind −23.4)
  fadeInS: 1.2, fadeOutS: 0.8, partnerTimeoutS: 0.6,
});
export interface LakeSource { volume: number; readonly playing: boolean; readonly currentTime: number; play(): void; pause(): void; stop(): void; }
export type LakeProbe = Readonly<{ state?: string | null; boardPresent?: boolean; boardRegion?: string | null; boardStageId?: string | null; journeyTarget?: string | null; journeyPhase?: string | null; journeyRegion?: string | null }>;
const LAKE_STAGE = /^r0[45]-lake-\d+$/;
/** Lake ambience wanted: standing at the lakeside, the last (arrival) stretch of the island→lakeside walk, or a lakeside board
 *  (r04-lake-* / region 'lake') — incl. its loading cover. Everything else (island, home, meadow, skycity, other boards): no. */
export function lakeAmbienceWanted(p: LakeProbe): boolean {
  const s = p.state || '';
  if (s === 'lakeside') return true;
  if (s === 'region-travel' && p.journeyTarget === 'lakeside' && p.journeyPhase === 'arrival') return true;
  if (p.boardPresent && (p.boardRegion === 'lake' || LAKE_STAGE.test(String(p.boardStageId || '')))) return true;
  if ((s === 'level-loading' || s === 'level') && p.journeyRegion === 'lakeside' && !p.boardPresent) return true;
  return false;
}
type Log = (event: string, data: Record<string, unknown>) => void;
export class LakeAmbienceCore {
  ready = false; vol = 0; heard = 0;
  private cur: LakeSource; private next: LakeSource; private xfading = false; private xWait = 0; private xFailed = false; private wasPlaying = false;
  constructor(a: LakeSource, b: LakeSource, private log: Log = () => {}) { this.cur = a; this.next = b; }
  /** True while the sea-waves bed must stay down (lake wanted and its clip is ready). */
  suppressWaves(wanted: boolean): boolean { return wanted && this.ready; }
  diagnostics() { return { ready: this.ready, vol: +this.vol.toFixed(3), heard: +this.heard.toFixed(3), xfading: this.xfading, xFailed: this.xFailed, playing: this.cur.playing }; }
  /** Hard stop (GameAudio.quietAmbience: background / exit restart). Fades back in from 0 if still wanted. */
  quiet(): void { this.vol = 0; this.heard = 0; for (const s of [this.cur, this.next]) { try { s.volume = 0; if (s.playing) s.pause(); } catch { } } }
  step(dt: number, wanted: boolean, canSound: boolean, bed: number): void {
    const L = LAKE_AMB, d = Number.isFinite(dt) ? Math.max(0, Math.min(.25, dt)) : 0;
    const target = wanted && canSound && this.ready ? L.maxVol : 0;
    if (!canSound || !this.ready) this.vol = 0;
    else if (this.vol < target) this.vol = Math.min(target, this.vol + L.maxVol * d / L.fadeInS);
    else this.vol = Math.max(target, this.vol - L.maxVol * d / L.fadeOutS);
    const b = Number.isFinite(bed) ? Math.max(0, Math.min(1, bed)) : 1;
    this.heard = this.vol * b;
    if (this.heard < 0.002) {
      for (const s of [this.cur, this.next]) { try { s.volume = 0; if (s.playing) s.pause(); } catch { } }
      if (this.wasPlaying) { this.wasPlaying = false; this.log('lake-pause', { wanted, canSound }); }
      // Both loop sources are paused at aligned positions (same file, partner = cur − loopS). Keep the crossfade as it is:
      // a background trip / auto-resumed journey (snapshot 'paused' reads as not wanted) resumes both exactly where they were.
      // Stopping the partner here restarted it at 0 against cur, a misaligned crossfade after the return.
      return;
    }
    if (!this.cur.playing) { try { this.cur.play(); } catch (e) { this.log('lake-play-failed', { err: String(e) }); } }
    if (this.xfading && !this.next.playing) { try { this.next.play(); } catch { } }
    if (!this.wasPlaying) { this.wasPlaying = true; this.log('lake-play', { vol: +this.heard.toFixed(3) }); }
    // Cross-loop: partner starts at the circular period; linear crossfade once it is past the encoder delay.
    if (!this.xfading && !this.xFailed && this.cur.currentTime >= L.loopS) {
      try { this.next.stop(); this.next.volume = 0; this.next.play(); this.xfading = true; this.xWait = 0; } catch { this.xFailed = true; }
    }
    if (this.xfading) {
      if (!this.next.playing) { this.xWait += d; if (this.xWait > L.partnerTimeoutS) { try { this.next.stop(); } catch { } this.xfading = false; this.xFailed = true; this.log('lake-xloop-failed', {}); } this.cur.volume = this.heard; return; }
      const u = Math.max(0, Math.min(1, (this.next.currentTime - L.encoderDelayS) / L.xfadeS));
      this.cur.volume = this.heard * (1 - u); this.next.volume = this.heard * u;
      if (u >= 1) { try { this.cur.stop(); } catch { } const t = this.cur; this.cur = this.next; this.next = t; this.xfading = false; this.log('lake-xloop', {}); }
      return;
    }
    this.cur.volume = this.heard;
  }
}
