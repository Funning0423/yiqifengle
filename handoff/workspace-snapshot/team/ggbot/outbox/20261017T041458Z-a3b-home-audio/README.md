# A3b：回家时的音频余量（分支 fix/a3-home-sea-fadein，基于 09a1b8e，未合入 integration）
- 提交：c49801b（A3，Mac 验收未通过）→ **a17395c2c99d24239a724bcc2d98eec73095fa6b**（A3b，HEAD）。补丁 0001–0002 = 09a1b8e..HEAD。
- 只在本地：没有 push，没有 force，没有动主线。

## 改了什么
1. **海浪每次开始播放都从 0 渐入**，不管是谁让它停的（过场里自己因 heard<0.002 暂停、场景切换、切后台）。唯一例外：音乐滑杆拉到 0 再拉回，仍立即恢复（wind-audio 测试守着）。c49801b 只处理"被别人停"的情况，真机上海浪是自己暂停的，所以没生效。
2. **通用点击音 sfx_ui_click 在代码里降 2.5 dB**（×0.750，资源未重编码）：按钮、道具槽、设置道具。
3. **从地区点「主页/回家」时**，先在 80 ms 内把整床声音（地区 BGM + 风 + 正在响的音效）压到 0.6×，再在剩下的 0.32 s 里淡到 0，总时长不变（0.4 s）。

## Mac 上要看的日志（开 `__worldFlowLog`）
```
[QF_AUDIO] {"event":"home-duck","t":<ms>,"gain":0.6,"s":0.08,"outS":0.4}
[QF_AUDIO] {"event":"waves-start","t":<ms>,"vol":0.037,"from":"zero"}
[QF_AUDIO] {"event":"waves-play","t":<ms>,"vol":0.037,"outdoor":…,"wind":…}
```
- 回家：点按钮时出现 home-duck；之后到户外/海浪重新起播时，waves-start 的 vol 应该很小（约 0.01–0.05，按帧率和音乐滑杆），from 是 "zero"。
- 若 from 是 "slider"：说明这次是滑杆从 0 拉回，立即恢复是预期的。
- 期望：回家后约 50 ms 的峰值比 09a1b8e 低约 2.5 dB（估算 ≈0.75），不再满幅。

## 测试
- tools/voice-bot/wind/test_wind_audio.cjs 新增 "A3b" 段（真实 AmbienceAudio 模块）：transitionGain→0 让海浪自己暂停、旧音量 0.55 仍留着 → 恢复后首个可听帧 0.037；waves-start 日志的 vol 与之相符；quiet() 之后重启同样从 0；滑杆 0→1 立即恢复仍通过。
- tools/test_home_sea_fadein.cjs 改为 3 部分：海浪 0 起播 + 日志、点击增益 −2.5 dB 已用于所有 sfx_ui_click、回家调用 homeDuckOut（先 0.6×/80 ms 再淡出）；外加峰值余量估算（≈0.750，−2.5 dBFS）。
- Suite 54 项 49 项通过；没通过的只有已知 5 项。见 suite.txt。

## 包体
- 源码相对 09a1b8e：AmbienceAudio +1,062 B、GameAudio +1,034 B、WorldIntegrationBoot +64 B（大部分是注释）。c49801b 源码 +284 B 实测包体 +69 B，按此估算 A3b 包体约 +300–500 B，需要 Mac 实测（09a1b8e 为 19,125,680 B）。
