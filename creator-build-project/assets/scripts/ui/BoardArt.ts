import { assetManager, AssetManager, ImageAsset, Prefab, SpriteFrame, TextAsset, Texture2D } from 'cc';
/** Phase-1 board / popup art (bundle `board_art`, filled by tools/board_art_sync.py). Images are loaded as ImageAsset and
 *  wrapped in runtime SpriteFrames, one directory at a time, on first use. Keys are 'dir/name' (e.g. 'board/piece_leaf'). */
export const BOARD_ART_BUNDLE = 'board_art';
/** Island / tide / meadow / mainline / R4. Meadow has no scene GLB, so it keeps this picture. */
export const BOARD_BACKGROUND = { bundle: 'region_island', path: 'board/bg_island_board' } as const;
/** 天空回声 regional boards (r05-sky-*). Painted from env_skycity.glb. Night multiplies this same picture by K_SEA. */
export const SKY_BOARD_BACKGROUND = { bundle: 'region_skycity', path: 'board/bg_skycity_board' } as const;
export type BoardPicture = { readonly bundle: string; readonly path: string };
/** '' | 'tide' | 'meadow' | 'sky'. Only r05-* stage ids are chapters here.
 *  Mainline-09..12 are 月影古树 (继续旅程), not the 天空回声 board opened from the journey book. */
export function boardChapter(selection: { provider?: string; stageId?: string } | null): string {
  const id = selection && selection.stageId ? String(selection.stageId) : '';
  if (id.indexOf('r05-tide-') === 0) return 'tide';
  if (id.indexOf('r05-meadow-') === 0) return 'meadow';
  if (id.indexOf('r05-sky-') === 0) return 'sky';
  return '';
}
/** Picture createIslandBoardBackground loads. 天空回声 → sky city; meadow stays on the island (no env_meadow.glb). */
export function boardBackgroundFor(selection: { provider?: string; stageId?: string } | null): BoardPicture {
  if (boardChapter(selection) === 'sky') return SKY_BOARD_BACKGROUND;
  return BOARD_BACKGROUND;
}
export type ArtDir = 'board' | 'popup' | 'r2' | 'r3';
/** Source-pixel insets [left, top, right, bottom] of the 9- / 3-slice pieces (c-popups sizes.json, r2 sizes.json). */
export const SLICES: Record<string, readonly number[]> = {
  'popup/panel_frame_9s': [92, 92, 92, 92],
  'popup/title_plank_3s': [84, 0, 84, 0],
  'popup/btn_primary_3s': [69, 0, 69, 0],
  'popup/btn_secondary_3s': [69, 0, 69, 0],
  'popup/toggle_on': [28, 0, 28, 0],
  'popup/toggle_off': [28, 0, 28, 0],
  'r2/sign_plank_3s': [90, 0, 90, 0],
  'board/hud_levelplate': [64, 0, 64, 0],
};
/** Board piece art by engine tile type 0..5: strawberry / leaf / blueberry / flower / acorn / scallop shell. */
export const PIECE_KEYS: readonly string[] = ['board/piece_strawberry', 'board/piece_leaf', 'board/piece_blueberry', 'board/piece_flower', 'board/piece_acorn', 'board/piece_shell'];
/** Tool art for the board tray and panels; regional tools keep ManagedToolArt (tools-original.png) until Funning signs off. */
export const TOOL_KEYS: Record<string, string> = { bomb: 'board/tool_starlight', windBell: 'board/tool_windbell', tideBottle: 'board/tool_tidebottle' };
export const HERO_KEYS: Record<string, string> = { bomb: 'r2/hero_starlight', windBell: 'r2/hero_windbell', tideBottle: 'r2/hero_tidebottle' };
type Waiter = () => void;
export class BoardArt {
  private static instance: BoardArt | null = null;
  static shared(): BoardArt { return BoardArt.instance || (BoardArt.instance = new BoardArt()); }
  private bundle: AssetManager.Bundle | null = null;
  private bundleWait: Promise<AssetManager.Bundle | null> | null = null;
  private frames = new Map<string, SpriteFrame>();
  private dirs = new Map<ArtDir, Promise<boolean>>();
  private done = new Set<ArtDir>();
  private waiters: Waiter[] = [];
  private failures: string[] = [];
  private chest: Promise<Prefab | null> | null = null;
  private loadBundle(): Promise<AssetManager.Bundle | null> {
    if (this.bundle) return Promise.resolve(this.bundle);
    if (!this.bundleWait) this.bundleWait = new Promise(ok => {
      const have = assetManager.getBundle(BOARD_ART_BUNDLE); if (have) { this.bundle = have; ok(have); return; }
      assetManager.loadBundle(BOARD_ART_BUNDLE, (e, b) => { if (e || !b) { this.failures.push('bundle:' + String(e)); this.bundleWait = null; ok(null); return; } this.bundle = b; ok(b); });
    });
    return this.bundleWait;
  }
  /** Load one directory of images (idempotent). Resolves false on failure; callers keep their fallback look. */
  load(dir: ArtDir): Promise<boolean> {
    const have = this.dirs.get(dir); if (have) return have;
    const p = this.loadBundle().then(b => !b ? false : new Promise<boolean>(ok => {
      b.loadDir(dir, ImageAsset, (e, list: ImageAsset[]) => {
        if (e || !list) { this.failures.push(dir + ':' + String(e)); this.dirs.delete(dir); ok(false); return; }
        const infos = b.getDirWithPath(dir, ImageAsset);
        for (let i = 0; i < infos.length; i++) {
          const info = infos[i], image = b.get(info.path, ImageAsset) as ImageAsset | null; if (!image) continue;
          const texture = new Texture2D(); texture.image = image;
          texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
          texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
          const frame = new SpriteFrame(); frame.texture = texture;
          const ins = SLICES[info.path]; if (ins) { frame.insetLeft = ins[0]; frame.insetTop = ins[1]; frame.insetRight = ins[2]; frame.insetBottom = ins[3]; }
          this.frames.set(info.path, frame);
        }
        this.done.add(dir); ok(true); this.flush();
      });
    }));
    this.dirs.set(dir, p); return p;
  }
  loaded(dir: ArtDir): boolean { return this.done.has(dir); }
  frame(key: string): SpriteFrame | null { return this.frames.get(key) || null; }
  size(key: string): { width: number; height: number } {
    const f = this.frames.get(key); return f ? { width: f.originalSize.width, height: f.originalSize.height } : { width: 0, height: 0 };
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
  diagnostics() { return { bundle: !!this.bundle, dirs: Array.from(this.done), frames: this.frames.size, failures: this.failures.slice() }; }
}
