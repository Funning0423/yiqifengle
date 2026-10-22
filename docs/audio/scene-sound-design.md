# 场景声音设计 V2（Voice bot，2026-10-18；第二次交付：ACNH 补充 + 映射到真实配置表）

现在的问题：小岛→草原、草原→天空之城 BGM 不换，草原上还在放海鸥。切换代码在云端 `feat/scene-audio-r1`（17c75b2，
`SceneAudioTable.ts` + `SceneMusic.ts`），已经合进本分支。**这份文档只管声音设计、素材和配置数据，不写播放器代码。**

- **配置（真实格式）**：`creator-build-project/assets/scripts/audio/SceneAudioTable.ts`。本分支只加了数据：
  `BGM_CANDIDATES`、`PENDING_LAYER_ASSETS`、`SCENE_AMBIENCE_DESIGN`（三层环境音）、`FOOTSTEP_SETS`、`SCENE_GROUND_TYPES`。见 §8。
- `docs/audio/scene-audio-table.json` 是第一次交付时的暂定表，**已被 SceneAudioTable.ts 取代**。只留作过渡数值（dip、渐入渐出秒数）的设计记录。
- 素材出处和许可：`docs/audio-credits.md` 的「Scene ambience V2」和「second delivery」两节。
- 生成脚本和实测：`tools/voice-bot/scene-audio-v2/`（`measurements.json`、`music/`、`s_landmarks.py`、`s_steps.py`）。
- 试听：共享电脑上的 `/workspace/yiqifengle/previews/Voice-bot/v2-scene-audio/`（只有 mp3，带 README）。
- 参考：`/workspace/b05/research/acnh/REPORT.md` §7（一个主题多地区编配；环境音分三层；按地面换脚步）。

## 0. 总原则（Funning 的偏好）
- 平静、治愈。动物声要成群、远近有别、不慌不忙，绝不急促。
- 自然声音优先用真实录音，不用程序合成。自然声里只有天空之城的「高空风 + 微光」是自己合成的（真实高空风录音找不到可用的，见 §10）。风铃（乐器）和两首新 BGM 是自己作曲、自己合成的。
- 每个声音都有自然的衰减尾巴和一点混响，不硬切。2–6 kHz 不刺耳：环境层都在 3.5 kHz 一带削 2.5–4 dB，7 kHz 以上用搁架滤波降 4 dB，再低通。鸟叫本身就在 2–6 kHz，所以只放远处的鸟、音量压低。
- 包体：循环层用 32 kbps 32 kHz 立体声（joint）；虫鸣用 24 kbps 24 kHz 单声道；单发音效用 32 kbps 32 kHz 单声道。
  每个新文件都放进对应场景的分包，主包不增加任何字节。

## 1. 响度目标
测量工具是 ffmpeg `ebur128=peak=true`。表里的「播放时」是默认音乐滑条（0.4）下的值：BGM 乘 musicVolume 0.4（-8 dB）；
环境层乘 vol（ambienceBedGain 在 0.4 时等于 1）。单声道文件在两个扬声器同时播，按 +3 dB 换算成立体声等效。

