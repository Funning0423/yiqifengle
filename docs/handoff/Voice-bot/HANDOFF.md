# Voice-bot 交接：voice/b15-lakeside-l13-16

- 分支：voice/b15-lakeside-l13-16，交接前 HEAD 634be633，基点 gbt/r5-integrated-b15 55368056
- 提交：7e7b41e7（L13–16 棋盘音频数据 + 雪山概念）→ 63cf5b60（「风起」路线文档 + 雪山/终章动机小样）→ 759fe064（采样乐器方案 + 湖畔 30 s 样曲 v1）→ 634be633（风铃 v2：稀疏/压低/干净 + 天空城风铃尾音 6.4→3.6 s、音量 0.4→0.3）

## 当前规划
- 湖畔 13–16 关复用已有 BGM 和环境资源（包体 +0），和 voice/b15-landmark-mix 地标混音衔接。
- 第五场景雪山风铃山口：风声四层 + 金属管风铃（已定 A），见 docs/audio/snow-pass-concept.md。
- 「风起」全路线动机：各场景同一主题、不同乐器，终章依次回归后完整奏出，见 docs/audio/feng-qi-motif-roadmap.md。
- 正式版用 CC0/可商用采样（VSCO2 CC0 等），每场景独立子包，主包不增；新增四场景约 2.7 MB，见 docs/audio/instrument-sourcing-plan.md。

## 进度
- 已完成：L13–16 数据（已被 Grok Bot 接受 7e7b41e7）；雪山概念 4 段小样；动机文档 + 雪山/终章小样；采样方案 + 湖畔样曲 v1、v2；游戏内天空城风铃尾音复查；L13–16 环境音复查（无风铃，达标）。
- 未完成：采样版其余场景样曲；正式 BGM 制作；子包实际配置。
- 未测试：所有小样只做了测量（响度/峰值/频谱），无人试听过 v2；未在手机或 Cocos 内实机听；L13–16 关卡节点尚不存在，运行时未验证。

## 下一步怎么接
1. 等用户对 02_lakeside_fengqi_v2 的结论；通过则按同一标准做雪山、终章采样版，不通过按反馈重做（tools/audio/sampled/lakeside_windchime_demo_v2.py）。
2. build16 接入节点后，在 Cocos 里实测 L13–16 和地标衔接。
3. 测试：tools/…/b15-lakeside-l13-16/test_board_l13_16.cjs（TypeScript 在 /tmp/qfts/node_modules/typescript）。
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
