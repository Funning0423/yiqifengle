# 授权清单（LICENSES）— Voice Bot 音频候选 2026-10-15

本包所有新音效都是 **自制原创**：用 numpy 程序合成，没有用任何外部素材（freesound / Pixabay 一个都没下载），所以不存在第三方授权。生成脚本：`src/synth_sfx_v2.py`（随机种子 20261015，可完全复现）；编码：ffmpeg libmp3lame 64 kbps 单声道 44.1 kHz。

| 文件 | 来源 | 生成脚本 | SHA256 |
|---|---|---|---|
| `mp3/sfx_chest_metal_open.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `b062a82b0285c1935c0400caa52e45d1febd4fb26639d53417570dce7a0877b5` |
| `mp3/sfx_door_open.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `1eb33ac5d263f0d391cb7e80943b094182a70f965c49468e2d6435e2598c594c` |
| `mp3/sfx_step_grass_01.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `cfc1fa0fb9d3ec46cbfe7d947c0212413e12a648412862b22c7ff3d2092a4949` |
| `mp3/sfx_step_grass_02.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `a16e91e80c19253976d2f04489b853746531bfe6c4aaeee1bf0d90814804650b` |
| `mp3/sfx_step_grass_03.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `ef725928e17d007b31a3d15b5bd43d06b0852c322a3004d0b92ad35174747f59` |
| `mp3/sfx_step_grass_04.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `a5ddcaaf6eb68aef06f1d2612024dd068b10cd368a21c19eb11091ee31a7132e` |
| `mp3/sfx_step_stone_01.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `7927ae4f9288e46fabddcc39092798dbcb84334cdcdd3ba856dc50178a990b8a` |
| `mp3/sfx_step_stone_02.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `2fc0a29d34d3b10f1b362e133adfb2518db0a952a049184258533aac6aec2632` |
| `mp3/sfx_step_stone_03.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `e0c273a33767fbbe6698b42a3167e54b61741a62c221673c2629854077a8cd16` |
| `mp3/sfx_step_stone_04.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `46e44b32007cc07226edd3214a9f4fc5a4b40da9e0e309e93091274eae2b2bf5` |
| `mp3/sfx_step_wood_01.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `7cdc64d8575cdd9655c2ca3926da8dc27741f649318c2c46b991d3f9cc3259f6` |
| `mp3/sfx_step_wood_02.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `090cf4906a8aac0b43adc46869c18e89af1cece05358e6ec1b59b3e38f5da427` |
| `mp3/sfx_step_wood_03.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `fff43489dee40e6d3f16d7cc98b3d5c21fa8f0ceb3603c62e21442ad2cd185a1` |
| `mp3/sfx_step_wood_04.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `3b17ca4af8ac84c116635f31bcb30964e674a0b5321f6509b9f8eff3a762abf7` |
| `mp3/sfx_windmill_loop.mp3` | 自制原创 | `src/synth_sfx_v2.py` | `337e368d6652b1bd223424e3bfb39a01800e91482fa9ba11d45fec725e3ca1aa` |

## 游戏里现有的三首 BGM（本次没有换）

| 文件 | 来源 | SHA256（5c54f7a 中的版本） |
|---|---|---|
| `bgm_main.mp3` | 自制原创（旧版 Voice Bot 程序合成，旋律原创，见仓库 docs/scene-bgm.md）。合成源工程原定在共享电脑 `/workspace/bgm/`，**现在电脑上找不到**，脚本路径待补 | `21ca21ac0972a076e772bff62b8cc5e5c4725002d02b51bc46f1be9c5eb1519a` |
| `bgm_meadow.mp3` | 自制原创（旧版 Voice Bot 程序合成，旋律原创，见仓库 docs/scene-bgm.md）。合成源工程原定在共享电脑 `/workspace/bgm/`，**现在电脑上找不到**，脚本路径待补 | `eb173a0d679f52e69a457c0a3512623e427efe5c2cf679e6caa9e1cb243cd87f` |
| `bgm_skycity.mp3` | 自制原创（旧版 Voice Bot 程序合成，旋律原创，见仓库 docs/scene-bgm.md）。合成源工程原定在共享电脑 `/workspace/bgm/`，**现在电脑上找不到**，脚本路径待补 | `88016beea998d5993d6ad68a0013da269a1e3e32c7ee082b3df2e38baab2c3b5` |

`compare/` 目录里的对比文件只用于试听，不进游戏。