| 层 | 文件响度 | vol | 播放时（立体声等效） |
|---|---|---|---|
| BGM（三首，已上线） | -17.0 / -17.1 / -17.1 LUFS | musicVolume 0.4 | ≈ -25 LUFS（基准） |
| 主环境床（海岸 / 海面 / 湖） | -22.4 / -23.3 / -22.4（单声道） | 0.7 / 0.8 / 0.55 | -25.5 / -25.2 / -24.6 |
| 天空风 | -24.4 | 0.75（热气球 0.5） | -26.9（-30.4） |
| 草原鸟群床 | -26.3 | 0.8 | -28.2 |
| 草原虫鸣 | -30.4（单声道） | 0.5 | -33.4 |
| 草原微风（复用 amb_wind_soft_loop） | -23.4（单声道） | 0.25 | -32.4 |
| 单发：远处鸟 / 风车吱呀 | -27.2 / -28.4…-29.4（单声道） | 0.5 / 0.45 | 瞬时约 -30 / -32 |
| 新 BGM（海上 / 湖畔，候选） | -17.4 / -17.4 | musicVolume 0.4 | ≈ -25.4（和三首差 0.3–0.4 dB，听不出） |
| 地标循环：河 / 瀑布 / 码头拍水 | -27.2 / -27.2 / -27.3（单声道） | 近处 0.55 / 0.55 / 0.5 | 走到跟前约 -29 |
| 地标单发：风铃 / 天空风铃 | -29.4 / -30.5（单声道） | 0.45 / 0.4 | 瞬时约 -33 |
| 脚步 | 100 ms RMS 峰 ≈ -24.5 dBFS（和 r4 step_grass 一样） | FootstepCore.STEP_GAIN | 不变 |
| 海鸥 v6（已上线，不变） | -18.3（单声道） | 近 0.6 / 远 0.38 | 瞬时约 -20 / -24 |

- 关于「BGM 约 -20 LUFS」：三首 BGM 已经上线，文件响度约 -17 LUFS，播放时约 -25 LUFS，Funning 已认可。这一版不重渲三首 BGM，环境层按它来配。两首新 BGM 也对齐到同样的文件响度。
- 主环境床和 BGM 基本齐平（相差 0 到 -1 dB）。这和现在上线的海浪平衡一致（海浪 -20.9 单声道 × 0.55，约 -23），新海岸还稍轻一点。
  次要层比 BGM 低 3–8 dB，单发音效只是偶尔从远处冒出来。
- 关卡棋盘上，环境床整体 ×0.5（-6 dB），单发间隔 ×2，让棋盘音效更清楚。

## 2. 共同主题「风起」和各地区变奏（ACNH 方法）

ACNH 的做法：每个地方的曲子共用一个主题，只换编配、速度和调。走到哪都听得出「是同一个游戏」，换场景也不突兀。

**主题（原创，4 小节，4/4）。** 简谱以各曲主音为 1，`'` 表示高八度：

`5 1' 2' 3'—·2' | 1' 6 5— | 6 1' 2' 3' 5' | 3'—·2' 2'——`，收尾小节换成 `3' 2' 1'——`。

（`music/motif.py`：M1 = 5 1' 2' 3'（附点）2'，M2 = 1' 6 5，M3 = 6 1' 2' 3' 5'，M4 = 3'（附点）2' 2'。）
特点：上行四度起句（像风吹起来），第二句落回 5（像落地）。只用五声和自然音，任何地区的伴奏都配得上。

| 地区 | 调 / 速度 | 编配 | 主题怎么出现 | 现状 |
|---|---|---|---|---|
| 小岛 | F 大调 92 BPM 4/4 | 尤克里里 + 口琴 | 口琴原样唱，尤克里里切分扫弦 | 试听 demo 里有（`motif_demo` 前半）。已上线的 `bgm_main` 不改 |
| 海上 / 帆船 | **C 大调** 6/8，附点四分 = 54 | 尼龙吉他摇船琶音 + 长笛 + 弦乐涨落 | 长笛唱主题（4/4 的一拍 = 6/8 半小节），后半由弦乐低三度再唱 | **新 BGM 候选 `bgm_sail`** |
| 草原 | G 大调 76 BPM | 钢弦吉他 + 长笛 / 竖笛 + 弦乐 | 长笛原样唱 | 试听 demo 里有（`motif_demo` 后半）。已上线的 `bgm_meadow` 不改 |
| 湖畔 | **F 大调** 72 BPM | 钢琴 + 竖琴 + 弦乐 | 钢琴唱；第 10–17 小节模进到低三度，再低八度回响 | **新 BGM 候选 `bgm_lakeside`** |
| 天空之城 | D 小调 70 BPM 3/4 | 钢片琴 + 弦乐铺底 | 以后做：主题改成 3/4 的小调（6 是主音） | 已上线的 `bgm_skycity` 不改 |
| 热气球 | 跟草原 → 天空之城 | 加一层弦乐 | — | 用 dip 交接（§3） |

