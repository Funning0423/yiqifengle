import { requiresMeadowScene, requiresSkycityScene, requiresLakesideScene, MEADOW_UNAVAILABLE } from '../world-r2/LevelRegion';
import { assetManager, AssetManager, ImageAsset, Prefab, SpriteFrame, TextAsset, Texture2D } from 'cc';
/** Phase-1 board / popup art (bundle `board_art`, filled by tools/board_art_sync.py). Images are loaded as ImageAsset and
 *  wrapped in runtime SpriteFrames, one directory at a time, on first use. Keys are 'dir/name' (e.g. 'board/piece_leaf'). */
export const BOARD_ART_BUNDLE = 'board_art';
/** Island/tide board art. Meadow must never silently select this picture. */
export const BOARD_BACKGROUND = { bundle: 'region_island', path: 'board/bg_island_board' } as const;
/** 天空回声 regional boards (r05-sky-*). Painted from env_skycity.glb. Night multiplies this same picture by K_SEA. */
export const SKY_BOARD_BACKGROUND = { bundle: 'region_skycity', path: 'board/bg_skycity_board' } as const;
export type BoardPicture = { readonly bundle: string; readonly path: string };
/** Mainline chapter identity follows the same island → meadow → sky-city campaign as regional challenges. */
export function boardChapter(selection: { provider?: string; stageId?: string } | null): string {
  const id = selection && selection.stageId ? String(selection.stageId) : '';
  if (id.indexOf('r05-tide-') === 0) return 'tide';
  if (requiresMeadowScene(selection)) return 'meadow';
  if (requiresSkycityScene(selection)) return 'sky';
  if (requiresLakesideScene(selection)) return 'lake';
  return '';
}
/** Exact supported picture; missing meadow scenery is an explicit entry failure. */
export function boardBackgroundFor(selection: { provider?: string; stageId?: string } | null): BoardPicture {
  if (requiresMeadowScene(selection)) throw Error(MEADOW_UNAVAILABLE);
  if (boardChapter(selection) === 'sky') return SKY_BOARD_BACKGROUND;
  return BOARD_BACKGROUND;
}
export type ArtDir = 'board' | 'popup' | 'r2' | 'r3';
/** Source-pixel insets [left, top, right, bottom] of the 9- / 3-slice pieces (c-popups sizes.json, r2 sizes.json).
 *  Settings chrome and main buttons are stored at 3× the old texture grid; ART_PX tells artSprite to scale that
 *  node back down so the border on screen stays the old design width. */
export const ART_PX: Record<string, number> = {
  'popup/panel_frame_9s': 3,
  'popup/title_plank_3s': 3,
  'popup/btn_primary_3s': 3,
  'popup/btn_secondary_3s': 3,
  'popup/toggle_on': 3,
  'popup/toggle_off': 3,
};
export const SLICES: Record<string, readonly number[]> = {
  'popup/panel_frame_9s': [276, 276, 276, 276],
  'popup/title_plank_3s': [252, 0, 252, 0],
  'popup/btn_primary_3s': [207, 0, 207, 0],
  'popup/btn_secondary_3s': [207, 0, 207, 0],
  'popup/toggle_on': [84, 0, 84, 0],
  'popup/toggle_off': [84, 0, 84, 0],
  'r2/sign_plank_3s': [90, 0, 90, 0],
  'board/hud_levelplate': [64, 0, 64, 0],
};
/** Board piece art by engine tile type 0..5: strawberry / leaf / blueberry / flower / acorn / scallop shell. */
export const PIECE_KEYS: readonly string[] = ['board/piece_strawberry', 'board/piece_leaf', 'board/piece_blueberry', 'board/piece_flower', 'board/piece_acorn', 'board/piece_shell'];
/** Tray and panel pictures. bomb / windBell / tideBottle stay on the board slices (tools-original.png is only their
 *  fallback, and that atlas is not replaced). tideNet / sunSeed / starShears use the signed-off r2 slices. */
