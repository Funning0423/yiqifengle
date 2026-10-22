# Voice-bot 交接：voice/b15-landmark-mix

- 分支：voice/b15-landmark-mix，交接前 HEAD ca52e113，基点 gbt/r5-integrated-b14 e567125a（ca52e113 已包含在 gbt/r5-integrated-b15 中）
- 提交：1b6bd8d1（地标混音：半径按真实几何，湖鸟 0.4 @18/45 m、园丁 0.45 @3/18 m、星环 0.5 @21/42 m，LANDMARK_GAIN_BUDGET 0.24→0.6）→ ca52e113（一次性音效直接以目标音量起播，去掉 1.5 s 静音；星环两路交替循环 16.0 s + 0.3 s 尾、0.15 s 交叉）

## 当前规划
地标声在 LandmarkAudioCore.ts / LandmarkAudio.ts（LandmarkLoopPair、LoopVoice）与 SceneAudioTable.ts 的 CONFIRMED_LANDMARKS 中配置，供 13–16 关混音衔接。

## 进度
- 已完成：1b6bd8d1 已验收；ca52e113 已交付并进入 b15 基线。
- 未完成：园丁/星环是否正式加入待定。
- 未测试：未在手机实机听；Cocos 内只做过数据/单测检查。

## 下一步怎么接
等 ca52e113 的验收结论；如需改，在本分支或 voice/b15-lakeside-l13-16 上继续。预览：/workspace/yiqifengle/previews/Voice-bot/b15-landmark-mix/。
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
