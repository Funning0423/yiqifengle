/** Startup loading layer geometry + timing (GGbot, docs/first-screen.md). Engine-free and loose-ES5 safe.
 * One layout for BOTH startup surfaces so the handoff never jumps:
 *  - build-templates/wechatgame/first-screen.js (WebGL, before the engine) draws ART.composite with coverTransform();
 *  - WorldIntegrationBoot's scene loading layer draws the SAME file with the same transform, then adds the progress
 *    fill, the pinwheel and the hint text (they fade in over INTRO_FADE_S so nothing pops at takeover).
 * Design canvas 750x1624 (棋盘UI美术bot a-loading/first-screen coords.json; base = 运镜bot loading_base_final_fs50k.jpg).
 * Cover rule (运镜bot README): s = max(W/750, H/1624), dx = (W-750s)/2, dy = (H-1624s)/2, screen = (x*s+dx, y*s+dy). */
export const DESIGN_W = 750;
export const DESIGN_H = 1624;
/** Files copied by the build template into the WeChat main package root (and the web-desktop build root). */
export const ART = {
 dir: 'startup-art/',
 composite: 'startup-art/first_screen_composite.jpg',
 fill: 'startup-art/bar_fill.png',
 pinwheel: 'startup-art/pinwheel.png',
 compositeSha256: '189508bc8a1c9ccce4cf6c106a0709371d9512a94d7852d9dc7fd1565456fb6a',
};
/** Clear / fallback colour = mean colour of the composite (shown only before the picture is decoded). */
export const BACKDROP_RGB = [217, 210, 196];
/** Progress ribbon: bar_track/bar_fill 496x44 at top-left (127,1271) (centre y 1293 = 79.6%); 8 px inner padding,
 * 480 px travel; ribbon wave 5 px amplitude, 135 px wavelength (gen.py ribbon_y). Pinwheel 60x60 rides the ribbon head. */
export const BAR = { x: 127, y: 1271, w: 496, h: 44, pad: 8, travel: 480, amp: 5, lambda: 135 };
export const PINWHEEL = { w: 60, h: 60, degPerSec: 300 };
/** Hint text: system font 28 design px, #3F5E63, top 1341 (= track top + 70), soft cream shadow (+1,+1). */
export const HINT = { centerY: 1361, size: 28, width: 640, height: 48, color: '#3F5E63', shadow: [255, 250, 238, 180] };
export const HINTS = ['风从海上来……', '她在窗前坐下……', '灯塔小屋准备好了'];
/** Safe band (all decorations stay inside on every aspect from 16:9 to 19.5:9). */
export const SAFE = { top: 0.089, bottom: 0.88 };
/** Fill / pinwheel / hint fade in after the scene layer's first frame (spec 0.2-0.3 s). */
export const INTRO_FADE_S = 0.25;
/** Whole layer fades out once the room is ready (PM spec 0.6-0.8 s, ease-out); room hints wait for the end. */
export const OUTRO_FADE_S = 0.7;
/** Displayed progress eases toward the REAL stage target (no timer-driven creep). */
export const PROGRESS_TAU_S = 0.18;