export const TOOL_KEYS: Record<string, string> = {
  bomb: 'board/tool_starlight', windBell: 'board/tool_windbell', tideBottle: 'board/tool_tidebottle',
  tideNet: 'r2/tool_tidenet', sunSeed: 'r2/tool_sunseed', starShears: 'r2/tool_starshears',
};
/** Fit a tool picture to `slot` on the width (bag mock fitw). Square art stays square; cropped regional slices keep their aspect. */
export function toolDisplaySize(kind: string, slot: number): { width: number; height: number } {
  const key = TOOL_KEYS[kind];
  if (!key) return { width: slot, height: slot };
  const dim = BoardArt.shared().size(key);
  if (!(dim.width > 0) || !(dim.height > 0)) return { width: slot, height: slot };
  return { width: slot, height: slot * dim.height / dim.width };
}
export const HERO_KEYS: Record<string, string> = { bomb: 'r2/hero_starlight', windBell: 'r2/hero_windbell', tideBottle: 'r2/hero_tidebottle' };
type Waiter = () => void;
export class BoardArt {
  private static instance: BoardArt | null = null;
  static shared(): BoardArt { return BoardArt.instance || (BoardArt.instance = new BoardArt()); }
  private bundle: AssetManager.Bundle | null = null;
  private bundleWait: Promise<AssetManager.Bundle | null> | null = null;
  private cancelBundleWait: (() => void) | null = null;
  private frames = new Map<string, SpriteFrame>();
  private dirs = new Map<ArtDir, Promise<boolean>>();
  private pending = new Map<ArtDir, { promise: Promise<boolean>; cancel: () => void }>();
  private done = new Set<ArtDir>();
  private waiters: Waiter[] = [];
  private failures: string[] = [];
  private chest: Promise<Prefab | null> | null = null;
  private loadBundle(): Promise<AssetManager.Bundle | null> {
    if (this.bundle) return Promise.resolve(this.bundle);
    if (this.bundleWait) return this.bundleWait;
    let resolve!: (bundle: AssetManager.Bundle | null) => void, settled = false;
    const promise = new Promise<AssetManager.Bundle | null>(ok => { resolve = ok; });
    this.bundleWait = promise;
    const finish = (bundle: AssetManager.Bundle | null, error?: unknown): void => {
      if (settled) return; settled = true;
      // A cancelled callback may arrive after a newer bundle request has started.
      if (this.bundleWait !== promise) { resolve(null); return; }
      this.bundleWait = null; this.cancelBundleWait = null;
      if (bundle) this.bundle = bundle;
      else if (error) this.failures.push('bundle:' + String(error));
      resolve(bundle);
    };
    this.cancelBundleWait = () => finish(null, 'cancelled pending load');
    try {
      const have = assetManager.getBundle(BOARD_ART_BUNDLE);
      if (have) finish(have);
      else assetManager.loadBundle(BOARD_ART_BUNDLE, (e, b) => finish(e ? null : b || null, e || (!b ? 'missing bundle' : undefined)));
    } catch (error) { finish(null, error); }
    return promise;
  }
  private complete(dir: ArtDir): boolean {
    return dir !== 'board' || PIECE_KEYS.every(key => !!this.frames.get(key));
  }
  /** Invalidate only the request a caller actually waited for. An old entry timeout
   * cannot evict a newer successful request. Engine callbacks are not cancellable;
   * closing this generation makes their late callbacks inert. Never touches saves. */
  cancelLoad(dir: ArtDir, expected: Promise<boolean>): boolean {
    if (this.dirs.get(dir) !== expected) return false;
    const request = this.pending.get(dir);
    if (!request && this.loaded(dir)) return false;
    if (request) request.cancel();
    else { this.dirs.delete(dir); this.done.delete(dir); }
    // If the shared bundle callback itself hung, all waiters must settle before
    // the next explicit entry can request a fresh bundle. Loaded bundles stay.
    if (!this.bundle) this.cancelBundleWait?.();
    return true;
  }
  /** Idempotent within one generation. Publish a complete directory atomically;
   * failures resolve false and remain retryable, including missing required pieces. */
  load(dir: ArtDir): Promise<boolean> {
    const have = this.dirs.get(dir);
    if (have) {
      if (!this.done.has(dir) || this.complete(dir)) return have;
      this.cancelLoad(dir, have);
    }
    let resolve!: (ok: boolean) => void, settled = false;
    const promise = new Promise<boolean>(ok => { resolve = ok; });
    const request: { promise: Promise<boolean>; cancel: () => void } = { promise, cancel: () => finish(false, 'cancelled pending directory') };
    const current = (): boolean => !settled && this.pending.get(dir) === request && this.dirs.get(dir) === promise;
    const finish = (ok: boolean, error?: unknown): void => {
      if (!current()) return; settled = true; this.pending.delete(dir);
      if (!ok) { this.dirs.delete(dir); this.done.delete(dir); if (error) this.failures.push(dir + ':' + String(error)); }
      else this.done.add(dir);
      resolve(ok);
    };
    this.dirs.set(dir, promise); this.pending.set(dir, request);
    void this.loadBundle().then(bundle => {
      if (!current()) return;
      if (!bundle) { finish(false, 'missing bundle'); return; }
      try { bundle.loadDir(dir, ImageAsset, (error, list: ImageAsset[]) => {
        if (!current()) return;
        if (error || !list) { finish(false, error || 'missing directory'); return; }
        const staged = new Map<string, SpriteFrame>(), textures: Texture2D[] = [], frames: SpriteFrame[] = [];
        try {
          const infos = bundle.getDirWithPath(dir, ImageAsset);
          for (const info of infos) {
            const image = bundle.get(info.path, ImageAsset) as ImageAsset | null; if (!image) continue;
            const texture = new Texture2D(); textures.push(texture); texture.image = image;
            texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
            texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
            const frame = new SpriteFrame(); frames.push(frame); frame.texture = texture;
            const ins = SLICES[info.path]; if (ins) { frame.insetLeft = ins[0]; frame.insetTop = ins[1]; frame.insetRight = ins[2]; frame.insetBottom = ins[3]; }
            staged.set(info.path, frame);
          }
          if (dir === 'board' && !PIECE_KEYS.every(key => staged.has(key))) throw Error('required piece frame missing');
          if (!current()) throw Error('superseded directory');
          for (const [key, frame] of staged) this.frames.set(key, frame);
          finish(true); this.flush();
        } catch (error) {
          // Failed/partial textures were never published to any Sprite.
          for (const frame of frames) frame.destroy();
          for (const texture of textures) texture.destroy();
          finish(false, error);
        }
      }); } catch (error) { finish(false, error); }
    }, error => finish(false, error));
    return promise;
  }
  loaded(dir: ArtDir): boolean { return this.done.has(dir) && this.complete(dir); }
  frame(key: string): SpriteFrame | null { return this.frames.get(key) || null; }
  size(key: string): { width: number; height: number } {
    const f = this.frames.get(key); if (!f) return { width: 0, height: 0 };
    const px = ART_PX[key] || 1;
    return { width: f.originalSize.width / px, height: f.originalSize.height / px };
  }
  /** Called after every directory load: lets views repaint once art lands. */
  onChange(cb: Waiter): () => void { this.waiters.push(cb); return () => { const i = this.waiters.indexOf(cb); if (i >= 0) this.waiters.splice(i, 1); }; }
  private flush() { const list = this.waiters.slice(); for (let i = 0; i < list.length; i++) { try { list[i](); } catch (e) { console.warn('[BOARD_ART] listener', String(e)); } } }
  text(path: string): Promise<string> {
    return this.loadBundle().then(b => !b ? '' : new Promise<string>(ok => b.load(path, TextAsset, (e, t: TextAsset) => ok(e || !t ? '' : t.text))));
  }
  chestPrefab(): Promise<Prefab | null> {
    if (!this.chest) this.chest = this.loadBundle().then(b => !b ? null : new Promise<Prefab | null>(ok => b.loadDir('chest', Prefab, (e, list: Prefab[]) => {
      if (e || !list || !list.length) { this.failures.push('chest:' + String(e)); this.chest = null; ok(null); return; } ok(list[0]);
    })));
    return this.chest;
  }
  diagnostics() { return { bundle: !!this.bundle, bundlePending: !!this.bundleWait, pendingDirs: Array.from(this.pending.keys()), dirs: Array.from(this.done), frames: this.frames.size, failures: this.failures.slice() }; }
}
