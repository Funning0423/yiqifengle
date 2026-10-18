// SceneAudioTable.ts — 场景 → BGM / 环境音层。
// BGM 路径和交叉时长只改这里（SceneMusic.setMusic）。每层开或关也只改这里：SceneMusic 发布 globalThis.__sceneAudioBed，
// AmbienceAudio 读 waves/gulls，WindAudio 读 wind。没发布过床时，海浪 / 海鸥 / 风保持旧行为。
// 海浪、海鸥、风的文件名仍在各自播放器里，和下面 LAYER_ASSETS 相同。湖声的开关和循环参数在 LakeAmbienceCore，
// 和本表 lakeside 档一致（换那条循环还要改它的时长，不能只改路径）。
// missing 里的层没有素材，也没有播放器，不会出声。标了 NOT_FOR_SHIP 的文件不能写进这张表（仓库里目前没有这种标记）。
import { requiresLakesideScene, requiresMeadowScene, requiresSkycityScene } from '../world-r2/LevelRegion';

/** 区域过渡时 BGM 等功率交叉的时长（1.5–2.5 s 这一档的中间值）。进房第一次起播仍用 GameAudio.ROOM_FADE_IN_S。 */
export const SCENE_AUDIO_CROSSFADE_S = 2;

export type SceneTrackId = 'island' | 'meadow' | 'skycity';
export type AmbientLayerId = 'wind' | 'waves' | 'gulls' | 'birds' | 'insects' | 'highWind' | 'lake';
export type ScenePlace = 'home' | 'island' | 'sail' | 'meadow' | 'lakeside' | 'balloon' | 'skycity' | 'hold';

export type BgmRef = { path: string; bundle: string | null };
/** 正式 BGM。湖畔 / 帆船没有自己的曲子，不在这里占一个假路径。 */
export const BGM: Record<SceneTrackId, BgmRef> = {
  island: { path: 'audio/bgm_main', bundle: 'audio_bgm_island' },
  meadow: { path: 'audio/bgm_meadow', bundle: 'region_meadow' },
  skycity: { path: 'audio/bgm_skycity', bundle: 'region_skycity' },
};

/** 已有环境音层对应的资源（bundle 空 = resources）。鸟鸣 / 虫鸣 / 高空风没有条目。 */
export const LAYER_ASSETS: { [id: string]: { path: string; bundle: string | null } } = {
  waves: { path: 'audio_amb/amb_waves_loop', bundle: null },
  wind: { path: 'audio_amb/amb_wind_soft_loop', bundle: null },
  windStrong: { path: 'audio_amb/amb_wind_strong_loop', bundle: null },
  gulls: { path: 'audio_sfx/sfx_amb_gull_1', bundle: null },
  lake: { path: 'audio/amb_lake_loop', bundle: 'region_lakeside' },
};

export type SceneAudioProbe = {
  state?: string | null;
  stable?: string | null;
  boardPresent?: boolean;
  boardProvider?: string | null;
  boardRegion?: string | null;
  boardStageId?: string | null;
  journeyTarget?: string | null;
  journeyPhase?: string | null;
  journeyRegion?: string | null;
};

export type SceneProfile = {
  place: ScenePlace;
  /** null = 过渡中保持当前曲子（加载页 / 棋盘还没挂上）。 */
  track: SceneTrackId | null;
  /** 这个地方要开的层。只能填 LAYER_ASSETS 里有的 id。 */
  layers: AmbientLayerId[];
  /** 想要、但仓库里没有文件的层（或没有专用 BGM）。 */
  missing: string[];
};

const SEA: AmbientLayerId[] = ['wind', 'waves', 'gulls'];
export const SCENE_PROFILES: { [id: string]: SceneProfile } = {
  // 家里：小岛曲，室内。海鸥 / 海浪 / 风都关。
  home: { place: 'home', track: 'island', layers: [], missing: ['birds', 'insects'] },
  // 小岛 / 出海前的岸上：小岛曲 + 风、海浪、海鸥。
  island: { place: 'island', track: 'island', layers: SEA, missing: ['birds', 'insects'] },
  // 小岛 → 草原的帆船。没有海上专用 BGM，过渡一开始就交叉到草原曲；人还在海上，海鸥和海浪先留着。
  sail: { place: 'sail', track: 'meadow', layers: SEA, missing: ['sail-bgm', 'birds', 'insects'] },
  // 草原。海鸥必须停。没有草原风床 / 鸟鸣 / 虫鸣。
  meadow: { place: 'meadow', track: 'meadow', layers: [], missing: ['birds', 'insects', 'meadow-wind'] },
  // 湖畔。没有湖畔 BGM，继续小岛曲。海浪让给湖水循环，海鸥停。
  lakeside: { place: 'lakeside', track: 'island', layers: ['lake'], missing: ['lakeside-bgm', 'birds', 'insects', 'highWind'] },
  // 草原 → 天空之城的热气球。曲子交叉到天空之城。没有高空风素材。
  balloon: { place: 'balloon', track: 'skycity', layers: [], missing: ['highWind', 'birds', 'insects'] },
  skycity: { place: 'skycity', track: 'skycity', layers: [], missing: ['highWind', 'birds', 'insects'] },
  hold: { place: 'hold', track: null, layers: [], missing: [] },
};

