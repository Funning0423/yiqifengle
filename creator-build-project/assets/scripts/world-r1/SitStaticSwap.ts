/** Fixed sitting mesh crossfade. No engine, no Map/Set, no for-of.
 * Cold start is the static mesh (the room opens already seated). Button sits fade
 * skeletal -> static over SIT_SWAP_FADE_S after sit_down. Standing up fades back.
 * Leaving the chair snaps (showSkeletal) so the exit camera is not delayed. */
export const SIT_SWAP_FADE_S = 0.3;
export type SitPhase = 'skeletal' | 'to-static' | 'static' | 'to-skeletal';

export class SitStaticSwap {
  phase: SitPhase = 'static';
  /** 1 = skeletal mesh fully visible. */
  skel = 0;
  /** 1 = fixed sitting mesh fully visible. */
  stat = 1;
  private t = 1;

  fadeToStatic(): void {
    if (this.phase === 'static' || this.phase === 'to-static') return;
    this.phase = 'to-static';
    this.t = 0;
  }
  fadeToSkeletal(): void {
    if (this.phase === 'skeletal' || this.phase === 'to-skeletal') return;
    this.phase = 'to-skeletal';
    this.t = 0;
  }
  showStatic(): void { this.phase = 'static'; this.t = 1; this.skel = 0; this.stat = 1; }
  showSkeletal(): void { this.phase = 'skeletal'; this.t = 1; this.skel = 1; this.stat = 0; }
  busy(): boolean { return this.phase === 'to-static' || this.phase === 'to-skeletal'; }

  advance(dt: number): void {
    if (!this.busy() || !(dt > 0)) return;
    this.t += dt / SIT_SWAP_FADE_S;
    if (this.t >= 1) {
      this.t = 1;
      if (this.phase === 'to-static') this.showStatic();
      else this.showSkeletal();
      return;
    }
    const u = this.t * this.t * (3 - 2 * this.t);
    if (this.phase === 'to-static') { this.skel = 1 - u; this.stat = u; }
    else { this.skel = u; this.stat = 1 - u; }
  }
}