- **为什么海上用 C 大调**：小岛 F、草原 G。C 是 F 的属调、G 的下属调，和两边都只差一个升降号。2 s 等功率交叉（`SCENE_AUDIO_CROSSFADE_S`）时不会两个调同时打架。
- **为什么湖畔用 F 大调**：是天空之城 D 小调的关系大调（调号一样，都是一个降号）。按方案 B，湖畔在天空之城之后、坐热气球下降过去，这样交接最顺，而且上线的 `amb_lake_loop` 里的风铃是 C 五声（C D E G A），全在 F 大调里。
- 新 BGM 的规格：48 kbps 立体声 44.1 kHz，文件 -17.4 LUFS / TP ≤ -5 dB；纯循环（文件结尾直接接开头，不带重复尾巴），和三首上线 BGM 一样，所以 GameAudio 的双声源 150 ms 接力可以直接用。
  海上 35.56 s（航程 ≤30.5 s，基本放一遍），213,881 B；湖畔 66.67 s，400,552 B。
- demo 是 43 s，比要求的 ~30 s 长：每种编配要 6 小节才能把主题完整唱一遍，再加 2.5 s 交叉。只做试听，不进包。

## 3. 各场景：BGM + 三层环境音

三层：**底床**（一直在的循环，定空间）、**点缀**（随机的鸟 / 虫 / 海鸥单发，不打扰）、**地标**（固定位置的声音，走近才听见，按距离衰减）。
数值都在 `SCENE_AMBIENCE_DESIGN`（vol、间隔、nearM / farM、锚点节点名）。
地标音量：距离小于 nearM 时满音量，大于 farM 时静音，中间按 1/d 衰减；声像跟着镜头方向走。
同时发声上限 6 个 WebAudio 声音：底床最多 3 个，地标循环只开最近的 1 个，单发最多同时 2 个（多了就跳过这一次）。
关卡棋盘上：环境床 ×0.5（-6 dB），单发间隔 ×2；BGM 建议再低通到约 2.5 kHz、降 3 dB（ACNH 的做法，属于播放器代码，留给 Cursor）。

### 3.1 家里（室内）
- BGM：小岛曲。底床：海岸床跟着 `getRoomLightWeight` 走，室内无声，开门渐入。点缀、地标：无。
- 脚步：wood（地板）、rug（地毯），沿用 r4。

### 3.2 小岛
- BGM：`bgm_main`（F 大调 92 BPM，83.5 s）。

| 层 | 声音 | 文件 | 参数 |
|---|---|---|---|
| 底床 | 真实缓浪拍岸 | `audio_bgm_island/audio/amb_island_shore_loop`（候选，替换合成的 `amb_waves_loop`；不认可就退回旧文件） | 24.0 s，vol 0.7 |
| 底床 | 海风（WindAudio，已上线） | `amb_wind_soft/strong_loop` | 跟 getWindStrength |
| 点缀 | 海鸥 v6 | `resources/audio_sfx/sfx_amb_gull_1..3` | 8–20 s，近 0.6 / 远 0.38，夜里频率 ×0.4 |
| 地标 | 码头下的拍水（新，真实录音低通 1.6 kHz） | `audio_bgm_island/audio/amb_island_dock_lap_loop` | 12.0 s，vol 0.5，2–12 m |
| 地标 | 灯塔：海鸥聚集点（已有 GULL_FX / GullFlockCore） | — | 不加新声音 |

- 脚步：grass、path（土路）、stone、wood（码头），新增 **sand**（沙滩）。

