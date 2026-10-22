# 正式版配乐：采样 / 实录乐器方案（Voice bot，2026-10-22）

前提：用户拍板正式版配乐全部用**采样或实录的真乐器**，不用合成音色。主旋律沿用「风起」动机（G C D E D，按场景移调，见 `feng-qi-motif-roadmap.md`）。
游戏里放的是**渲染好的 mp3**，不分发采样本身，所以只需要授权允许"用采样制作并发布商用作品（含游戏）"。混响用卷积 IR 属于处理，不算音色。

## 1. 采样来源与授权（2026-10-22 逐个在来源页核对）

| 代号 | 来源 | 授权（原文要点） | 署名 | 结论 |
|---|---|---|---|---|
| **VSCO2** | VS Chamber Orchestra: Community Edition，https://github.com/sgossner/VSCO-2-CE（本次用 commit 440300901d） | 仓库 LICENSE 文件为 **CC0 1.0 Universal** | 不要求；我们照样写进 credits | ✅ 首选。竖琴、长笛、单簧管、双簧管、圆号、弦乐组（小/中/大提琴，sus/pizz/trem）、颤音琴、钟琴等 |
| **VCSL** | Versilian Community Sample Library，https://github.com/sgossner/VCSL | 仓库 LICENSE 为 **CC0 1.0 Universal** | 不要求 | ✅ 补 VSCO2 没有的：手风琴、竖笛/哨笛类、钢琴（Steinway B / Yamaha 立式）、钢片琴、民族打击乐、风铃类 |
| **Iowa MIS** | University of Iowa Musical Instrument Samples，https://theremin.music.uiowa.edu/MIS.html | 页面原文："freely available … may be downloaded and used for any projects, without restrictions" | 不要求（建议致谢） | ✅ 补独奏音色（长笛、中音长笛、单簧管、大提琴独奏、马林巴、钟琴等）。消音室录音很干，必须加卷积混响 |
| **Salamander** | Salamander Grand Piano v3，作者 Alexander Holm，https://rytmenpinne.wordpress.com/sounds-and-such/salamander-grandpiano/ | 作者页："As of 4.3.2022, this is now public domain!"；但 sfzinstruments 镜像的 LICENSE 仍是 CC-BY 3.0 | 保守起见按 CC-BY 署名 "Salamander Grand Piano by Alexander Holm" | ✅ 钢琴首选（星光灯塔海岸、终章）。⚠ 两处授权文字不一致，署名兜底 |
| **Wikimedia PD/CC0** | Windchime.ogg（stephan，PD）、Windglockenspiel.Koshi.ogg（Membeth，CC0）、Howling_wind.ogg（CC0） | 文件页标注 Public domain / CC0 1.0 | 不要求 | ✅ 已在用：风铃、风声 |
| **Freesound CC0** | https://freesound.org，**只取 CC0 筛选** | CC0 可商用；CC-BY 需署名；**CC-BY-NC 与 Sampling+ 禁用**（商用/广告受限） | 逐条记录 | ✅ 仅用于环境声/打击乐补丁，每条记 URL+作者 |
| Philharmonia | https://philharmonia.co.uk/resources/sound-samples/ | 原文："free to use … including releasing them as part of a commercial work. The only restriction is that they must not be sold or made available 'as is'"；同时挂 CC BY-SA 3.0 | 需署名；BY-SA 对派生作品的"相同方式共享"要求与游戏不清楚 | ⚠ **存疑，暂不用**。只有 VSCO2/VCSL/Iowa 都没有的音色才考虑，并先请示 |
| Sonatina Symphonic Orchestra | https://github.com/peastman/sso | CC Sampling Plus 1.0（已退役），并混入 Philharmonia 等来源，作者自称部分来源不明 | 需署名 | ❌ **不用**：Sampling+ 有"高度转化"和广告限制，来源链不清 |

另：微信小游戏审核只看我们有没有权利，CC0/PD 不需要额外文件；credits 文档（`docs/audio-credits.md`）作为授权台账保留，Salamander 的署名可放到游戏"关于/致谢"页（如以后有）。

## 2. 各场景乐器表

调性沿用路线文档；括号内为来源代号。所有场景共用一个 2.6–3.5 s 的卷积房间，弦乐一律 sus vib 低力度。

