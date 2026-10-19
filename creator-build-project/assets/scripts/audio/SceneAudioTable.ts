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

/** Voice bot V2：已经交付、但还没接线的 BGM 候选（原创，48 kbps 立体声，响度和上面三首对齐，首尾相接的循环）。
 *  接线要改 SceneTrackId + SceneMusic.SCENE_TRACKS（播放器代码，留给 Cursor），再把 sail / lakeside 档的 track 指过来。
 *  sail：C 大调 6/8，在小岛 F 大调和草原 G 大调之间（C 是 F 的属调、G 的下属调），35.56 s。lakeside：F 大调 72 BPM 钢琴 + 竖琴，66.67 s，和湖声风铃的 C 五声不冲突。 */
export const BGM_CANDIDATES: { [id: string]: BgmRef & { loopS: number; key: string } } = {
  sail: { path: 'audio_amb/bgm_sail', bundle: 'transport_sail', loopS: 35.5556, key: 'C major 6/8, dotted-quarter 54' },
  lakeside: { path: 'audio/bgm_lakeside', bundle: 'region_lakeside', loopS: 66.6667, key: 'F major 4/4, 72 BPM' },
};

/** Voice bot V2：素材已在分包里、播放器还没写的层（鸟鸣 / 虫鸣 / 高空风 / 草原风）。档案的 layers 先不打开，免得开了也不响。
 *  每个循环文件在 loopS 之后带 0.15 s 自己开头的副本（和 amb_lake_loop 同一种格式）。 */
export const PENDING_LAYER_ASSETS: { [id: string]: { path: string; bundle: string | null; loopS: number | null } } = {
  birds: { path: 'audio/amb_meadow_birds_loop', bundle: 'region_meadow', loopS: 30.0 },
  insects: { path: 'audio/amb_meadow_insects_loop', bundle: 'region_meadow', loopS: 19.25 },
  highWind: { path: 'audio/amb_sky_air_loop', bundle: 'region_skycity', loopS: 32.0 },
  meadowWind: { path: 'audio_amb/amb_wind_soft_loop', bundle: null, loopS: null },
  shoreReal: { path: 'audio/amb_island_shore_loop', bundle: 'audio_bgm_island', loopS: 24.0 },
  seaOpen: { path: 'audio_amb/amb_sea_open_loop', bundle: 'transport_sail', loopS: 24.0 },
};

/** 三层环境音设计（ACNH 方法：底床 / 点缀 / 地标）。vol = 默认音乐滑条下的 AudioSource.volume（再乘 ambienceBedGain）。
 *  interval = 单发随机间隔 [min,max] 秒（开头到开头）。地标按距离：nearM 以内满音量，farM 以外静音，中间按 1/d 衰减；anchor 是场景 GLB 里的节点名。
 *  详细说明：docs/audio/scene-sound-design.md。 */
