/**
 * Plays the island → meadow sailboat transition.
 * Timing is loaded from resources (SAILBOAT_TIMING_RESOURCE); frame numbers are not inlined.
 * Meadow art is loaded and mounted only through RegionLoader.
 * The sailboat model lives on SailboatPrefabSlot (its own file): cine/sailboat when that
 * prefab exists, otherwise SailboatPlaceholder.
 * The cover is a cloud bank, not a flat plate. The meadow is mounted under that bank,
 * its vertex-colour palette and key light are prepared, and it renders hidden frames
 * before the bank opens. One @ccclass in this file.
 */
import { _decorator, Component, Node, Prefab, Vec3, MeshRenderer, resources, JsonAsset, assetManager, input, Input, game, Game, director, isValid } from 'cc';
import { REGIONS, mountRegion } from '../region/RegionLoader';
import { islandPoseEntry } from '../world-r1/RegionCameraData';
import { Cancellation, Cancelled } from '../world-r1/WorldFlowCore';
import type { Pose } from '../world-r1/WorldFlowCore';
import { GameAudio } from '../audio/GameAudio';
import { SailboatPrefabSlot, SAILBOAT_PREFAB_RESOURCE, SAILBOAT_PREFAB_SLOT } from './SailboatPrefabSlot';
import { createSailboatCloudLayer, destroySailboatCloudLayer, syncSailboatCloudLayer } from './SailboatCloudLayer';
import type { SailboatCloudLayer } from './SailboatCloudLayer';
import { cloudBankCovers } from './SailboatCloudLayout';
import { stageMeadowReveal, restoreSailboatMeadowNight, syncSailboatMeadowNight } from './SailboatMeadowWarmup';
import { createMeadowStager } from './SailboatMeadowStager';
import type { MeadowStager } from './SailboatMeadowStager';
import { consumeSailboatMeadow, prefetchSailboatMeadow, prefetchedSailboatMeadow } from './SailboatMeadowPrefetch';
import {
  SAILBOAT_TIMING_RESOURCE, SAILBOAT_MAX_FRAME_DT, createSailboatPlayback, createSailboatStartGate, meadowRevealReady, parseSailboatTiming, sailboatCoverAlpha, sailboatIslandActive,
} from './SailboatTransitionModel';
import type { SailboatStartGate, SailboatAudioCommand, SailboatPlayback, SailboatSample, SailboatTiming, SailboatView } from './SailboatTransitionModel';

const { ccclass } = _decorator;

const PLACEHOLDER_DEPARTURE_DOLLY_M = 8;
const ISLAND_DOCK_NAMES = ['boat_dock', 'sailboat_dock', 'exit_path_17'];
const MEADOW_DOCK_NAMES = ['boat_dock', 'sailboat_dock', 'player_spawn'];
const ACTOR_NODE = 'FLOW_REFERENCE_PLACEHOLDER_NOT_B';

export class SailboatTransitionUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SailboatTransitionUnavailable';
  }
}

export interface SailboatStageHost {
  setCamera(pose: Pose): void;
  cameraNode: Node;
  cameraFov(): number;
  islandRoot: Node;
  mountParent: Node;
  token: Cancellation;
}

export function playSailboatTransition(host: SailboatStageHost): Promise<void> {
  return new Promise((resolve, reject) => {
    const root = new Node('SailboatTransition');
    host.mountParent.addChild(root);
    const driver = root.addComponent(SailboatTransitionDriver);
    driver.run(host, resolve, reject);
  });
}