| 场景 | 调 | 主奏（动机） | 和声/铺底 | 色彩 | 来源 |
|---|---|---|---|---|---|
| 小岛（家、主线） | C | 长笛 | 竖琴分解 + 中提琴/大提琴长音 | 钟琴偶尔 | VSCO2 |
| 草原 | G | 单簧管 | 吉他式拨弦用竖琴低音区 + 弦乐 pizz | 手风琴长音（轻） | VSCO2 + VCSL 手风琴 |
| 天空之城 | D | 钢片琴 / 钟琴 | 竖琴 + 小提琴组高把位 | 风铃（金属） | VCSL 钢片琴 + VSCO2 + Wikimedia |
| **风铃湖畔** | **F** | 长笛 → 单簧管应答 | 竖琴琶音 + 中/大提琴 | PD 金属风铃按动机音高点缀 | VSCO2 + Wikimedia（本次小样） |
| 雪山风铃山口 | D 小调/D 多利亚 | 金属管风铃（定 A） | 大提琴组长音 + 低音竖琴 | 中音长笛（气声） | Wikimedia + VSCO2 + Iowa 中音长笛 |
| 星光灯塔海岸 | A♭ | 钢琴 | 弦乐组 + 竖琴 | 颤音琴（关电机） | Salamander + VSCO2 |
| 森林小镇 | B♭ | 双簧管 / 竖笛 | 弦乐 pizz + 手风琴 | 马林巴 | VSCO2 + VCSL + Iowa 马林巴 |
| 终章 风之花园 | C → 全奏 | 各区标志乐器轮流回归后全奏 | 全弦乐 + 竖琴 + 钢琴 | 风铃 | 以上全部 |

## 3. 包体估算与子包分配

**现状（仓库实测，creator-build-project/assets）**：

| 分包 | 现有音频字节 | 内容 |
|---|---|---|
| resources（主包） | 347,809 B（29 个） | 海浪循环、通关/开宝箱、海鸥等 UI/小岛基础音效，**无 BGM**（v0.5 已移出） |
| audio_bgm_island | 551,731 B | bgm_main 83.5 s 48 kbps + 岸边循环 |
| region_island | 178,680 B | 出门过场 + 脚步 |
| region_meadow | 713,531 B | bgm_meadow + 环境 |
| region_skycity | 713,628 B | bgm_skycity + 环境 |
| region_lakeside | 576,500 B | bgm_lakeside 392 KB + 湖面循环 + 水鸟 |
| transport_sail | 483,281 B | bgm_sail + 海面 |

分包配置：各 bundle 的 `.meta` 为 `wx_subpackage`、wechatgame subpackage、非远程（`creator-build-project/settings/v2/packages/builder.json` 的 `wx_subpackage` 预设）。

**估算原则**：采样只在离线渲染时用，不进游戏；成品仍按现规格 **48 kbps 立体声 mp3 ≈ 6.0 KB/s**。真乐器比合成音色动态大、高频更细，48 kbps 可能出现镲/风铃的涡旋失真——若试听不过，第二档是 64 kbps（≈ 8 KB/s，+33%）。

| 场景 | BGM 时长 | BGM 48k / 64k | 环境+音效（沿用/新增） | 合计 48k / 64k | 分包 |
|---|---|---|---|---|---|
| 小岛 | 84 s（替换） | 0.50 / 0.67 MB | 沿用 | 0.55 / 0.72 MB（基本不变） | audio_bgm_island |
| 草原 | 73 s（替换） | 0.44 / 0.58 MB | 沿用 | 0.71 / 0.86 MB | region_meadow |
| 天空之城 | 72 s（替换） | 0.43 / 0.58 MB | 沿用 | 0.71 / 0.86 MB | region_skycity |
| 风铃湖畔 | 67 s（替换） | 0.40 / 0.54 MB | 沿用 | 0.58 / 0.72 MB | region_lakeside |
| 航行（bgm_sail） | 36 s（替换） | 0.21 / 0.28 MB | 沿用 | 0.48 / 0.55 MB | transport_sail |
| 雪山风铃山口 | ~60 s 新 | 0.36 / 0.48 MB | 风 4 层 + 风铃 ≈ 0.25 MB | **+0.61 / +0.73 MB** | 新 region_snowpass |
| 星光灯塔海岸 | ~70 s 新 | 0.42 / 0.56 MB | 海+灯塔 ≈ 0.25 MB | **+0.67 / +0.81 MB** | 新 region_lighthouse |
| 森林小镇 | ~70 s 新 | 0.42 / 0.56 MB | 林间+小镇 ≈ 0.3 MB | **+0.72 / +0.86 MB** | 新 region_foresttown |
| 终章 风之花园 | ~90 s 新 | 0.54 / 0.72 MB | 复用各区 one-shot ≈ 0.15 MB | **+0.69 / +0.87 MB** | 新 region_finale |

