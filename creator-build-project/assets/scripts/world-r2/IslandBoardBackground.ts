import { _decorator, Component, assetManager, AssetManager, ImageAsset, Texture2D, SpriteFrame, Sprite, Node, Layers, UITransform, UIOpacity, Color, isValid } from 'cc';
import type { LevelBackgroundFactory, LevelBackgroundFrame } from './LevelBackground';
import type { Cancellation } from '../world-r1/WorldFlowCore';
import { boardBackgroundFor, boardChapter } from '../ui/BoardArt';
import { tintRgb, uiNightWeight } from '../ui/NightTint';
const { ccclass } = _decorator;
/** Board scenery: one painted picture (750×1624), cover-fit behind the board HUD.
 *  天空回声 (r05-sky-*) loads region_skycity/board/bg_skycity_board.jpg. Tide, R4, mainline, and 花粉草甸
 *  (meadow entry is blocked until its real scene is integrated) load region_island/board/bg_island_board.jpg.
 *  Night multiplies the same picture by K_SEA. There is no second night render. */
export const BACKGROUND_SIZE = { width: 750, height: 1624 } as const;
export function coverSize(width: number, height: number, iw = BACKGROUND_SIZE.width, ih = BACKGROUND_SIZE.height) {
  const s = Math.max(width / iw, height / ih); return { width: iw * s, height: ih * s, scale: s };
}
@ccclass('IslandBoardBackgroundTint')
class IslandBoardBackgroundTint extends Component {
  sprite: Sprite | null = null; private last = -1; night = 0;
  update() {
    const s = this.sprite; if (!s || !isValid(s.node, true)) return;
    const w = uiNightWeight(); if (Math.abs(w - this.last) < 0.002) return; this.last = w; this.night = w;
    const c = tintRgb('sea', w); s.color = new Color(c[0], c[1], c[2], 255);
  }
}
function loadBundle(name: string, token: Cancellation): Promise<AssetManager.Bundle> {
  const ready = assetManager.getBundle(name); if (ready) return Promise.resolve(ready);
  return token.wait(new Promise((resolve, reject) => assetManager.loadBundle(name, (error, bundle) => error || !bundle ? reject(error || Error('Missing background bundle ' + name)) : resolve(bundle))));
}
export const createIslandBoardBackground: LevelBackgroundFactory = async ({ parent, selection, token }) => {
  let disposed = false, visible = false, node: Node | null = null, asset: ImageAsset | null = null, texture: Texture2D | null = null, frame: SpriteFrame | null = null, tint: IslandBoardBackgroundTint | null = null, lastKey = '';
  const picture = boardBackgroundFor(selection), chapter = boardChapter(selection);
  let offCancel = () => { };
  const dispose = () => {
    if (disposed) return; disposed = true; offCancel();
    if (node && isValid(node, true)) node.destroy(); node = null; tint = null;
    frame?.destroy(); frame = null; texture?.destroy(); texture = null; asset?.decRef(); asset = null;
  };
  offCancel = token.onCancel(dispose);
  try {
    token.check();
    const bundle = await loadBundle(picture.bundle, token); token.check();
    asset = await token.wait(new Promise<ImageAsset>((resolve, reject) => bundle.load(picture.path, ImageAsset, (error, a) => error || !a ? reject(error || Error('Missing board background ' + picture.bundle + '/' + picture.path)) : resolve(a))));
    if (disposed) throw Error('Background disposed during image load'); asset.addRef();
    texture = new Texture2D(); texture.image = asset; frame = new SpriteFrame(); frame.texture = texture;
    return {
      frame: (_portrait: boolean, layout?: LevelBackgroundFrame) => {
        if (disposed) return; token.check(); if (!layout) throw Error('Board background requires actual board layout');
        const { width, height } = layout; if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) throw Error('Invalid board background layout');
        const canvasRoot = parent.getChildByName('NativeBoardCanvas'); if (!canvasRoot) throw Error('Native board Canvas missing');
        if (!node) {
          node = new Node('IslandBoardBackground'); node.layer = Layers.Enum.UI_2D; canvasRoot.addChild(node); node.setSiblingIndex(0); node.addComponent(UITransform);
          const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false; sprite.spriteFrame = frame;
          tint = node.addComponent(IslandBoardBackgroundTint); tint.sprite = sprite; tint.update(); node.active = visible;
        }
        const key = width + '/' + height; if (key === lastKey) return; lastKey = key;
        const c = coverSize(width, height); node.getComponent(UITransform)!.setContentSize(c.width, c.height); node.setPosition(0, 0, 0);
      },
      setVisible: (value: boolean) => { if (disposed) return; visible = value; if (node && isValid(node, true)) node.active = value; },
      setFade: (a: number) => { if (disposed || !node || !isValid(node, true)) return; const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity); op.opacity = Math.round(255 * Math.min(1, Math.max(0, a))); },
      setPaused: () => { },
      diagnostics: () => ({ renderer: 'board-ui-static-picture', bundle: picture.bundle, path: picture.path, chapter, provider: selection.provider, stageId: selection.stageId, visible, night: tint?.night ?? 0, size: node ? { width: node.getComponent(UITransform)!.width, height: node.getComponent(UITransform)!.height } : null, dynamicTextureUploads: 0 }),
      dispose,
    };
  } catch (error) { dispose(); throw error; }
};