### 3.3 海上 / 帆船（小岛 → 草原，≤30.5 s）
- BGM：**新候选 `bgm_sail`**（C 大调 6/8）。接线以后：小岛曲 → 出发时 2 s 交叉到海上曲 → 靠岸时 2 s 交叉到草原曲。
  接线之前（现在 SceneAudioTable 的 sail 档是 track: meadow）沿用旧方案：航程过半时 dip 交接（§4）。

| 层 | 声音 | 文件 | 参数 |
|---|---|---|---|
| 底床 | 船下的海水（低通 2.4 kHz） | `transport_sail/audio_amb/amb_sea_open_loop` | 24.0 s，vol 0.8，出发后 6 s 淡入 |
| 点缀 | 远处海鸥（只在出发后的前 10 s） | gull 2、3 号 | 5–8 s，vol 0.38 |
| 地标 | 无。船上音效属于 r5「帆船音轨」 | — | — |

- 脚步：wood（甲板）。

### 3.4 草原（不放海鸥、不放海浪）
- BGM：`bgm_meadow`（G 大调 76 BPM，72.6 s）。

| 层 | 声音 | 文件 | 参数 |
|---|---|---|---|
| 底床 | 远处成群的鸟 | `region_meadow/audio/amb_meadow_birds_loop` | 30.0 s，vol 0.8 |
| 底床 | 远处蟋蟀 | `region_meadow/audio/amb_meadow_insects_loop` | 19.25 s，vol 0.5，夜里 +3 dB |
| 底床 | 微风 | `resources/audio_amb/amb_wind_soft_loop` | vol 0.25 |
| 点缀 | 远处单只鸟鸣 ×3 | `region_meadow/audio/sfx_meadow_bird_1..3` | 6–16 s，洗牌不连续重复，声像 ±0.6，夜里频率 ×0.25 |
| 地标 | 风车吱呀 | `region_meadow/audio/sfx_windmill_creak_1..2` | 锚点 `windmill_sail_hub`，9–18 s，4–30 m，最好对上风车转一圈 |
| 地标 | 小河流水（新，真实录音） | `region_meadow/audio/amb_meadow_river_loop` | 锚点 `meadow_river`，16.0 s，vol 0.55，3–25 m |
| 地标 | 风铃（新，合成铜铃，G 五声） | `region_meadow/audio/sfx_meadow_windbell_1..2` | 锚点 `wind_bell`（bell_tap_stand_point），12–26 s，3–20 m；玩家敲铃时不重复播 |

- 脚步：grass、path（`meadow_path` 土路）、wood（栅栏边、木桥）。

### 3.5 湖畔（方案 B：在天空之城之后，主线第 12 关后解锁）
- 怎么到：从天空之城坐热气球下降到湖边（§3.6）。只有这一条路；草原的分支开关也去掉了。
- BGM：**新候选 `bgm_lakeside`**（F 大调，主题变奏）。现在 lakeside 档还借用 `bgm_main`。

| 层 | 声音 | 文件 | 参数 |
|---|---|---|---|
| 底床 | 湖水 + 微风 + 稀疏风铃（上线的 LakeAmbience，不变） | `region_lakeside/audio/amb_lake_loop` | 19.0 s，vol 0.55 |
| 点缀（**待定，候选，没接进配置**） | 远处水鸟：一群小天鹅（远）、一群骨顶鸡（中距离）。真实录音，公有领域 | `region_lakeside/audio/sfx_lake_waterbird_1..4` | 建议 14–30 s 一次，vol 0.3（天鹅）/ 0.45（骨顶鸡），声像 ±0.6。试听对比 12a / 12b，等 Funning 决定 |
| 地标 | 亭子风铃已经混在湖声里（C 五声 C6–C7） | — | 不另加，避免两套风铃 |

- 地标候选（这次没做）：小桥下的水声、芦苇沙沙、停泊小船轻碰。真要做可以复用 `amb_island_dock_lap_loop`。
- 脚步：grass、wood（小桥 / 亭子）、stone（台阶）、path。