- 已有 5 首替换：48 kbps 下字节基本不变（同时长同码率）；若升 64 kbps 合计约 +0.5 MB，全在子包。
- 四个新场景合计 +2.7 MB（48k）/ +3.3 MB（64k），**全部进各自场景子包**。
- **主包 0 增量**：主包只留加载页与小岛必需的 resources 音效（现 0.35 MB），新配乐一律不进 resources；小岛 BGM 继续在 audio_bgm_island 里、room ready 后再加载（见 `docs/scene-bgm.md`）。
- 微信总包上限需由 PM 对照最新构建的 subpackageBytes 核对；region_skycity 已 8.7 MB（含美术），单分包 ≤ 20 MB 仍有余量。

## 4. 本次小样
- `previews/Voice-bot/sampled-instruments/01_lakeside_fengqi_harp_flute_clarinet_strings_windchime_30s.mp3`（30.0 s，96 kbps 预览码率，进游戏时再出 48/64 kbps 两档对比）。
- 脚本 `tools/audio/sampled/lakeside_windchime_demo.py`（输入：VSCO-2-CE 本地目录 + Windchime 转 wav）。
- F 大调，动机 C F G A G：长笛先陈述（3.9 s 起），单簧管低八度应答（18.3 s 起）；竖琴慢速琶音，中/大提琴 F–Dm–B♭–C–F–B♭–C–F 每和弦 3.6 s；PD 风铃按动机音高点缀 8 次。
- 测量：-19.5 LUFS，真峰 -6.8 dBFS，2–6 kHz 能量占比 1.25%，结尾 4 s 余弦淡出，最后 50 ms 峰值 ≈ -90 dBFS（无硬切）。
- 未测：手机外放 / Cocos 内试听；48 kbps 成品码率下的风铃失真。

## chime-v2 返工（10-22，用户反馈：风铃太大太满）
`02_lakeside_fengqi_v2_chime_sparse_30s.mp3`，脚本 `tools/audio/sampled/lakeside_windchime_demo_v2.py`（v1 模式可复现 01 并导出分轨）。

| 指标 | v1 (01) | v2 (02) |
|---|---|---|
| 风铃分轨 LUFS / 旋律分轨（长笛+单簧管+竖琴）LUFS | -17.3 / -16.8 → 差 -0.5 LU | -24.7 / -14.5 → 差 -10.2 LU |
| RMS 差（风铃 − 旋律） | +0.3 dB | -15.1 dB |
| 风铃敲击数 | 8 | 3（2.1 s / 14.7 s 强拍 / 16.5 s，全部在乐句空档） |
| 与长笛/单簧管发声重叠 | 19 | 0 |
| 风铃发声长度 | 8.0 s | 1.4 s（0.9 s 余弦收尾） |
| 风铃混响湿声 | 0.32 | 0.12 |
| 总响度 / 真峰值 | -19.5 LUFS / -6.8 dBTP | -19.5 LUFS / -7.3 dBTP |
| 2–6 kHz / >6 kHz 占比（总混） | 1.2% / 0.01% | 0.6% / 0.01% |
| 风铃分轨 2–6 kHz | 1.8% | 0.7% |

游戏内复查：sfx_sky_chime_1/2 尾音 6.4 → 3.6 s，高频架 -4 dB，26.0/27.3 KB → 14.8/14.8 KB，设计音量 0.4 → 0.3；星环、湖声、水鸟不变（都比 BGM 低约 20 LU，2–6 kHz ≤1.1%）。棋盘混音试听 `03_ingame_lakeside_board_L13_mix_after_chime_v2_30s.mp3`（-18.0 LUFS）。