@ccclass('SailboatTransitionDriver')
export class SailboatTransitionDriver extends Component {
  private host: SailboatStageHost | null = null;
  private resolveRun: (() => void) | null = null;
  private rejectRun: ((error: Error) => void) | null = null;
  private playback: SailboatPlayback | null = null;
  /** Sting and countdown start together, only once the exit camera has settled (see createSailboatStartGate). */
  private begun = false;
  private gate: SailboatStartGate = createSailboatStartGate();
  private timing: SailboatTiming | null = null;
  private closed = false;
  private presentedDone = false;
  private tapQueued = false;
  private hidden = false;
  private meadowPrefab: Prefab | null = null;
  /** Set only once every slice is active; see SailboatMeadowStager. */
  private meadowNode: Node | null = null;
  private stager: MeadowStager<Node> | null = null;
  private meadowPending = false;
  private meadowAttempts = 0;
  private meadowError: Error | null = null;
  private islandWasActive = true;
  private actor: Node | null = null;
  private actorWasActive = true;
  private cloud: SailboatCloudLayer | null = null;
  private frameDt = 0;
  /** Prefab is not enough: reveal waits until the meadow has rendered hidden under the cloud bank. */
  private warmed = false;
  private warmFrames = 0;
  private lastView: SailboatView | null = null;
  private boat: Node | null = null;
  private slot: SailboatPrefabSlot | null = null;
  private startPose: Pose | null = null;
  private offCancel: (() => void) | null = null;
  private readonly onTap = () => { this.tapQueued = true; };
  private readonly onHide = () => { this.hidden = true; this.step(0, false, true); };
  private readonly onShow = () => { this.hidden = false; this.step(0, false, false); };

  run(host: SailboatStageHost, resolve: () => void, reject: (error: Error) => void) {
    this.host = host;
    this.resolveRun = resolve;
    this.rejectRun = reject;
    this.offCancel = host.token.onCancel(() => { if (!this.closed) this.fail(new Cancelled()); });
    input.on(Input.EventType.TOUCH_END, this.onTap, this);
    input.on(Input.EventType.MOUSE_UP, this.onTap, this);
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    const island = islandPoseEntry();
    this.startPose = { position: [island.position[0], island.position[1], island.position[2]], target: [island.target[0], island.target[1], island.target[2]], fovVerticalDeg: island.fovVerticalDeg };
    this.actor = director.getScene()?.getChildByName(ACTOR_NODE) ?? null;
    if (this.actor) this.actorWasActive = this.actor.active;
    this.islandWasActive = host.islandRoot.active;
    this.prepareVisuals();
    this.requestMeadow();
    resources.load(SAILBOAT_TIMING_RESOURCE, JsonAsset, (error, asset) => {
      if (this.closed) return;
      if (error || !asset) { this.fail(new SailboatTransitionUnavailable(String(error || 'timing json missing'))); return; }
      try { this.timing = parseSailboatTiming(asset.json); }
      catch (parseError) { this.fail(new SailboatTransitionUnavailable(String(parseError))); return; }
      this.playback = createSailboatPlayback(this.timing, { startFov: this.startPose?.fovVerticalDeg });
    });
    this.maybeUseBoatAsset();
  }