export type SceneBed = {
  place: string;
  track: SceneTrackId | null;
  waves: boolean;
  gulls: boolean;
  wind: boolean;
  lake: boolean;
  birds: boolean;
  insects: boolean;
  highWind: boolean;
  missing: string[];
};

function has(layers: AmbientLayerId[], id: AmbientLayerId): boolean {
  return layers.indexOf(id) >= 0;
}

/** AmbienceAudio / WindAudio 读 globalThis.__sceneAudioBed。没发布过 = 旧行为（海浪海鸥开着），单测不用先挂 SceneMusic。 */
export function publishSceneBed(p: SceneProfile): SceneBed {
  const bed: SceneBed = {
    place: p.place, track: p.track,
    waves: has(p.layers, 'waves'), gulls: has(p.layers, 'gulls'), wind: has(p.layers, 'wind'), lake: has(p.layers, 'lake'),
    birds: has(p.layers, 'birds'), insects: has(p.layers, 'insects'), highWind: has(p.layers, 'highWind'),
    missing: p.missing.slice(),
  };
  (globalThis as any).__sceneAudioBed = bed;
  return bed;
}

function boardProfile(p: SceneAudioProbe): SceneProfile {
  const sel = { provider: p.boardProvider || '', stageId: p.boardStageId || '' };
  if (requiresMeadowScene(sel) || p.boardRegion === 'meadow') return SCENE_PROFILES.meadow;
  if (requiresSkycityScene(sel) || p.boardRegion === 'sky') return SCENE_PROFILES.skycity;
  if (requiresLakesideScene(sel) || p.boardRegion === 'lake') return SCENE_PROFILES.lakeside;
  return SCENE_PROFILES.island;
}

function previewJourney(region: string | null | undefined): SceneProfile | null {
  if (region === 'meadow') return SCENE_PROFILES.meadow;
  if (region === 'skycity') return SCENE_PROFILES.skycity;
  if (region === 'lakeside') return SCENE_PROFILES.lakeside;
  return null;
}

function travelProfile(p: SceneAudioProbe): SceneProfile {
  const target = p.journeyTarget || '';
  const phase = p.journeyPhase || '';
  if (target === 'skycity') return SCENE_PROFILES.balloon;
  if (target === 'lakeside') return phase === 'arrival' ? SCENE_PROFILES.lakeside : SCENE_PROFILES.island;
  if (target === 'meadow') return phase === 'arrival' ? SCENE_PROFILES.meadow : SCENE_PROFILES.sail;
  return SCENE_PROFILES.island;
}

function placeOfStable(stable: string): SceneProfile | null {
  if (stable === 'home') return SCENE_PROFILES.home;
  if (stable === 'island') return SCENE_PROFILES.island;
  if (stable === 'meadow') return SCENE_PROFILES.meadow;
  if (stable === 'skycity') return SCENE_PROFILES.skycity;
  if (stable === 'lakeside') return SCENE_PROFILES.lakeside;
  if (stable === 'level') return SCENE_PROFILES.hold;
  return null;
}

/**
 * 世界状态 → 档案。
 * hold：曲目先别动（天空之城加载、进关卡、区域还在准备）。
 * region-travel：帆船 / 热气球是一段自己的场景，按目的地切 BGM；海鸥只留在真正的海上。
 * paused：用 stable（后台那一下 hide 会把 state 改成 paused，地方还在 stable 上）。
 * 不要用 journey.target 猜暂停点——行程被取消时 target 还指着没到的地方。
 */
export function resolveSceneAudio(p: SceneAudioProbe): SceneProfile {
  const state = p.state || '';
  const stable = p.stable || '';
  if (state === 'error' || state === 'disposed') return SCENE_PROFILES.hold;
  if (state === 'skycity-loading' || state === 'region-loading') return SCENE_PROFILES.hold;
  if (!p.boardPresent && (state === 'level-loading' || state === 'level')) return previewJourney(p.journeyRegion) || SCENE_PROFILES.hold;
  if (state === 'level-loading') return SCENE_PROFILES.hold;
  if (p.boardPresent && (state === 'level' || (state === 'paused' && stable === 'level'))) return boardProfile(p);
  if (state === 'region-travel') return travelProfile(p);
  if (state === 'paused') return placeOfStable(stable) || SCENE_PROFILES.hold;
  if (state === 'home') return SCENE_PROFILES.home;
  if (state === 'meadow') return SCENE_PROFILES.meadow;
  if (state === 'skycity') return SCENE_PROFILES.skycity;
  if (state === 'lakeside') return SCENE_PROFILES.lakeside;
  if (state === 'island') return SCENE_PROFILES.island;
  if (stable === 'skycity') return SCENE_PROFILES.skycity;
  if (stable === 'meadow') return SCENE_PROFILES.meadow;
  if (stable === 'lakeside') return SCENE_PROFILES.lakeside;
  return SCENE_PROFILES.island;
}