export type LayerClip = { path: string; bundle: string | null };
export type AmbBed = { id: string; clip: LayerClip; loopS: number | null; vol: number };
export type AmbScatter = { id: string; clips: LayerClip[]; vol: number; interval: [number, number]; pan: [number, number] };
export type AmbLandmark = { id: string; anchor: string; clips: LayerClip[]; loopS: number | null; vol: number; nearM: number; farM: number; interval?: [number, number] };
export type AmbDesign = { bed: AmbBed[]; scatter: AmbScatter[]; landmarks: AmbLandmark[] };
const R = (path: string, bundle: string | null): LayerClip => ({ path, bundle });
const GULLS = [R('audio_sfx/sfx_amb_gull_1', null), R('audio_sfx/sfx_amb_gull_2', null), R('audio_sfx/sfx_amb_gull_3', null)];
const BIRD_CALLS = [R('audio/sfx_meadow_bird_1', 'region_meadow'), R('audio/sfx_meadow_bird_2', 'region_meadow'), R('audio/sfx_meadow_bird_3', 'region_meadow')];
export const SCENE_AMBIENCE_DESIGN: { [place: string]: AmbDesign } = {
  home: { bed: [], scatter: [], landmarks: [] },
  island: {
    bed: [{ id: 'shore', clip: R('audio/amb_island_shore_loop', 'audio_bgm_island'), loopS: 24.0, vol: 0.7 }],
    scatter: [{ id: 'gulls', clips: GULLS, vol: 0.6, interval: [8, 20], pan: [-0.5, 0.5] }],
    landmarks: [
      { id: 'dock-lap', anchor: 'dock (IslandProps)', clips: [R('audio/amb_island_dock_lap_loop', 'audio_bgm_island')], loopS: 12.0, vol: 0.5, nearM: 2, farM: 12 },
      { id: 'lighthouse', anchor: 'GULL_FX.lighthouse', clips: [], loopS: null, vol: 0, nearM: 0, farM: 0 },
    ],
  },
  sail: {
    bed: [{ id: 'sea-open', clip: R('audio_amb/amb_sea_open_loop', 'transport_sail'), loopS: 24.0, vol: 0.8 }],
    scatter: [{ id: 'gulls-far', clips: [GULLS[1], GULLS[2]], vol: 0.38, interval: [5, 8], pan: [-0.5, 0.5] }],
    landmarks: [],
  },
  meadow: {
    bed: [
      { id: 'birds-bed', clip: R('audio/amb_meadow_birds_loop', 'region_meadow'), loopS: 30.0, vol: 0.8 },
      { id: 'insects', clip: R('audio/amb_meadow_insects_loop', 'region_meadow'), loopS: 19.25, vol: 0.5 },
      { id: 'breeze', clip: R('audio_amb/amb_wind_soft_loop', null), loopS: null, vol: 0.25 },
    ],
    scatter: [{ id: 'bird-calls', clips: BIRD_CALLS, vol: 0.5, interval: [6, 16], pan: [-0.6, 0.6] }],
    landmarks: [
      { id: 'windmill', anchor: 'windmill_sail_hub', clips: [R('audio/sfx_windmill_creak_1', 'region_meadow'), R('audio/sfx_windmill_creak_2', 'region_meadow')], loopS: null, vol: 0.45, nearM: 4, farM: 30, interval: [9, 18] },
      { id: 'river', anchor: 'meadow_river', clips: [R('audio/amb_meadow_river_loop', 'region_meadow')], loopS: 16.0, vol: 0.55, nearM: 3, farM: 25 },
      { id: 'wind-bell', anchor: 'wind_bell', clips: [R('audio/sfx_meadow_windbell_1', 'region_meadow'), R('audio/sfx_meadow_windbell_2', 'region_meadow')], loopS: null, vol: 0.45, nearM: 3, farM: 20, interval: [12, 26] },
    ],
  },
  lakeside: {
    bed: [{ id: 'lake', clip: R('audio/amb_lake_loop', 'region_lakeside'), loopS: 19.0, vol: 0.55 }],
    scatter: [],
    landmarks: [{ id: 'wind-chime', anchor: 'chime (LakesideSceneData)', clips: [], loopS: null, vol: 0, nearM: 0, farM: 0 }],
  },
  balloon: {
    bed: [{ id: 'high-wind', clip: R('audio/amb_sky_air_loop', 'region_skycity'), loopS: 32.0, vol: 0.5 }],
    scatter: [], landmarks: [],
  },
  skycity: {
    bed: [{ id: 'high-wind', clip: R('audio/amb_sky_air_loop', 'region_skycity'), loopS: 32.0, vol: 0.75 }],
    scatter: [],
    landmarks: [
      { id: 'waterfall', anchor: 'env_sky_waterfall_mist', clips: [R('audio/amb_sky_waterfall_loop', 'region_skycity')], loopS: 16.0, vol: 0.55, nearM: 4, farM: 35 },
      { id: 'wind-chime', anchor: 'env_sky_windchime', clips: [R('audio/sfx_sky_chime_1', 'region_skycity'), R('audio/sfx_sky_chime_2', 'region_skycity')], loopS: null, vol: 0.4, nearM: 3, farM: 20, interval: [10, 22] },
      { id: 'pennant', anchor: 'env_sky_pennant', clips: [R('audio_sfx/sfx_apron_flap', null)], loopS: null, vol: 0.18, nearM: 2, farM: 10, interval: [14, 30] },
    ],
  },
};

/** 方案 B（2026-10-18）：湖畔在天空之城之后，主线第 12 关后解锁，从天空之城坐热气球下降过去，只有这一条路。
 *  旅途中的声音用 balloon 档（高空风，没有海鸥 / 海浪），到达时换湖畔档。BGM 用 dip 交接：天空曲 D 小调 → 湖畔曲 F 大调，两首是关系调。
 *  高空风撑过 BGM 的空档，湖声在 dip 开始时淡入。试听：07_transition_skycity_balloon_lakeside_45s。 */
