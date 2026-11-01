// SailAudio.ts — 帆船段音效组件（Voice Bot r5）。订阅 TransitAudioHooks 的帆船 cue，声音逻辑在 SailAudioCore（纯逻辑、有测试）。
// 素材在 transport_sail 分包（帆船段本来就加载这个分包），第一次收到帆船 cue 时才加载；没加载完的 cue 照样记在时间轴上，
// 加载好后从时间轴位置接着放（还在声音长度内的话）。静音 / 音效关 / 后台：GameAudio.canPlayAmbience() + isSfxMuted()；
// 航行隐藏（时间轴停）：transitHidden()。不改 GameAudio 的 3 个 sfxMuted 闸门。
import { _decorator, Component, AudioSource, AudioClip, assetManager, director, Director, isValid } from 'cc';
import { GameAudio } from './GameAudio';
import { SAIL_AUDIO, SAIL_VOICES, SailAudioCore, type SailVoiceId } from './SailAudioCore';
import { onTransitCue, transitHidden } from '../region/TransitAudioHooks';
const { ccclass } = _decorator;
function qfAudioLog(event: string, data: Record<string, unknown>) { try { if ((globalThis as any).__worldFlowLog) console.info('[QF_AUDIO] ' + JSON.stringify({ event, t: Date.now(), ...data })); } catch { } }
@ccclass('SailAudio')
export class SailAudio extends Component {
  static instance: SailAudio | null = null;
  private core: SailAudioCore | null = null; private src: Partial<Record<SailVoiceId, AudioSource>> = {};
  private clips: AudioClip[] = []; private loading = false; private ready = false; private failed = false; private alive = true;
  private off: () => void = () => {};
  static ensure() {
    try { const audio = GameAudio.ensure(); if (!audio.node.getComponent(SailAudio)) audio.node.addComponent(SailAudio); }
    catch (e) { console.error('[QF_SAIL] sail audio mount failed', e); }
  }
  onLoad() {
    SailAudio.instance = this;
    const all: any = {};
    for (let i = 0; i < SAIL_VOICES.length; i++) { const s = this.node.addComponent(AudioSource); s.playOnAwake = false; s.volume = 0; this.src[SAIL_VOICES[i]] = s; all[SAIL_VOICES[i]] = s; }
    this.core = new SailAudioCore(all, qfAudioLog);
    this.off = onTransitCue((cue, info) => {
      if (!this.core) return;
      if (String(cue).indexOf('sail-') !== 0 && cue !== 'transit-skip') return;
      this.load(); this.core.cue(cue, info);
    });
  }
  onDestroy() {
    this.alive = false; this.off(); if (SailAudio.instance === this) SailAudio.instance = null;
    this.core?.reset();
    for (let i = 0; i < SAIL_VOICES.length; i++) { const s = this.src[SAIL_VOICES[i]]; try { s?.stop(); if (s) s.clip = null; } catch { } }
    for (let i = 0; i < this.clips.length; i++) { try { this.clips[i].decRef(); } catch { } } this.clips.length = 0;
  }
  diagnostics() { return { ready: this.ready, failed: this.failed, loading: this.loading, ...(this.core ? this.core.diagnostics() : {}) }; }
  private load() {
    if (this.loading || this.ready || this.failed) return; this.loading = true; qfAudioLog('sail-audio-load', { bundle: SAIL_AUDIO.bundle });
    const fail = (stage: string, err: unknown) => { this.loading = false; this.failed = true; console.error('[QF_SAIL] sail audio ' + stage + ' failed (the ride stays silent): ' + String(err)); qfAudioLog('sail-audio-load-failed', { stage, err: String(err) }); };
    assetManager.loadBundle(SAIL_AUDIO.bundle, (e, bundle) => {
      if (!this.alive) return; if (e || !bundle) return fail('bundle', e);
      let left = SAIL_VOICES.length;
      for (let i = 0; i < SAIL_VOICES.length; i++) {
        const id = SAIL_VOICES[i];
        bundle.load(SAIL_AUDIO.clips[id], AudioClip, (err, clip) => {
          if (!this.alive || !isValid(this.node, true) || this.failed) return; if (err || !clip) return fail('clip ' + id, err);
          clip.addRef(); this.clips.push(clip); const s = this.src[id]; if (s) s.clip = clip;
          if (--left === 0) { this.loading = false; this.ready = true; qfAudioLog('sail-audio-loaded', { clips: SAIL_VOICES.length }); }
        });
      }
    });
  }
  update(dt: number) {
    const core = this.core; if (!core) return;
    const audio: any = GameAudio.instance;
    const audible = this.ready && !!audio && audio.canPlayAmbience() && !(typeof audio.isSfxMuted === 'function' && audio.isSfxMuted());
    core.step(dt, !transitHidden(), audible);
  }
}
director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => SailAudio.ensure());
(GameAudio as any).ambienceMounters?.push(() => SailAudio.ensure());
