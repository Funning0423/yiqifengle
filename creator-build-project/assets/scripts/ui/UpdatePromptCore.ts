/** Version-update popup gate (SPEC system-panels §3). Pure: no 'cc'. Signal comes from first-screen.js (GameGlobal.__qfUpdate,
 *  the single wx.getUpdateManager path): onUpdateReady only sets ready; the popup opens here at a safe moment. */
export const UPDATE_MAX_PROMPTS = 2;
export const UPDATE_HOME_DELAY_S = 0.6;
export interface UpdateSignal { ready?: boolean; applied?: boolean; apply?: () => void }
export interface UpdateContext { islandHome: boolean; popupOpen: boolean; board: boolean; transition: boolean }
export class UpdatePromptGate {
  private prompts = 0; private homeS = -1; private showing = false; private awaitReturn = false;
  /** Call each frame; returns true once when the popup should open now (600 ms after reaching a safe island-home moment). */
  tick(dt: number, signal: UpdateSignal | null | undefined, ctx: UpdateContext): boolean {
    const away = !ctx.islandHome || ctx.board || ctx.transition;
    if (away) { this.homeS = -1; this.awaitReturn = false; return false; }
    if (ctx.popupOpen || this.showing) { this.homeS = -1; return false; }
    if (this.awaitReturn || !signal || !signal.ready || signal.applied || this.prompts >= UPDATE_MAX_PROMPTS) return false;
    this.homeS = this.homeS < 0 ? 0 : this.homeS + Math.max(0, dt);
    if (this.homeS < UPDATE_HOME_DELAY_S) return false;
    this.prompts++; this.showing = true; return true;
  }
  /** 「稍后」: next prompt only after leaving and returning to the island home; at most UPDATE_MAX_PROMPTS per session. */
  later() { this.showing = false; this.awaitReturn = true; this.homeS = -1; }
  count() { return this.prompts; }
}