### 3.6 热气球下降（天空之城 → 湖畔，方案 B）
- BGM：天空之城曲（D 小调）→ 湖畔曲（F 大调），用 dip 交接：天空曲 4 s 淡出，湖畔曲从第一小节 4 s 淡入，两首只叠 2 s。
  D 小调和 F 大调是关系调，叠在一起也不打架；但两首速度和拍子不同（70 BPM 3/4 和 72 BPM 4/4），所以还是只叠 2 s。
- 环境桥接：起飞时高空风 0.75 → 0.5（4 s）。高空风撑过 BGM 的空档，之后 10 s 淡出。湖声在 BGM 交接开始时淡入，12 s 升到 0.55。点缀、地标：无。
- 试听：`07_transition_skycity_balloon_lakeside_45s.mp3`（交接在 18–24 s）。
- 接上 bgm_lakeside 之前：湖畔档还借小岛曲，就按真实表的 2 s 等功率交叉。脚步：wood（吊篮）。

### 3.7 热气球（草原 → 天空之城）
- BGM：草原曲 → 航程 45% 处 dip 交接到天空之城曲。底床：高空风 vol 0.5，起飞 12 s 内淡入。点缀、地标：无。脚步：wood（吊篮）。

### 3.8 天空之城（不放海鸥、海浪、鸟、虫）
- BGM：`bgm_skycity`（D 小调 70 BPM 3/4，72.0 s）。

| 层 | 声音 | 文件 | 参数 |
|---|---|---|---|
| 底床 | 高空风 + D 小调五声微光（合成） | `region_skycity/audio/amb_sky_air_loop` | 32.0 s，vol 0.75 |
| 点缀 | 无（高处没有鸟虫，安静就是特色） | — | — |
| 地标 | 云中瀑布（新，真实流水推远） | `region_skycity/audio/amb_sky_waterfall_loop` | 锚点 `env_sky_waterfall_mist`，16.0 s，vol 0.55，4–35 m |
| 地标 | 风铃（新，合成玻璃铃，D 小调五声） | `region_skycity/audio/sfx_sky_chime_1..2` | 锚点 `env_sky_windchime`，10–22 s，3–20 m，音量 0.3（chime-v2） |
| 地标 | 小旗扑动（复用已有） | `resources/audio_sfx/sfx_apron_flap` | 锚点 `env_sky_pennant`，14–30 s，vol 0.18，2–10 m |

| 地标（**待定，候选，没接进配置**） | 星环转动：很轻的 D 小调五声嗡鸣，4 s / 8 s 周期起伏（合成） | `region_skycity/audio/amb_sky_starring_loop` | 锚点 `starring_spin`，16.0 s 循环，vol 0.45，3–25 m |
| 地标（**待定，候选，没接进配置**） | 机器人园丁：浇水洒水声 ×2 + 一声柔和的「嗡–嘟」（合成） | `region_skycity/audio/sfx_sky_gardener_water_1..2`、`sfx_sky_gardener_boop_1` | 跟着园丁走，浇水 18–40 s 一次，vol 0.5，2–15 m |

- 园丁和星环的试听对比是 13a / 13b，等 Funning 决定。大树树叶以后可加。
- 脚步：新增 **cloud**（云桥 anchor_cloudbridge_*），stone（遗迹 / 星庭），grass（花坛）。

### 3.9 关卡棋盘
- 保持所在地区的 BGM。地区按 stageId 判断：`r05-meadow-*` 草原，`r05-sky-*` 天空之城，`r04/r05-lake-*` 湖畔，其他算小岛。

