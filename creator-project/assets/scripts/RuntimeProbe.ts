import { _decorator, Component, game, Game } from 'cc';
import { FrameWindow } from './FrameWindow';
const { ccclass } = _decorator;

@ccclass('RuntimeProbe')
export class RuntimeProbe extends Component {
  private frames = new FrameWindow();
  private active = true;
  private clockKind = typeof performance !== 'undefined' && typeof performance.now === 'function' ? 'performance.now' : 'Date.now';
  private startedUtc = new Date().toISOString();
  private onHide = () => { this.active = false; this.frames.discontinuity(); };
  private onShow = () => { this.active = true; this.frames.discontinuity(); };
  onEnable() {
    this.frames.discontinuity();
    this.active = true;
    game.on(Game.EVENT_HIDE, this.onHide);
    game.on(Game.EVENT_SHOW, this.onShow);
  }
  onDisable() {
    game.off(Game.EVENT_HIDE, this.onHide);
    game.off(Game.EVENT_SHOW, this.onShow);
    this.frames.discontinuity();
  }
  update() {
    if (this.active) this.frames.tick(this.clockKind === 'performance.now' ? performance.now() : Date.now());
  }
  /** Caller provides actual build, device, WeChat/base library and quality. No fabricated defaults. */
  exportEvidence(context: Record<string, unknown>) {
    return JSON.stringify({ schemaVersion: 1, context, clockKind: this.clockKind, startedUtc: this.startedUtc,
      exportedUtc: new Date().toISOString(), summary: this.frames.report(), rawFrameIntervalsMs: this.frames.raw(),
      temperature: null, battery: null, gpu: null, visualAcceptance: 'not_run' });
  }
}