  update(dt: number) {
    if (this.closed || !this.playback || this.hidden) return;
    if (this.presentedDone) { this.succeed(); return; }
    if (!this.begun) {
      const cam = this.host?.cameraNode;
      const sample = cam && isValid(cam, true) ? { position: [cam.worldPosition.x, cam.worldPosition.y, cam.worldPosition.z], forward: [cam.forward.x, cam.forward.y, cam.forward.z] } : null;
      if (!this.gate.feed(dt, sample)) return;
      this.begun = true;
      this.tapQueued = false;
      if (this.gate.reason !== 'settled') console.warn('[sailboat] start gate', this.gate.reason, this.gate.waitedSec.toFixed(2));
      // Sail start (timing frame 0): boat shown, sting and countdown begin in this same update.
      console.log('[sailboat] gate open', this.gate.reason, 'waited', this.gate.waitedSec.toFixed(3), 't', Date.now());
      if (this.boat && isValid(this.boat, true)) this.boat.active = true;
      this.apply(this.playback.begin());
      return;
    }
    const tap = this.tapQueued;
    this.tapQueued = false;
    this.frameDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, SAILBOAT_MAX_FRAME_DT) : 0;
    const budget = this.frameDt;
    let left = budget;
    let first = true;
    let done = false;
    do {
      const step = Math.min(left > 0 ? left : 0, 1 / 30);
      const sample = this.playback.advance(first ? Math.max(step, 0) : step, { meadowReady: this.warmed, tap: first && tap, background: false });
      first = false;
      this.apply(sample);
      if (sample.view.phase === 'done') done = true;
      if (this.closed) return;
      left -= step > 0 ? step : left;
      // Present the covered skip frame before a later substep can drop the cover.
      if (sample.view.phase === 'skip-hold') break;
    } while (left > 1e-4);
    if (this.lastView) this.stageMeadow(this.lastView);
    if (this.lastView) this.noteWarmth(this.lastView, budget);
    if (this.meadowNode && this.host) syncSailboatMeadowNight(this.meadowNode, this.host.cameraNode);
    if (done) this.presentedDone = true;
  }

  private step(dt: number, tap: boolean, background: boolean) {
    if (this.closed || !this.playback || !this.begun) return;
    this.frameDt = 0;
    const sample = this.playback.advance(dt, { meadowReady: this.warmed, tap, background });
    this.apply(sample);
  }

  private maybePreload(view: SailboatView) { if (view.preload) this.requestMeadow(); }
  private requestMeadow() {
    if (this.meadowPrefab || this.meadowPending || this.meadowError || this.closed) return;
    const ready = prefetchedSailboatMeadow();
    if (ready) { this.meadowPrefab = ready; return; }
    this.meadowPending = true;
    this.meadowAttempts++;
    prefetchSailboatMeadow().then(prefab => {
      this.meadowPending = false;
      if (this.closed) return;
      this.meadowPrefab = prefab;
    }, (error: unknown) => {
      this.meadowPending = false;
      console.warn('[sailboat] meadow load failed', this.meadowAttempts, error);
      if (this.meadowAttempts < 2 && !this.closed) this.requestMeadow();
      else this.meadowError = error instanceof Error ? error : Error('meadow-scene-load-failed');
    });
  }

  private apply(sample: SailboatSample) {
    if (this.closed || !this.host || !this.timing) return;
    this.dispatchAudio(sample.commands);
    const view = sample.view;
    const wasHolding = !!this.lastView && this.lastView.phase === 'holding';
    if (view.phase === 'holding' && !wasHolding) console.log('[sailboat] hold enter', 't', Date.now());
    else if (wasHolding && view.phase !== 'holding') console.log('[sailboat] hold leave', 't', Date.now());
    this.lastView = view;
    this.maybePreload(view);
    if (this.meadowError && (view.holding || view.phase === 'skip-hold')) { this.fail(Error('meadow-scene-load-failed')); return; }
    this.syncScene(view);
    this.syncCamera(view);
    this.syncBoat(view);
    this.syncCloud(view);
    this.syncActor(view);
  }

  /**
   * One mount stage per rendered frame (never per substep): instantiate inactive from the
   * cloud-closing frames, prepare inactive, then activate in slices only under a shut bank.
   * The island stays up until the swap, still behind that bank.
   */
  private stageMeadow(view: SailboatView) {
    const host = this.host;
    if (!host || this.meadowNode || this.meadowError || this.closed) return;
    if (!this.stager) {
      const parent = host.mountParent;
      const cameraNode = host.cameraNode;
      this.stager = createMeadowStager<Node>({
        instantiate: () => {
          const mounted = mountRegion(REGIONS.meadow, this.meadowPrefab as Prefab, parent, true);
          mounted.name = 'SailboatMeadowMount';
          return mounted;
        },
        prepare: root => {
          stageMeadowReveal(root, cameraNode);
          const out: { child: Node; weight: number }[] = [];
          const kids = root.children.slice();
          for (let i = 0; i < kids.length; i++) {
            if (!kids[i].active) continue; // authored-off children stay off
            out.push({ child: kids[i], weight: 1 + kids[i].getComponentsInChildren(MeshRenderer).length });
          }
          return out;
        },
        openRoot: (root, children) => {
          for (let i = 0; i < children.length; i++) children[i].active = false;
          root.active = true;
          // Under the shut bank: night sky and clear colour before any meadow pixel is drawn.
          syncSailboatMeadowNight(root, cameraNode);
        },
        activate: children => { for (let i = 0; i < children.length; i++) children[i].active = true; },
        now: () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()),
        log: message => console.log(message, 't', Date.now()),
      });
    }
    const covered = cloudBankCovers(sailboatCoverAlpha(view));
    try {
      this.stager.step({ frame: view.frame, covered, prefabReady: !!this.meadowPrefab });
    } catch (error) {
      console.warn('[sailboat] meadow mount failed', error);
      const root = this.stager.root;
      if (root && isValid(root, true)) root.destroy();
      this.meadowError = error instanceof Error ? error : Error('meadow-scene-load-failed');
      if (view.holding || view.phase === 'skip-hold' || view.phase === 'done') this.fail(Error('meadow-scene-load-failed'));
      return;
    }
    if (this.stager.mounted) {
      this.meadowNode = this.stager.root;
      this.warmFrames = 0;
      this.warmed = false;
    }
  }

  private noteWarmth(view: SailboatView, dt: number) {
    if (this.warmed || this.closed) return;
    if (!this.meadowNode || !cloudBankCovers(sailboatCoverAlpha(view))) { this.warmFrames = 0; return; }
    this.warmFrames += 1;
    console.log('[sailboat] meadow warm', this.warmFrames, 'frame', view.frame, 'dt ms', Math.round(dt * 1000), 't', Date.now());
    if (meadowRevealReady(this.warmFrames)) this.warmed = true;
  }

  private syncScene(view: SailboatView) {
    const host = this.host;
    if (!host || !isValid(host.islandRoot, true)) return;
    // Hide synchronously in this update, before the camera sample, and never turn it back on.
    if (!sailboatIslandActive(view.phase, view.swapped, 'live', this.islandWasActive)) host.islandRoot.active = false;
  }

  private syncCamera(view: SailboatView) {
    const host = this.host;
    const timing = this.timing;
    const start = this.startPose;
    if (!host || !timing || !start) return;
    if (view.scene === 'island') {
      host.setCamera(pullBack(start, view.departure * PLACEHOLDER_DEPARTURE_DOLLY_M, view.fov));
      return;
    }
    const shore = shorePose(timing);
    const blend = view.meadowBlend;
    host.setCamera({
      position: lerp3(shore.position, timing.endPose.position, blend),
      target: lerp3(shore.target, timing.endPose.target, blend),
      fovVerticalDeg: view.fov,
    });
  }

  private syncBoat(view: SailboatView) {
    const boat = this.boat;
    const host = this.host;
    if (!boat || !host) return;
    const meadow = view.boatSpace === 'meadow';
    const dock = meadow
      ? anchorOr(this.meadowNode, MEADOW_DOCK_NAMES, host.mountParent, [2, 0.2, 4])
      : anchorOr(host.islandRoot, ISLAND_DOCK_NAMES, host.islandRoot, [6, 0.2, 8]);
    const sea = dock.clone();
    sea.z += meadow ? 8 : 10;
    const at = meadow ? sea.lerp(dock, view.boatAlong) : dock.lerp(sea, view.boatAlong);
    boat.setWorldPosition(at);
  }

  private syncCloud(view: SailboatView) {
    const cloud = this.cloud;
    const host = this.host;
    if (!cloud || !host) return;
    syncSailboatCloudLayer(cloud, host.cameraNode, sailboatCoverAlpha(view), host.cameraFov(), this.frameDt);
    this.frameDt = 0;
  }

  private syncActor(view: SailboatView) {
    const actor = this.actor;
    if (!actor || !isValid(actor, true)) return;
    const aboard = view.departure > 0 || view.scene === 'meadow';
    actor.active = aboard ? false : this.actorWasActive;
  }

  private dispatchAudio(commands: SailboatAudioCommand[]) {
    if (!commands.length) return;
    let audio: GameAudio | null = null;
    try { audio = GameAudio.ensure(); } catch (error) { console.warn('[sailboat] audio unavailable', error); return; }
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.kind === 'cine-play') { console.log('[sailboat] sting start', 't', Date.now()); audio.playCineSlot(command.path, command.bundle); }
      else if (command.kind === 'cine-pause') audio.pauseCineSlot();
      else if (command.kind === 'cine-resume') audio.resumeCineSlot();
      else if (command.kind === 'cine-fade') audio.fadeCineSlot(command.seconds);
      else if (command.kind === 'cine-restore') audio.restoreCineSlot();
      else if (command.kind === 'cine-stop') audio.stopCineSlot();
      else if (command.kind === 'wind-loop') audio.loopHoldAmbience(command.path);
      else if (command.kind === 'wind-fade') audio.fadeHoldAmbience(command.seconds);
      else audio.stopHoldAmbience();
    }
  }

  private prepareVisuals() {
    const host = this.host;
    if (!host) return;
    this.cloud = createSailboatCloudLayer(host.cameraNode);
    const boat = new Node(SAILBOAT_PREFAB_SLOT);
    host.mountParent.addChild(boat);
    boat.layer = host.islandRoot.layer;
    this.boat = boat;
    boat.active = false; // shown on the first applied frame, after the start gate opens
    this.slot = boat.addComponent(SailboatPrefabSlot);
    this.slot.refresh();
  }

  private maybeUseBoatAsset() {
    const bundle = assetManager.getBundle('resources');
    const info = bundle?.getInfoWithPath(SAILBOAT_PREFAB_RESOURCE, Prefab);
    if (!info) return;
    resources.load(SAILBOAT_PREFAB_RESOURCE, Prefab, (error, prefab) => {
      if (this.closed || error || !prefab || !this.slot || !isValid(this.slot.node, true)) return;
      this.slot.sailboatPrefab = prefab;
      this.slot.refresh();
    });
  }

  private succeed() { this.cleanup(true); this.resolveRun?.(); this.resolveRun = null; this.rejectRun = null; }
  private fail(error: Error) { this.cleanup(false); this.rejectRun?.(error); this.resolveRun = null; this.rejectRun = null; }

  private cleanup(settled: boolean) {
    if (this.closed) return;
    this.closed = true;
    consumeSailboatMeadow();
    this.offCancel?.(); this.offCancel = null;
    input.off(Input.EventType.TOUCH_END, this.onTap, this);
    input.off(Input.EventType.MOUSE_UP, this.onTap, this);
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
    const host = this.host;
    restoreSailboatMeadowNight();
    // Settled keeps the island hidden. Restoring it here paints one frame of home
    // before the board camera and setLayers(NONE) run (skip landing, and meadow -> board).
    if (host && isValid(host.islandRoot, true)) host.islandRoot.active = sailboatIslandActive('done', true, settled ? 'settled' : 'aborted', this.islandWasActive);
    if (this.actor && isValid(this.actor, true)) this.actor.active = this.actorWasActive;
    // Leave the staged meadow mounted on success so this render is still the meadow. The level seal drops it.
    if (!settled) {
      if (this.meadowNode && isValid(this.meadowNode, true)) this.meadowNode.destroy();
      else if (this.stager && this.stager.root && isValid(this.stager.root, true)) this.stager.root.destroy();
    }
    this.meadowNode = null;
    this.stager = null;
    destroySailboatCloudLayer(this.cloud);
    this.cloud = null;
    if (this.boat && isValid(this.boat, true)) this.boat.destroy();
    this.boat = null;
    if (this.node && isValid(this.node, true)) this.node.destroy();
  }
}

