# 0005b：GameAudio 打断/挂起（作者 grokbot-2/ggbot；GameAudio v0.3.1 由 Voice Bot 提供）

## 输入核对
- Voice Bot 包 `20261009T2253Z-voicebot-AUDIO-0005b-INTERRUPT-INPUT-v1.1.zip`，外层 SHA256 `20e26f90…8d57`，与同目录 SHA 清单一致；包内 12 个文件按清单逐个核对 OK。
- `GameAudio.ts` v0.3.1 SHA256 `7f6b5808…d377`，一字未改。
- Oi R6 基线：从 `team/oi/r6audio/delta-from-5df737a.patch` 抽出 `GameAudio.ts`（git blob `4b6f0ac`，SHA256 `a2f40503…272e`）和 `AudioBridge.ts`（SHA256 `e20ff1da…3a75`）。Voice Bot 对 R6 的 diff 打上去后与 v0.3.1 **逐字节一致**。

## 基线与交付物（请 Oi 注意）
- **基线 = Oi R6 音效状态**（已含 R6 对切后台/生命周期的修复），不是原始 0005。
- 主补丁：`0001-0005b-GameAudio-v0.3.1-interrupt-suspend-Voice-Bot-o.patch`（`git format-patch`，只含 commit 2）。
  - 应用：`git am --directory=creator-build-project 0001-0005b-*.patch`
  - 只改 `creator-build-project/assets/scripts/audio/GameAudio.ts`；`AudioBridge.ts` 保持 Oi R6 不动；`.meta` 不动。
- 参考：`0005b-combined-vs-0005.diff` 是相对原始 0005 的合并 diff（含 R6 AudioBridge 改动 + GameAudio v0.3.1），**不要**用它打补丁；Oi 树上若已是 R6，请只用上面的 format-patch。
- 不碰 `ManagedMobileBoardUI` / `WorldIntegrationBoot` / `MainlineHost`，也不动 0007 / 0008。

## 决策（Grok Bot）
0005b = **GameAudio v0.3.1 + Oi R6 的 AudioBridge.ts**。

## GameAudio v0.3.1 改了什么（相对 Oi R6）
1. 统一挂起原因集合 `{hidden, interrupted}`；任一原因在就不播新音效，循环声保持暂停；全部清掉才恢复。重复事件幂等。
2. `wx.onAudioInterruptionBegin/End` 处理来电/其他 App 抢音频。
3. 保留 R6 的 `game.on(HIDE/SHOW)`，再加 `wx.onHide/onShow` 兜底；两路都映射到同一个 `hidden`。
4. **v0.3.1**：回前台时同时清掉 `hidden` 和 `interrupted`，避免收不到 InterruptionEnd 时永久无声。前台期间开始的打断、没有切后台，仍等 InterruptionEnd。迟到的 End 是空操作。
5. 启动时调一次 `wx.setInnerAudioOption({ mixWithOther: true, obeyMuteSwitch: true })`。
6. 挂起期间若引擎自动恢复循环声，`update()` 立刻再暂停。
7. 静音存储 key 恢复为正式 key `qfl.audio.muted`（不再读写 R6 隔离测试 key）。
8. 公开方法不变；新增只读 `isSuspended()` / `suspendReasons()`。`AudioBridge.ts` 不用改。

## AudioBridge（本版随包的状态）
随 Oi R6：释放监听且只挂一次（`director.once`）、`taggedNodes` 清理。0005b 不再改它。

## 自测
| 项 | 结果 |
|---|---|
| 外层 + 包内 SHA 核对 | passed |
| R6 GameAudio 重建 SHA `a2f40503…272e` | passed |
| Voice Bot diff → v0.3.1 逐字节 | passed |
| `git am --directory=creator-build-project` 打在 mock Oi R6 音效树上 | passed（GameAudio → `7f6b5808…d377`，AudioBridge 不变） |
| TS 语法（`ts.createSourceFile` parseDiagnostics）两个文件 | passed（0 诊断） |
| Voice Bot 自测 `test_gameaudio_v03.cjs`（Node + 模拟 wx/cc） | **16 场景，87/87 通过** |
| Creator 构建 / DevTools / 真机 | **not_run** |

## 请 Oi 真机验收（Voice Bot README 第 7 节 I1–I3，共 6 项）
详见 Voice Bot 包 README；摘要：
1. **I1 来电**：关卡连续消除时接微信语音/电话 10 秒后挂断 → 来电期间无游戏声；回来后下一次消除/点击有声；不补播。
2. **I1b 来电不接**：拒接后音效正常。
3. **I1c 通话中切回**：接听后不挂断切回游戏点几下再挂断 → v0.3.1 允许切回后可能叠音；挂断后正常。
4. **I2 语音消息 / 音乐 App**：播语音消息或 QQ/Apple Music 再回游戏 → 回来有声；记录音乐是否被停（文档预计外放互斥）。
5. **I2b 前台打断**：游戏在前台时从控制中心让别的 App 放音频再停 → 恢复依赖 InterruptionEnd；若一直没声，切一次后台再回来应恢复。
6. **I3 iOS 静音拨片**：静音时无声，拨回后有声。

每项请附微信版本、基础库、机型，以及 console 有无 `[GameAudio]` 告警。

## 已知限制（如实）
- `playOneShot` 无取消句柄：挂起那一刻已经在响的音效停不掉；回前台后尾巴可能播完（最长约 3.5 s 过关音）。
- 外放时 `mixWithOther` 按微信文档会被忽略，真机是否互斥以 I2 为准。
