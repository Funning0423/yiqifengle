# 资源目录与命名规则 v1.1（GGbot，2026-10-09）

v1.1 改动：加 `state_`、`amb_` 前缀；BGM 和环境声走远程包 `audio_bgm_<区域>` / `audio_amb_<区域>`。

适用：Cocos Creator 3.8.8 工程 `creator-build-project/`，目标平台微信小游戏。
包体硬限制：主包 ≤4 MB；主包+分包 ≤20 MB（开通虚拟支付后 30 MB）；超出部分走远程包（Funning 的腾讯云 COS）。

## 1. 三类包怎么分

| 类别 | 放什么 | 工程目录 | Bundle 名 | 微信构建里的位置 |
|---|---|---|---|---|
| 主包 | 启动场景、脚本、首屏 UI、首屏音效（≤1 MB）、加载界面 | `assets/main/`（及现有 `assets/scenes`、`assets/scripts`） | （主包，不建 bundle） | 主包 |
| 分包 | 通用 UI 图集、全局音效之外的公共小资源、第一个区域的轻量资源 | `assets/bundles/<bundle名>/` | `common_ui`、`audio_sfx` 等 | 小游戏分包 |
| 远程包 | 大 3D 场景、角色、BGM、环境声、大贴图 | `assets/bundles/<bundle名>/` | `region_island`、`region_meadow`、`region_skycity`、`chr_girl`、`audio_bgm_<区域>`、`audio_amb_<区域>` | 远程（COS） |

规则：
- 每个 Asset Bundle 一个文件夹，文件夹名 = bundle 名，只用小写字母、数字、下划线。
- 主包不放任何 GLB 和 BGM。
- 场景、预制体**不能直接拖引用**远程或分包里的资源，一律用代码 `assetManager.loadBundle` 后再加载，否则这些资源会被拽进依赖、阻塞启动。
- 一个区域的东西只放在自己的 bundle 里；跨区域共用的放 `common_*`。
- `assets/resources/` 以后只留极少量启动必需的东西，逐步迁出。

## 2. 目录结构（目标）

```
assets/
  main/            启动必需（loading 图、首屏 UI）
  scenes/          场景（WorldR5Integration 为启动场景）
  scripts/
  bundles/
    common_ui/     ui_* 图集（≤1024）
    audio_sfx/     sfx_*.mp3（单声道）
    region_island/ env_island_*.glb、锚点/碰撞 json
    region_meadow/
    region_skycity/
    chr_girl/      chr_girl_*.glb、动作
    audio_bgm_island/ audio_bgm_meadow/ audio_bgm_skycity/   远程包
    audio_amb_island/ audio_amb_meadow/ audio_amb_skycity/   远程包（环境声，day/night 同一个 bundle）
```

## 3. 文件命名

格式：`<前缀>_<区域或对象>_<描述>[_<变体>]_v<主>.<次>.<扩展名>`，全小写、下划线分隔、不用空格和中文。进工程后的文件名**去掉版本号**（版本放在 meta/manifest 里），这样替换资源时 UUID 和引用不变。

| 前缀 | 用途 | 示例（工程内文件名） |
|---|---|---|
| `env_` | 场景/环境模型 | `env_island_combined.glb` |
| `chr_` | 角色 | `chr_girl_r5.glb` |
| `anim_` | 单独的动作文件 | `anim_girl_stand_up.glb` |
| `ui_` | UI 图片/图集 | `ui_board_pieces.png` |
| `tex_` | 单独贴图 | `tex_skycity_clouds_1024.png` |
| `state_` | 环境状态切换网格，格式 `state_<组>_<状态>[_后缀]` | `state_bridge_after`、`state_ring_before_stars` |
| `col_` / `anchor_` | 碰撞代理、锚点数据 | `col_island_proxies.json`、`anchor_island.json` |
| `sfx_` | 音效 | `sfx_match_normal.mp3`、`sfx_combo_1.mp3`、`sfx_chest_open.mp3`、`sfx_ui_click.mp3`、`sfx_level_clear.mp3` |
| `bgm_` | 背景音乐 | `bgm_island_loop.mp3`、`bgm_skycity_loop.mp3` |
| `amb_` | 环境声（循环或零散单次） | `amb_island_waves_day.mp3`、`amb_island_gull_01_day.mp3`、`amb_skycity_wind_loop.mp3` |
| `vo_` | 角色语音 | `vo_girl_greeting_01.mp3` |

交付文件（team 目录 / Drive）带版本：例如 `sfx_combo_2_v1.0.mp3`、`env_skycity_whitebox_v0.1.glb`。

## 4. 音频导出（Voice Bot）
- mp3；音效单声道，首屏会用到的音效总量 ≤1 MB，放 `audio_sfx`（分包）或主包 `main/`（只放首屏必须的几个）。
- BGM 每首一个文件，按区域放 `audio_bgm_<区域>`，走远程包。
- 环境声用 `amb_<区域>_<内容>[_<序号>]_<day|night>`，循环类结尾加 `_loop` 可省略（文件 README 里注明哪些是循环）；放 `audio_amb_<区域>`，走远程包。
- 首尾自带交叉淡化的循环版本，文件名不变，版本号递增，README 写明淡化时长。
- 运行时音频总量 ≤10 MB。

## 5. 每次交付附 README
写清楚：文件清单 + SHA256、目标 bundle、预算检查结果（GLB 用 `tools/glb_budget_check.py` 跑）、已知问题。
