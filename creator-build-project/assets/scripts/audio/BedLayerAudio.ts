// BedLayerAudio.ts — 鸟鸣、虫鸣、高空风的循环播放器。
// 读 SceneMusic 发布的 __sceneAudioBed（birds / insects / highWind）和 2 s 交叉（SCENE_AUDIO_CROSSFADE_S）。
// 草原：鸟群床 + 虫鸣，外加最多 6 个远处单只鸟鸣。热气球 / 天空城：高空风。岛、海上、湖畔这三层不开。
// 海鸥和海浪仍由 AmbienceAudio 播放，湖声仍由 LakeAmbience 播放，离岛风仍由 WindAudio 播放。
import { _decorator, Component, AudioSource, AudioClip, assetManager, director, Director, isValid } from 'cc';
import { GameAudio } from './GameAudio';
import { ambienceBedGain } from './AmbienceAudio';
import { BedLayers, BED_LOOPS, BED_LAYER_IDS, MAX_SCATTER, birdScatter, takeFromBag, bedLayerVol, bedLayerTarget, type BedFlags, type BedLayerId, type ScatterClip } from './BedLayerCore';
const { ccclass } = _decorator;

function qfAudioLog(event: string, data: Record<string, unknown>) {
  try {
    if (!(globalThis as any).__worldFlowLog) return;
    const row: Record<string, unknown> = { event: event, t: Date.now() };
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) row[keys[i]] = data[keys[i]];
    console.info('[QF_AUDIO] ' + JSON.stringify(row));
  } catch (e) { /* log only */ }
}

function readBed(): BedFlags {
  const g = (globalThis as any).__sceneAudioBed;
  if (!g || typeof g !== 'object') return { place: '', birds: false, insects: false, highWind: false };
  return g as BedFlags;
}

@ccclass('BedLayerAudio')
export class BedLayerAudio extends Component {
  static instance: BedLayerAudio | null = null;
  /** 夜间权重（AmbienceNight 注册 propNightWeight）。没有就按白天。虫鸣夜里 +3 dB，单只鸟鸣更稀。 */
  private static nightSource: (() => number) | null = null;
  static setNightSource(fn: () => number) { BedLayerAudio.nightSource = fn; }
  private layers: BedLayers | null = null;
  private pairs: { [id: string]: [AudioSource, AudioSource] } = {};
  private clips: { [id: string]: AudioClip } = {};
  private loading: { [id: string]: boolean } = {};
  private failed: { [id: string]: boolean } = {};
  private scatterSources: AudioSource[] = [];
  private scatterClips: AudioClip[] = [];
  private scatterByPath: { [path: string]: AudioClip } = {};
  private scatterBag: ScatterClip[] = [];
  private lastScatter: ScatterClip | null = null;
  private scatterLoading = false;
  private alive = true;
  private rnd: () => number = Math.random;

