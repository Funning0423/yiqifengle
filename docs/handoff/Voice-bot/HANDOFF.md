# Voice-bot 交接：voice/v2-scene-audio

- 分支：voice/v2-scene-audio，交接前 HEAD 87b14b8d，基点 gbt/r5-integrated-b07-wip bc81575f（已并入 b14/b15）
- 提交：9285ded4 → a7ecd396（合入 feat/scene-audio-r1 17c75b2）→ cc281de0 → 87b14b8d（湖畔方案 B：天空城→热气球降落→湖畔，第 12 关后解锁）

## 当前规划
docs/audio/scene-sound-design.md：共用原创动机「风起」，三层环境声、地标、按地面分脚步声；BGM bgm_sail（C 大调 6/8，35.56 s）与 bgm_lakeside（F 大调，66.67 s），均 -17.4 LUFS。

## 进度
- 已完成：上述设计文档、BGM 候选、环境层、脚步 step_sand/step_cloud、SceneAudioTable 数据（BGM_CANDIDATES、PENDING_LAYER_ASSETS、SCENE_AMBIENCE_DESIGN、FOOTSTEP_SETS、SCENE_GROUND_TYPES、TRAVEL_ROUTES.lakeside、PENDING_CANDIDATES）。
- 未完成：travelProfile() 湖畔路由（留给 Cursor）；水鸟/园丁/星环是否加入；脚步 r4.1 实录。
- 未测试：test_manifests.cjs 基线即有 454 个问题，只手工补了改动文件；未实机试听。

## 下一步怎么接
本分支已被集成，新工作请基于最新 gbt 集成分支另开分支。预览：/workspace/yiqifengle/previews/Voice-bot/v2-scene-audio/（01–13）。
## 待定事项（等 Funning / Grok Bot 拍板）
1. 湖畔采样样曲 v2 `previews/Voice-bot/sampled-instruments/02_lakeside_fengqi_v2_chime_sparse_30s.mp3`（634be633）：用户尚未回复是否通过。
2. 是否加入湖畔水鸟（USFWS/NPS 公有领域）及天空之城园丁、星环地标声（PENDING_CANDIDATES）。
3. 脚步声 r4.1：等 Funning 在 Mac 上实录。
4. 正式版配乐：已定为采样/实录乐器（不用合成音色），按 docs/audio/instrument-sourcing-plan.md 执行。
5. `travelProfile()` 湖畔路线仍走 island 配置：留给 Cursor 改，连同两条云端写的测试。
6. 第 13–16 关棋盘节点和运行时按关读音量：等 Grok Bot 的 build16 接入，之前这些音频数据不会播放。

## 规则提醒
- mp3 预览，自然衰减尾音，2–6 kHz 不刺耳，不急促；优先 CC0/可商用实录，全部记入 docs/audio-credits.md。
- 本机不推送、不配 GitHub 登录；以 bundle 交给 Grok Bot 从 Mac 推。

## 全部分支一览（Voice-bot）
| 分支 | SHA | 状态 |
|---|---|---|
| voice/b15-lakeside-l13-16 | 634be633 | 进行中，基点 gbt/r5-integrated-b15 55368056 |
| voice/b15-landmark-mix | ca52e113 | 1b6bd8d1 已验收；ca52e113 已并入 b15 基线，基点 b14 e567125a |
| voice/v2-scene-audio | 87b14b8d | 已并入 b14/b15，基点 b07-wip bc81575f |
| voice/r5-lakeside-fill | 9b1ce023 | 已验收 |
| voice/r5-sail-audio | a7baa222 | 已验收 |
| voice/r5-home-sign-compare, voice/home-sign-{A,A2,B,C}-r2 | 24c19afa / 74854240 / 8719e88e / 72a85d16 / 0e0c48f5 | 已关闭，未合并（Funning 保留现有招牌） |

## 产物路径（仅路径，不入库新大文件）
- 推送 bundle：/workspace/yiqifengle/bundles/push-20261022/
- 旧 bundle：/workspace/vbr5/*.bundle（voice-r5、voice-b15-landmark-mix、voice-v2-scene-audio、voice-b15-lakeside-l13-16 等）
- 预览：/workspace/yiqifengle/wt-l13/previews/Voice-bot/{b15-lakeside-l13-16,feng-qi-roadmap,sampled-instruments}/；/workspace/yiqifengle/previews/Voice-bot/{v2-scene-audio,b15-landmark-mix}/
