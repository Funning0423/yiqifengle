# Voice Bot 音频候选：四类新音效 + BGM 96 kbps 检查（2026-10-15）

**状态：候选，没有换进游戏。** 要等 Funning 试听选定后，才由 GGbot 或我按文件名放进去。

## 内容
- `mp3/`：15 个新音效，64 kbps 单声道 44.1 kHz，全部自制原创（numpy 合成）
  - `sfx_windmill_loop.mp3`：风车循环 8 s（四片叶，每 0.5 s 一次呼呼声，加木轴吱呀），按环境声做到 -24 LUFS
  - `sfx_door_open.mp3`：木门打开（门闩咔哒、合页吱呀、带风、轻碰停住），约 -21 LUFS
  - `sfx_step_{grass,wood,stone}_01..04.mp3`：草地、木地板、石头三套脚步，每套 4 个变化。0.4 s 以下的声音测不了积分响度，统一按峰值 -3 dBTP 处理
  - `sfx_chest_metal_open.mp3`：宝箱金属开启（金属扣、铁合页、盖子撞停、金币闪响），约 -21 LUFS。**这是新增文件**，不覆盖现有的 `sfx_chest_open.mp3`
- `src/synth_sfx_v2.py`：生成脚本，运行 `python3 synth_sfx_v2.py wav/` 可以复现
- `compare/png/`：每个新文件的波形加频谱图；`sfx_chest_before_vs_new_compare.png` 是现有宝箱声和新金属宝箱声的上下对比
- `compare/bgm_reference_NOT_FOR_SHIP/`：BGM 改前和改后的试听，详见下文
- `preview/`：全部新音效连播（mp3，再配一张静态图做成 mp4）
- `LICENSES.md`：授权清单；`SHA256SUMS`：校验值

## 响度和大小
| 文件 | 大小 | 时长 | 积分响度 | 真峰值 |
|---|---|---|---|---|
| sfx_chest_metal_open.mp3 | 19687 B | 2.43 s | -20.7 LUFS | -2.2 dBTP |
| sfx_door_open.mp3 | 15716 B | 1.93 s | -20.9 LUFS | -2.2 dBTP |
| sfx_step_grass_01.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -3.5 dBTP |
| sfx_step_grass_02.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -2.2 dBTP |
| sfx_step_grass_03.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -3.3 dBTP |
| sfx_step_grass_04.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -4.7 dBTP |
| sfx_step_stone_01.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -3.5 dBTP |
| sfx_step_stone_02.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -5.4 dBTP |
| sfx_step_stone_03.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -2.9 dBTP |
| sfx_step_stone_04.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -4.3 dBTP |
| sfx_step_wood_01.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -3.3 dBTP |
| sfx_step_wood_02.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -3.4 dBTP |
| sfx_step_wood_03.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -3.5 dBTP |
| sfx_step_wood_04.mp3 | 3386 B | 0.39 s | —（太短，测不了） | -3.4 dBTP |
| sfx_windmill_loop.mp3 | 64617 B | 8.05 s | -24.5 LUFS | -8.8 dBTP |
| sfx_chest_open_EXISTING_before.mp3 | 18015 B | 2.22 s | -15.5 LUFS | -2.1 dBTP |
| bgm_main_REFERENCE_transcode_96k_mono.mp3 | 1002519 B | 83.51 s | -17.9 LUFS | -2.7 dBTP |
| bgm_main_before_48k_stereo.mp3 | 501333 B | 83.51 s | -16.4 LUFS | -3.5 dBTP |
| bgm_meadow_REFERENCE_transcode_96k_mono.mp3 | 872429 B | 72.67 s | -19.2 LUFS | -5.2 dBTP |
| bgm_meadow_before_48k_stereo.mp3 | 436288 B | 72.67 s | -16.6 LUFS | -5.9 dBTP |
| bgm_skycity_REFERENCE_transcode_96k_mono.mp3 | 864906 B | 72.05 s | -19.7 LUFS | -2.1 dBTP |
| bgm_skycity_before_48k_stereo.mp3 | 432526 B | 72.05 s | -16.5 LUFS | -2.4 dBTP |

## BGM 96 kbps 单声道：卡住了，需要定一下
1. **找不到合成源。** docs/scene-bgm.md 写的源工程目录 `/workspace/bgm/` 在共享电脑上已经不存在，全盘也没找到这三首（83.5 s / 72.6 s / 72.0 s）的源脚本或 wav。按要求不能拿旧 mp3 再压一次当交付，所以**没有交正式的 96 kbps 版**。
2. **改成 96 kbps 单声道，包反而会变大。** 现在三首都是 48 kbps 立体声，共 1,370,147 B。改成 96 kbps 单声道后码率翻倍，大约会到 2.74 MB，多出 1.37 MB，和压包目标正好相反。参考转码（只用来试听和算大小，**不能进游戏**）在 `compare/bgm_reference_NOT_FOR_SHIP/`，每首都有改前 mp3、参考转码和上下对比图。
   - 建议：保持现在的 48 kbps；如果要省空间，可以改成 48 kbps 单声道（音质更好，大小不变），或者 32–40 kbps 单声道（更省）。等 Grok Bot 或 Funning 拍板，找到源工程或重新合成后再出正式版。

## 接入备注（Funning 选定后才做）
- 建议放在 `assets/resources/audio_sfx/`（风车循环也可以放进 region_meadow 分包）
- 风车循环：MP3 编码会在首尾补一点空白（约 40 ms），所以要用 GameAudio 的双声源交叉循环，不要只靠平台自带的 loop