## 4. 过渡规则（摘要；真实表用 2 s 等功率交叉，`SCENE_AUDIO_CROSSFADE_S`）
| 过渡 | BGM | 带过去的层 |
|---|---|---|
| 家 → 小岛 | 不换 | 海岸床随开门出现 |
| 小岛 → 海上 | 不换，-3 dB | 海岸床 0–8 s 淡出；远处海鸥只放前 10 s |
| 小岛 → 海上 → 草原 | 接上 bgm_sail 以后：出发 2 s 交叉到海上曲，靠岸 2 s 交叉到草原曲（F→C→G）。没接之前：航程过半时 dip 交接 6 s；跳过航程就到岸后再交接 | 海面床靠岸后 4 s 淡出；草原床靠岸前 6 s 淡入 |
| 草原 → 热气球 | 不换 | 草原各层 10 s 淡出 |
| 热气球 → 天空之城 | 航程 45% 处 dip 交接 6 s | 天空风 0.5 → 0.75 |
| 天空之城 → 热气球下降 → 湖畔（方案 B） | dip 交接：天空曲 4 s 出，湖畔曲 4 s 入，只叠 2 s | 高空风 0.75→0.5，撑过空档后 10 s 淡出；湖声 12 s 淡入到 0.55 |
| 任意 → 棋盘 | 不换 | 环境床 1.5 s 降到 ×0.5 |
| 任意 → 回家 / 小岛 | 3 s 交叉 | 地区各层 3 s 淡出，海鸥 4 s 后恢复 |
| 没有专门写的 | GameAudio 默认 1.5 s | 淡出 3 s、淡入 3 s |

## 5. 脚步：按地面换声音

| 地面 | 文件（各 4 个变体） | 来源 | 用在 |
|---|---|---|---|
| wood | `region_island/audio_steps/step_wood_1..4` | r4 合成 | 家、码头、甲板、木桥、亭子、吊篮 |
| rug | `step_rug_1..4` | r4 合成 | 家里地毯 |
| stone | `step_stone_1..4` | r4 合成 | 小岛石路、湖畔台阶、天空遗迹 |
| path | `step_path_1..4` | r4 合成 | 小岛 / 草原 / 湖畔土路 |
| grass | `step_grass_1..4` | r4 合成 | 小岛、草原、湖畔、天空花坛 |
| **sand（新）** | `region_island/audio_steps/step_sand_1..4` | Kenney Impact Sounds（CC0）雪地脚步：高通 140 Hz、低通 3 kHz、轻混响，听起来像松软的沙 | 小岛沙滩 |
| **cloud（新）** | `region_skycity/audio_steps/step_cloud_1..4` | Kenney 地毯脚步：低通 1.6 kHz，混响 0.7 s，软软闷闷的 | 天空之城云桥 |

- 新脚步每个 2.3–2.6 KB（32 kbps 单声道），100 ms RMS 峰值约 -24.5 dBFS，和 r4 的 step_grass 一样（-24.4 / -24.0）。所以 `FOOTSTEP_SETS` 里给 0.34（介于 rug 和 grass 之间）。
- 现状：`FootstepCore` 的 `StepSurface` 只有五种，`FOOTSTEP_GROUND` 网格只覆盖家和小岛。
  草原 / 湖畔 / 天空之城要按 `SCENE_GROUND_TYPES` 给地面打标签（第一个是缺省地面），sand / cloud 也要加进 StepSurface。这些是播放器 / 网格的工作，留给 Cursor。
- **r4.1 脚步重录的确认还在等 Mac 录音。** 新的 sand / cloud 只是候选，等 r4.1 定了再统一试听、统一响度。

## 6. 循环和接缝
- 新循环文件用的格式和 `amb_lake_loop` 一样：循环周期 `loopS` 后面多带 0.15 s 自己开头的音频（`dupS`）。双声源接力时在 `loopS - 0.15` 起第二个声源，因为两段音频相同，用线性交叉 0.15 s。也可以退回平台循环。
- 真实录音的循环点做法：在原录音里挑首尾电平接近的窗口（`pickwin.py`），尾部 3 s 用等功率交叉叠回开头（虫鸣本来就周期重复，用线性交叉 1 s）。合成的天空风本身就是循环构造的（循环噪声 + 整数周期包络），混响和滤波平铺三份后取中间那份。
- 自测（`seamcheck.py`，结果在 `measurements.json`）：
  - 接缝跳变都小于全文件 99.9 百分位的单样本步长（比值 0.03–0.67）。
  - mp3 解码后 [loopS, loopS+0.15] 和开头的相关系数：海岸 0.98，海面 0.95，虫鸣 1.00，天空 0.99，鸟群 0.77。鸟群这个数低，是因为它很安静，mp3 量化噪声占比大，不是错位。
  - 连放三遍检查 7 kHz 以上的瞬时能量，接缝处都不高于文件里正常的鸟叫、浪花峰值。
