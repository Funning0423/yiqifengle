/** b19 雪山棋子：region_snowpass 自带的棋子精灵变体（同尺寸 192 px，精灵自带 ~3 px 深靛 #1d2440 描边）。
 *  只在雪山区域使用；其他区域继续用 board_art 的 PIECE_KEYS，不改共享棋子代码。
 *  接线（等雪山章节进 boardChapter 后）：棋子贴图取帧处若 chapter==='snow'，用 snowPieceFrame(type) 代替 BoardArt.shared().frame(PIECE_KEYS[type])。 */
import { assetManager, ImageAsset, SpriteFrame, Texture2D } from 'cc';
export const SNOW_PIECE_BUNDLE = 'region_snowpass';
export const SNOW_PIECE_KEYS: readonly string[] = ['board/piece_strawberry', 'board/piece_leaf', 'board/piece_blueberry', 'board/piece_flower', 'board/piece_acorn', 'board/piece_shell'];
const frames: SpriteFrame[] = [];
let loading: Promise<boolean> | null = null;
/** 加载 6 张雪山棋子帧；失败返回 false，调用方回退到 board_art 原图。 */
export function loadSnowPieces(): Promise<boolean> {
  if (loading) return loading;
  loading = new Promise<boolean>(ok => assetManager.loadBundle(SNOW_PIECE_BUNDLE, (e, b) => {
    if (e || !b) { loading = null; ok(false); return; }
    b.loadDir('board', ImageAsset, (err, list: ImageAsset[]) => {
      if (err || !list) { loading = null; ok(false); return; }
      for (let i = 0; i < SNOW_PIECE_KEYS.length; i++) {
        const img = b.get(SNOW_PIECE_KEYS[i], ImageAsset) as ImageAsset | null; if (!img) { loading = null; ok(false); return; }
        const t = new Texture2D(); t.image = img; t.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
        t.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        const f = new SpriteFrame(); f.texture = t; frames[i] = f;
      }
      ok(true);
    });
  }));
  return loading;
}
export function snowPieceFrame(type: number): SpriteFrame | null { return frames[((type % 6) + 6) % 6] || null; }