  static ensure() {
    try {
      const audio = GameAudio.ensure();
      if (!audio.node.getComponent(BedLayerAudio)) audio.node.addComponent(BedLayerAudio);
    } catch (e) { console.warn('[BedLayer] mount failed (silent, gameplay unaffected)', e); }
  }
  onLoad() {
    BedLayerAudio.instance = this;
    const mk = () => { const s = this.node.addComponent(AudioSource); s.playOnAwake = false; s.loop = true; s.volume = 0; return s; };
    const pair = (id: string): [AudioSource, AudioSource] => { const p: [AudioSource, AudioSource] = [mk(), mk()]; this.pairs[id] = p; return p; };
    this.layers = new BedLayers({ birds: pair('birds'), insects: pair('insects'), highWind: pair('highWind') }, () => this.rnd(), qfAudioLog);
  }
  onDestroy() {
    this.alive = false;
    if (BedLayerAudio.instance === this) BedLayerAudio.instance = null;
    this.layers?.quiet();
    const ids = BED_LAYER_IDS;
    for (let i = 0; i < ids.length; i++) {
      const p = this.pairs[ids[i]];
      if (p) { try { p[0].stop(); p[0].clip = null; p[1].stop(); p[1].clip = null; } catch (e) { /* ignore */ } }
      try { this.clips[ids[i]]?.decRef(); } catch (e) { /* ignore */ }
    }
    for (let i = 0; i < this.scatterSources.length; i++) { try { this.scatterSources[i].stop(); this.scatterSources[i].clip = null; } catch (e) { /* ignore */ } }
    for (let i = 0; i < this.scatterClips.length; i++) { try { this.scatterClips[i].decRef(); } catch (e) { /* ignore */ } }
  }
  quiet() { this.layers?.quiet(); this.stopScatter(); }
  diagnostics() {
    const base = this.layers ? this.layers.diagnostics() : { fadeS: 2, layers: [] as any[], scatter: { cap: MAX_SCATTER, skipped: 0 } };
    return { fadeS: base.fadeS, layers: base.layers, scatter: { cap: base.scatter.cap, skipped: base.scatter.skipped, playing: this.scatterPlaying() } };
  }
  private night(): number {
    try {
      const fn = BedLayerAudio.nightSource;
      const w = fn ? Number(fn()) : 0;
      return Number.isFinite(w) ? Math.max(0, Math.min(1, w)) : 0;
    } catch (e) { return 0; }
  }
  private bedGain(): number {
    const audio: any = GameAudio.instance;
    if (!audio || typeof audio.getMusicVolume !== 'function') return 1;
    return ambienceBedGain(Number(audio.getMusicVolume()), typeof audio.transitionGain === 'function' ? Number(audio.transitionGain()) : 1);
  }
  private canSound(): boolean {
    const audio: any = GameAudio.instance;
    return !!audio && audio.canPlayAmbience();
  }
  private load(id: BedLayerId) {
    const spec = BED_LOOPS[id];
    const row = id === 'birds' ? this.layers && this.layers.birds : id === 'insects' ? this.layers && this.layers.insects : this.layers && this.layers.highWind;
    if (!spec || !row || row.ready || this.loading[id] || this.failed[id] || !spec.bundle) return;
    this.loading[id] = true;
    const fail = (stage: string, err: unknown) => {
      this.loading[id] = false; this.failed[id] = true;
      console.warn('[BedLayer] ' + id + ' ' + stage + ' failed: ' + String(err));
      qfAudioLog('bed-load-failed', { id, stage, err: String(err) });
    };
    const take = (clip: AudioClip) => {
      if (!this.alive || !isValid(this.node, true)) return;
      clip.addRef(); this.clips[id] = clip; this.loading[id] = false;
      const p = this.pairs[id];
      if (p) { p[0].clip = clip; p[1].clip = clip; }
      row.ready = true;
      qfAudioLog('bed-loaded', { id, loopS: spec.loopS });
      if (id === 'birds') this.loadScatter();
    };
    const pull = (bundle: any) => {
      bundle.load(spec.path, AudioClip, (err: Error | null, clip: AudioClip) => {
        if (!this.alive) return;
        if (err || !clip) return fail('clip', err);
        take(clip);
      });
    };
    const have = assetManager.getBundle(spec.bundle);
    if (have) { pull(have); return; }
    assetManager.loadBundle(spec.bundle, (e, bundle) => {
      if (!this.alive) return;
      if (e || !bundle) return fail('bundle', e);
      pull(bundle);
    });
  }
  private loadScatter() {
    const spec = birdScatter();
    if (!spec || this.scatterLoading || this.scatterClips.length) return;
    const bundleName = spec.clips.length ? spec.clips[0].bundle : null;
    if (!bundleName) return;
    const bundle = assetManager.getBundle(bundleName);
    if (!bundle) return;
    this.scatterLoading = true;
    let left = spec.clips.length;
    if (!left) { this.scatterLoading = false; return; }
    const queue = (path: string) => {
      bundle.load(path, AudioClip, (err: Error | null, clip: AudioClip) => {
        left--;
        if (this.alive && !err && clip) { clip.addRef(); this.scatterClips.push(clip); this.scatterByPath[path] = clip; }
        if (left <= 0) this.scatterLoading = false;
      });
    };
    for (let i = 0; i < spec.clips.length; i++) queue(spec.clips[i].path);
  }
  private scatterPlaying(): number {
    let n = 0;
    for (let i = 0; i < this.scatterSources.length; i++) if (this.scatterSources[i].playing) n++;
    return n;
  }
  private stopScatter() {
    for (let i = 0; i < this.scatterSources.length; i++) {
      try { this.scatterSources[i].volume = 0; if (this.scatterSources[i].playing) this.scatterSources[i].stop(); } catch (e) { /* ignore */ }
    }
  }
  private playScatter(gain: number) {
    const spec = birdScatter();
    if (!spec || !this.scatterClips.length || this.scatterPlaying() >= MAX_SCATTER) return;
    const pick = takeFromBag(this.scatterBag, spec.clips, this.lastScatter, this.rnd);
    if (!pick) return;
    this.lastScatter = pick;
    const clip = this.scatterByPath[pick.path] || null;
    if (!clip) return;
    let src: AudioSource | null = null;
    for (let i = 0; i < this.scatterSources.length; i++) if (!this.scatterSources[i].playing) { src = this.scatterSources[i]; break; }
    if (!src) {
      if (this.scatterSources.length >= MAX_SCATTER) return;
      src = this.node.addComponent(AudioSource);
      src.playOnAwake = false; src.loop = false; src.volume = 0;
      this.scatterSources.push(src);
    }
    const pan = spec.pan[0] + this.rnd() * (spec.pan[1] - spec.pan[0]);
    src.clip = clip;
    src.volume = Math.max(0, Math.min(1, spec.vol * gain));
    try { (src as any).stereoPan = pan; } catch (e) { /* engine may not expose pan */ }
    try { src.play(); } catch (e) { console.warn('[BedLayer] bird call failed', e); }
  }
  private followScatter(gain: number) {
    const spec = birdScatter();
    const full = bedLayerVol('birds', 'meadow', 0);
    const birds = this.layers ? this.layers.birds.level : 0;
    const scale = spec && full > 1e-4 ? birds / full : 0;
    const vol = spec ? spec.vol * gain * scale : 0;
    for (let i = 0; i < this.scatterSources.length; i++) {
      const s = this.scatterSources[i];
      if (!s.playing) continue;
      if (vol < 0.002) { try { s.volume = 0; s.stop(); } catch (e) { /* ignore */ } }
      else s.volume = Math.max(0, Math.min(1, vol));
    }
  }
  update(dt: number) {
    const layers = this.layers;
    if (!layers) return;
    const bed = readBed();
    const night = this.night();
    for (let i = 0; i < BED_LAYER_IDS.length; i++) {
      const id = BED_LAYER_IDS[i];
      if (bedLayerTarget(id, bed, night) > 0) this.load(id);
    }
    const gain = this.bedGain();
    const start = layers.step(dt, bed, this.canSound(), gain, night, this.scatterPlaying());
    if (start) this.playScatter(gain);
    this.followScatter(gain);
  }
}

director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => BedLayerAudio.ensure());
(GameAudio as any).ambienceMounters?.push(() => BedLayerAudio.ensure());
(GameAudio as any).ambienceQuieters?.push(() => BedLayerAudio.instance?.quiet());