export type TravelRoute = {
  from: ScenePlace; via: ScenePlace; to: ScenePlace; unlock: string;
  bgmHandover: { shape: 'dip' | 'crossfade'; outS: number; inS: number; overlapS: number; toStartsAtBar1: boolean };
  bed: { fadeOut: string; fadeOutAfterS: number; fadeOutS: number; viaVol: number; fadeIn: string; fadeInS: number; toVol: number };
};
export const TRAVEL_ROUTES: { [target: string]: TravelRoute } = {
  lakeside: {
    from: 'skycity', via: 'balloon', to: 'lakeside', unlock: 'main-line level 12 cleared',
    bgmHandover: { shape: 'dip', outS: 4, inS: 4, overlapS: 2, toStartsAtBar1: true },
    bed: { fadeOut: 'highWind', fadeOutAfterS: 6, fadeOutS: 10, viaVol: 0.5, fadeIn: 'lake', fadeInS: 12, toVol: 0.55 },
  },
};

/** 待定层（候选素材已经放进分包，但还没进 SCENE_AMBIENCE_DESIGN，等 Funning 听完 12a/12b、13a/13b 决定）。播放器不要读这张表。 */
export const PENDING_CANDIDATES: { [id: string]: { place: ScenePlace; tier: 'scatter' | 'landmark'; clips: LayerClip[]; anchor?: string } } = {
  lakeWaterbirds: { place: 'lakeside', tier: 'scatter', clips: [R('audio/sfx_lake_waterbird_1', 'region_lakeside'), R('audio/sfx_lake_waterbird_2', 'region_lakeside'), R('audio/sfx_lake_waterbird_3', 'region_lakeside'), R('audio/sfx_lake_waterbird_4', 'region_lakeside')] },
  skyGardener: { place: 'skycity', tier: 'landmark', anchor: 'robot gardener', clips: [R('audio/sfx_sky_gardener_water_1', 'region_skycity'), R('audio/sfx_sky_gardener_water_2', 'region_skycity'), R('audio/sfx_sky_gardener_boop_1', 'region_skycity')] },
  skyStarring: { place: 'skycity', tier: 'landmark', anchor: 'starring_spin', clips: [R('audio/amb_sky_starring_loop', 'region_skycity')] },
};

/** 地面 → 脚步素材（4 个变体，文件名 _1.._4）。step_* 在 region_island 的是 r4 的合成脚步（r4.1 重录待 Mac 录音确认）；
 *  sand / cloud 是 Voice bot V2 的 CC0 候选（Kenney Impact Sounds 加工）。gain 和 FootstepCore.STEP_GAIN 用同一刻度（文件 100 ms RMS ≈ -24.5 dBFS）。 */
export const FOOTSTEP_SETS: { [surface: string]: { dir: string; bundle: string; gain: number } } = {
  wood: { dir: 'audio_steps/step_wood_', bundle: 'region_island', gain: 0.36 },
  rug: { dir: 'audio_steps/step_rug_', bundle: 'region_island', gain: 0.34 },
  stone: { dir: 'audio_steps/step_stone_', bundle: 'region_island', gain: 0.5 },
  path: { dir: 'audio_steps/step_path_', bundle: 'region_island', gain: 0.36 },
  grass: { dir: 'audio_steps/step_grass_', bundle: 'region_island', gain: 0.36 },
  sand: { dir: 'audio_steps/step_sand_', bundle: 'region_island', gain: 0.34 },
  cloud: { dir: 'audio_steps/step_cloud_', bundle: 'region_skycity', gain: 0.34 },
};
/** 每个地方会出现的地面（第一个是缺省）。dirt 用 path，木桥 / 栈道 / 船甲板用 wood，石阶 / 遗迹用 stone。 */
export const SCENE_GROUND_TYPES: { [place: string]: string[] } = {
  home: ['wood', 'rug'],
  island: ['grass', 'path', 'stone', 'wood', 'sand'],
  sail: ['wood'],
  meadow: ['grass', 'path', 'wood'],
  lakeside: ['grass', 'wood', 'stone', 'path'],
  balloon: ['wood'],
  skycity: ['cloud', 'stone', 'grass'],
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
  // 湖畔（方案 B：天空之城之后，坐热气球下降过去，见 TRAVEL_ROUTES）。湖畔 BGM 候选在 BGM_CANDIDATES，还没接线，暂时继续小岛曲。海浪让给湖水循环，海鸥停。
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
  // 方案 B 后，到达前应该是 balloon（从天空之城下降，见 TRAVEL_ROUTES.lakeside）。这是逻辑代码，留给 Cursor 改，测试要一起改。
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
