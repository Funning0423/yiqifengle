// Dedicated landmark voices: no lake/wind bed duplication. Loaded only inside audible radii.
import { _decorator, Component, AudioSource, AudioClip, assetManager, director, Director, isValid, Node } from 'cc';
import { GameAudio } from './GameAudio';
import { ambienceBedGain } from './AmbienceAudio';
import { LandmarkAudioCore, LandmarkLoopPair, type LandmarkPort } from './LandmarkAudioCore';
import { type LandmarkSpec } from './SceneAudioTable';
const { ccclass } = _decorator;
class Voice implements LandmarkPort {
  ready = false;
  private source: AudioSource | null = null;
  private clip: AudioClip | null = null;
  private ticket = 0;
  constructor(private owner: Node, private spec: LandmarkSpec) {}
  get playing() { return !!this.source && this.source.playing; }
  get volume() { return this.source ? this.source.volume : 0; }
  set volume(v: number) { if (this.source) this.source.volume = v; }
  prepare(index: number) {
    const ticket = ++this.ticket, ref = this.spec.clips[index];
    const current = () => ticket === this.ticket && isValid(this.owner, true);
    const fail = (e: unknown) => { if (current()) console.warn('[LandmarkAudio] ' + this.spec.id + ' load failed', String(e)); };
    const pull = (bundle: any) => {
      if (!current()) return;
      bundle.load(ref.path, AudioClip, (err: Error | null, clip: AudioClip) => {
        if (!current()) return;
        if (err || !clip) { fail(err); return; }
        this.clip = clip; clip.addRef();
        const src = this.owner.addComponent(AudioSource); this.source = src;
        src.playOnAwake = false; src.volume = 0; src.clip = clip; this.ready = true;
      });
    };
    if (!ref || !ref.bundle) return;
    const have = assetManager.getBundle(ref.bundle);
    if (have) pull(have);
    else assetManager.loadBundle(ref.bundle, (err, bundle) => { if (!current()) return; if (err || !bundle) fail(err); else pull(bundle); });
  }
  play(loop: boolean) { if (this.source) { this.source.loop = loop; this.source.play(); } }
  release() {
    this.ticket++; this.ready = false;
    if (this.source) { this.source.volume = 0; this.source.stop(); this.source.clip = null; this.source.destroy(); this.source = null; }
    if (this.clip) { this.clip.decRef(); this.clip = null; }
  }
}
/** Loop landmark: two AudioSources on the same clip, alternated by LandmarkLoopPair (no AudioSource.loop). */
class LoopVoice implements LandmarkPort {
  ready = false;
  private a: AudioSource | null = null;
  private b: AudioSource | null = null;
  private pair: LandmarkLoopPair | null = null;
  private clip: AudioClip | null = null;
  private ticket = 0;
  private started = false;
  private vol = 0;
  constructor(private owner: Node, private spec: LandmarkSpec) {}
  get playing() { return !!this.pair && this.started && this.pair.playing; }
  get volume() { return this.vol; }
  set volume(v: number) { this.vol = v; if (!this.started) { if (this.a) this.a.volume = 0; if (this.b) this.b.volume = 0; } }
  prepare(index: number) {
    const ticket = ++this.ticket, ref = this.spec.clips[index];
    const current = () => ticket === this.ticket && isValid(this.owner, true);
    const fail = (e: unknown) => { if (current()) console.warn('[LandmarkAudio] ' + this.spec.id + ' load failed', String(e)); };
    const pull = (bundle: any) => {
      if (!current()) return;
      bundle.load(ref.path, AudioClip, (err: Error | null, clip: AudioClip) => {
        if (!current()) return;
        if (err || !clip) { fail(err); return; }
        this.clip = clip; clip.addRef();
        const mk = () => { const src = this.owner.addComponent(AudioSource); src.playOnAwake = false; src.loop = false; src.volume = 0; src.clip = clip; return src; };
        this.a = mk(); this.b = mk();
        this.pair = new LandmarkLoopPair(this.a, this.b, this.spec.loopS || 16, this.spec.sr || 24000);
        this.ready = true;
      });
    };
    if (!ref || !ref.bundle) return;
    const have = assetManager.getBundle(ref.bundle);
    if (have) pull(have);
    else assetManager.loadBundle(ref.bundle, (err, bundle) => { if (!current()) return; if (err || !bundle) fail(err); else pull(bundle); });
  }
  play(_loop: boolean) { if (this.pair) { this.started = true; this.pair.start(); } }
  tick(dt: number) { if (this.pair && this.started) this.pair.tick(dt, this.vol); }
  release() {
    this.ticket++; this.ready = false; this.started = false; this.vol = 0;
    if (this.pair) { this.pair.stop(); this.pair = null; }
    const both = [this.a, this.b];
    for (let i = 0; i < both.length; i++) { const s = both[i]; if (s) { s.clip = null; s.destroy(); } }
    this.a = null; this.b = null;
    if (this.clip) { this.clip.decRef(); this.clip = null; }
  }
}
function named(node: Node | null, name: string): Node | null {
  if (!node || !node.activeInHierarchy) return null;
  if (node.name === name) return node;
  for (let i = 0; i < node.children.length; i++) { const found = named(node.children[i], name); if (found) return found; }
  return null;
}
@ccclass('LandmarkAudio')
export class LandmarkAudio extends Component {
  static instance: LandmarkAudio | null = null;
  private static nightSource: (() => number) | null = null;
  static setNightSource(fn: () => number) { LandmarkAudio.nightSource = fn; }
  private core: LandmarkAudioCore | null = null;
  private boot: any = null;
  private anchors: { [id: string]: Node | null } = {};
  private poll = 0;
  private place = '';
  static ensure() {
    try { const audio = GameAudio.ensure(); if (!audio.node.getComponent(LandmarkAudio)) audio.node.addComponent(LandmarkAudio); }
    catch (e) { console.warn('[LandmarkAudio] mount failed', e); }
  }
  onLoad() { LandmarkAudio.instance = this; this.core = new LandmarkAudioCore(spec => spec.loopS !== null ? new LoopVoice(this.node, spec) : new Voice(this.node, spec)); }
  quiet() { if (this.core) this.core.quiet(); }
  onDestroy() { this.quiet(); if (LandmarkAudio.instance === this) LandmarkAudio.instance = null; this.boot = null; this.anchors = {}; }
  update(dt: number) {
    const core = this.core, audio = GameAudio.instance;
    if (!core) return;
    const bed = (globalThis as any).__sceneAudioBed, place = bed ? bed.place : '';
    if (this.place !== place) { this.place = place; this.anchors = {}; this.poll = 0; }
    this.poll -= dt;
    if (this.poll <= 0) {
      this.poll = 0.5;
      const scene = director.getScene();
      if (!this.boot || !isValid(this.boot, true)) this.boot = scene ? scene.getComponentInChildren('WorldIntegrationBoot') : null;
      for (let i = 0; i < core.rows.length; i++) {
        const s = core.rows[i].spec, a = this.anchors[s.id];
        if (s.place === place && (!a || !isValid(a, true) || !a.activeInHierarchy)) this.anchors[s.id] = named(scene, s.anchor);
      }
    }
    const girl = this.boot && this.boot._referenceAdapter ? this.boot._referenceAdapter.node : null;
    const distances: { [id: string]: number } = {};
    for (let i = 0; i < core.rows.length; i++) {
      const s = core.rows[i].spec, anchor = this.anchors[s.id];
      if (!girl || !isValid(girl, true) || !girl.activeInHierarchy || !anchor || !isValid(anchor, true) || !anchor.activeInHierarchy) continue;
      const p = girl.worldPosition, q = anchor.worldPosition;
      distances[s.id] = Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y) + (p.z - q.z) * (p.z - q.z));
    }
    let night = 0;
    try { night = LandmarkAudio.nightSource ? Number(LandmarkAudio.nightSource()) : 0; } catch (e) { /* daylight fallback */ }
    if (!isFinite(night)) night = 0;
    const gain = audio ? ambienceBedGain(audio.getMusicVolume(), audio.transitionGain()) : 0;
    core.step(dt, place, distances, !!audio && audio.canPlayAmbience(), gain, night);
  }
}
director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => LandmarkAudio.ensure());
(GameAudio as any).ambienceMounters?.push(() => LandmarkAudio.ensure());
(GameAudio as any).ambienceQuieters?.push(() => LandmarkAudio.instance?.quiet());