function pullBack(pose: Pose, meters: number, fov: number): Pose {
  const dx = pose.position[0] - pose.target[0];
  const dy = pose.position[1] - pose.target[1];
  const dz = pose.position[2] - pose.target[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const scale = meters / len;
  return {
    position: [pose.position[0] + dx * scale, pose.position[1] + dy * scale, pose.position[2] + dz * scale],
    target: [pose.target[0], pose.target[1], pose.target[2]],
    fovVerticalDeg: fov,
  };
}
function shorePose(timing: SailboatTiming): { position: [number, number, number]; target: [number, number, number] } {
  const p = timing.endPose.position;
  const t = timing.endPose.target;
  const k = 0.62;
  return {
    position: [p[0] + (t[0] - p[0]) * k, t[1] + 2.2, p[2] + (t[2] - p[2]) * k],
    target: [t[0], t[1], t[2]],
  };
}
function lerp3(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function findNamed(root: Node | null, names: string[]): Node | null {
  if (!root || !isValid(root, true)) return null;
  const want: { [name: string]: boolean } = {};
  for (let i = 0; i < names.length; i++) want[names[i]] = true;
  const walk = (node: Node): Node | null => {
    if (want[node.name]) return node;
    for (let i = 0; i < node.children.length; i++) { const hit = walk(node.children[i]); if (hit) return hit; }
    return null;
  };
  return walk(root);
}
function anchorOr(root: Node | null, names: string[], fallback: Node, offset: [number, number, number]): Vec3 {
  const named = findNamed(root, names);
  if (named) return named.worldPosition.clone();
  const base = fallback.worldPosition;
  return new Vec3(base.x + offset[0], base.y + offset[1], base.z + offset[2]);
}