export interface Cover { s: number; dx: number; dy: number; w: number; h: number }
export function coverTransform(W: number, H: number): Cover {
 const s = Math.max(W / DESIGN_W, H / DESIGN_H);
 return { s: s, dx: (W - DESIGN_W * s) / 2, dy: (H - DESIGN_H * s) / 2, w: DESIGN_W * s, h: DESIGN_H * s };
}
/** Design point -> screen pixel (top-left origin). */
export function toScreen(c: Cover, x: number, y: number) { return { x: x * c.s + c.dx, y: y * c.s + c.dy }; }
/** Design point -> Cocos UI position (screen centre origin, y up), the Canvas used by WorldIntegrationBoot. */
export function toCentered(c: Cover, x: number, y: number) { return { x: (x - DESIGN_W / 2) * c.s, y: (DESIGN_H / 2 - y) * c.s }; }
/** Visible design-y window (what cover crops away on the screen's aspect). */
export function visibleDesignRect(W: number, H: number) {
 const c = coverTransform(W, H);
 return { x0: -c.dx / c.s, y0: -c.dy / c.s, x1: (W - c.dx) / c.s, y1: (H - c.dy) / c.s };
}
function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function smoothstep01(t: number) { t = clamp01(t); return t * t * (3 - 2 * t); }
export function easeOutCubic(t: number) { t = clamp01(t); const u = 1 - t; return 1 - u * u * u; }
/** Ribbon head for progress p in [0,1]: fill range of the 496-px FILLED sprite + pinwheel centre (design px). */
export function ribbonHead(p: number) {
 p = clamp01(p);
 const along = BAR.travel * p, fx = BAR.pad + along;
 return { fillRange: fx / BAR.w, x: BAR.x + fx, y: BAR.y + BAR.h / 2 + BAR.amp * Math.sin(2 * Math.PI * along / BAR.lambda) };
}
/** Real startup stages (StartupReadyGate order): 0 island prefab, 1 character + anim meta, 2 room mount, 3 ready. */
export function stageTarget(stage: number) { return stage <= 0 ? 0 : stage >= 3 ? 1 : stage / 3; }
export function hintForStage(stage: number) { return HINTS[stage < 0 ? 0 : stage > 2 ? 2 : stage]; }
/** One step of the displayed-progress follower (monotonic: never moves backwards). */
export function followProgress(shown: number, target: number, dt: number) {
 if (target <= shown) return shown;
 const k = 1 - Math.exp(-Math.max(0, dt) / PROGRESS_TAU_S);
 const next = shown + (target - shown) * k;
 return target - next < 0.002 ? target : next;
}
/** Element rectangles in design px (top-left x,y,w,h) for layout tests and previews. */
export function elementRects(p: number) {
 const head = ribbonHead(p);
 return {
  base: { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H },
  fill: { x: BAR.x, y: BAR.y, w: BAR.w, h: BAR.h, range: head.fillRange },
  pinwheel: { x: head.x - PINWHEEL.w / 2, y: head.y - PINWHEEL.h / 2, w: PINWHEEL.w, h: PINWHEEL.h },
  hint: { x: (DESIGN_W - HINT.width) / 2, y: HINT.centerY - HINT.height / 2, w: HINT.width, h: HINT.height },
 };
}
/** Loading layer state machine (pure): intro fade of the dynamic group, progress follower, outro fade. */
export class LoadingTimeline {
 shown = 0; target = 0; stage = 0; introT = -1; outroT = -1; spin = 0; hidden = false;
 /** First frame the scene layer is on screen: start the intro (idempotent). */
 begin() { if (this.introT < 0) this.introT = 0; }
 /** Stages only move forward within one attempt (late/duplicate callbacks cannot rewind the bar or the hint). */
 setStage(stage: number) { if (stage > this.stage) this.stage = stage; const t = stageTarget(this.stage); if (t > this.target) this.target = t; }
 /** Retry after an error: the bar keeps what was really loaded only if the stage is reached again; restart from 0. */
 reset() { this.shown = 0; this.target = 0; this.stage = 0; this.outroT = -1; this.hidden = false; }
 startOutro() { if (this.outroT < 0) { this.outroT = 0; this.setStage(3); } }
 get fading() { return this.outroT >= 0 && !this.hidden; }
 tick(dt: number) {
  dt = Math.max(0, Math.min(dt, 0.1));
  if (this.introT >= 0 && this.introT < INTRO_FADE_S) this.introT = Math.min(INTRO_FADE_S, this.introT + dt);
  this.shown = followProgress(this.shown, this.target, this.outroT >= 0 ? dt * 3 : dt);
  this.spin = (this.spin + PINWHEEL.degPerSec * dt) % 360;
  if (this.outroT >= 0 && !this.hidden) { this.outroT += dt; if (this.outroT >= OUTRO_FADE_S) this.hidden = true; }
 }
 /** 0..255 opacity of the fill/pinwheel/hint group (multiplied by layerOpacity by UIOpacity cascading). */
 introOpacity() { return this.introT < 0 ? 0 : Math.round(255 * smoothstep01(this.introT / INTRO_FADE_S)); }
 layerOpacity() { return this.outroT < 0 ? 255 : Math.round(255 * (1 - easeOutCubic(this.outroT / OUTRO_FADE_S))); }
}