- 解码器延迟：ffmpeg 读 LAME 头，延迟是 0。不读头的解码器在开头会多约 25–50 ms 的静音，所以要像 LakeAmbience 那样从 `encoderDelayS` 处开始，或者走双声源接力。

- 两首新 BGM 是纯循环（不带重复尾巴，和上线 BGM 一样）。乐谱本身首尾回绕（最后的余音和混响折回开头），混响用 FFT 循环卷积。
  mp3 解码长度和循环长度一致（35.5556 / 66.6667 s）。接缝跳变是全文件 99.9 百分位步长的 0.05 / 0.03 倍。连放三遍看 6 kHz 以上的能量，接缝处比文件里正常的拨弦起音低 12 / 11 dB。
- 新地标循环：mp3 解码后重复段和开头的相关系数是 河 0.94、瀑布 0.94、码头 0.99。接缝处高频峰值不高于全文件 99.9 百分位。

## 7. 包体
| 分包 | 新增 | 字节 |
|---|---|---|
| audio_bgm_island | shore_loop 97,028 + dock_lap_loop 36,884 | 133,912 |
| transport_sail | sea_open_loop 97,028 + **bgm_sail 213,881** | 310,909 |
| region_meadow | 鸟群 121,076 + 虫鸣 58,628 + 鸟鸣 38,544 + 风车 30,976 + 河 48,836 + 风铃 51,856 | 349,916 |
| region_lakeside | **bgm_lakeside 400,552** + 待定水鸟候选 118,112 | 518,664 |
| region_skycity | 高空风 129,140 + 瀑布 48,836 + 风铃 53,296 + 云脚步 9,368 + 待定园丁 / 星环候选 111,404 | 352,044 |
| region_island | 沙地脚步 10,516 | 10,516 |
| **合计** | 主包 0 | **1,675,961**（其中两首 BGM 614,433，待定候选 229,516） |

- 待定候选（水鸟、园丁、星环）放在分包里，配置里没有引用。Funning 不要的话，删掉对应的 mp3 和 .meta 就行，也要从 manifest 里删。
- 想再省：海岸和海面改成单声道 32 kbps 能各省约一半，但会失去左右的浪声宽度。两首 BGM 如果要更小，可以降到 40 kbps（和上线三首一样），各省约 17%。都等真机试听再决定。

## 8. 映射到 SceneAudioTable.ts（只加数据，不改播放器）

| 暂定 json 里的内容 | SceneAudioTable.ts 里的位置 | 说明 |
|---|---|---|
| bgm（三首） | `BGM`（云端已有） | 不变 |
| 海上 / 湖畔新曲 | **`BGM_CANDIDATES`**（sail、lakeside：path、bundle、loopS、调） | 没加进 `SceneTrackId`：`SceneMusic.SCENE_TRACKS` 是按 SceneTrackId 写死的，改类型就要改播放器 |
| 层素材（鸟、虫、高空风、草原风、真实海岸、海面） | **`PENDING_LAYER_ASSETS`** | 素材在、播放器没写，所以档案的 `layers` 先不打开（打开了也不响）；`missing` 里的名字保留，意思变成「还听不到」 |
| 各场景层 | **`SCENE_AMBIENCE_DESIGN`**（bed / scatter / landmarks） | 三层，带 vol、间隔、声像、锚点、nearM / farM |
| 脚步 | **`FOOTSTEP_SETS`**、**`SCENE_GROUND_TYPES`** | gain 刻度和 `FootstepCore.STEP_GAIN` 一样 |
| transitions | `SCENE_AUDIO_CROSSFADE_S = 2`（云端已有） | 我的 dip 方案在 §4，接线时参考 |

**Cursor 要接的线**（播放器代码，本分支没写）：
1. 在 `SceneTrackId` 里加 `'sail' | 'lakeside'`，在 `SceneMusic.SCENE_TRACKS` 里加两行（取 `BGM_CANDIDATES`），把 sail / lakeside 档的 track 改过去，并删掉 missing 里的 `sail-bgm` / `lakeside-bgm`。
2. 鸟、虫、高空风、草原风的循环播放器（读 `PENDING_LAYER_ASSETS` / `SCENE_AMBIENCE_DESIGN.bed`），打开后再从 `missing` 删名字。
3. 点缀和地标的调度器（随机间隔 + 按距离衰减），以及上面说的同时发声上限 6。
4. 脚步：StepSurface 加 sand / cloud，给其他场景的地面打标签。
5. **方案 B 的路线（逻辑，本分支没改）**：`SceneAudioTable.ts` 的 `travelProfile()` 里 `target === 'lakeside'` 那一行是旧的「从小岛步行过去」：到达前用 island 档。
   方案 B 是从天空之城坐热气球下降，到达前应该用 balloon 档（高空风，没有海鸥 / 海浪）。
   这一行和云端测试 `test_scene_audio_transitions.cjs` 里 `journeyTarget: 'lakeside', journeyRegion: 'island'` 的两条用例要一起改（都是云端写的逻辑）。
   我加的数据 `TRAVEL_ROUTES.lakeside` 写了新路线和 dip 数值，可以直接读。
6. 待定层（水鸟、园丁、星环）：Funning 听完 12a/12b、13a/13b 决定以后，再加进 `SCENE_AMBIENCE_DESIGN`。

测试：`tools/voice-bot/bgm/test_scene_audio_transitions.cjs` 原来断言「湖畔 / 海上 BGM 文件不存在」。现在改成三条：文件存在；在 `BGM_CANDIDATES` 里；还没接进 `BGM`。
另外加了一条：`PENDING_LAYER_ASSETS` 的文件都在。方案 B 返工又加了一条：`TRAVEL_ROUTES.lakeside` 来自天空之城、坐热气球。数据里没有从小岛或草原到湖畔的路线。

## 9. 没做 / 需要别人
- 播放器接线：见 §8（Cursor）。
- 真机：响度平衡、接缝、同时发声数。需要进 Mac 测试队列。
- r4.1 脚步重录：等 Mac 录音确认。
- 湖畔水鸟、天空之城的园丁和星环：候选素材和对比试听做好了（12a/12b、13a/13b），**待定**，没进配置。湖畔其他地标、大树树叶：没做。
- 三首上线 BGM 的主题化重编配：这次按要求没重渲，只做了 demo。

## 10. 素材来源备注
- 水鸟候选来自 Wikimedia Commons 上的美国政府作品（公有领域，可以商用）：USFWS「Tundra swans」、NPS & MSU Acoustic Atlas「Yellowstone sound library – American Coots – 001」。
- Freesound 的 CDN 现在拒绝共享电脑访问（403），这一版的真实录音都来自 OpenGameArt 上标为 CC0 的条目，每条都核对过页面上的许可。
- 能找到的真实「大风」录音都有严重的话筒风噪，不能用。所以天空风是合成的。以后如果拿到干净的 CC0 高空风录音，可以替换。
- 新的真实录音（河、瀑布、码头）都来自上一版已核对过的 OpenGameArt CC0 条目；脚步来自 Kenney Impact Sounds（CC0，包里带 License.txt）。风铃和两首 BGM 是自己合成、自己作曲的，没有用任何采样。
