# 音频事件：海鸥（Voice bot → 场景特效bot）

海鸥什么时候叫、在哪个方位、离多远，都由音频（`audio/AmbienceAudio.ts`）决定。可见海鸥订阅事件，在同一个方位飞过，提前量够它从画面外飞进来。

## 接口

```ts
import { AmbienceAudio } from '../audio/AmbienceAudio';
const off = AmbienceAudio.onGullCall(e => { /* ... */ });   // 返回取消订阅函数
AmbienceAudio.requestGullCall('near', 30);                  // 返回 id 或 null
AmbienceAudio.gameTime();                                   // 事件里 at 用的时钟（秒）
// 不想 import 也可以用：__worldIntegration.onGullCall / requestGullCall / gullClock
```

- `__worldIntegration` 由 WorldIntegrationBoot 创建（或重建）；AmbienceAudio 每帧检查一次，把这三个函数挂上去。Boot 本身没有改动。
- 回调抛异常会被捕获并 `console.warn`，不影响声音，也不影响其他订阅者。

## 事件

每声海鸥都会发两次事件，`id` 相同：先发 `'scheduled'`（决定要叫的时候），再发 `'start'`（声音真正开始的那一帧）。已经排好、还没开始的海鸥如果被取消，会发 `'cancelled'`（`id` 相同），之后不会再有 `'start'`。

| 字段 | 含义 |
|---|---|
| `id` | 整数，单调递增 |
| `phase` | `'scheduled'` / `'start'` / `'cancelled'` |
| `at` | 开始时间（秒，`gameTime()` 时钟，也就是 AmbienceAudio 每帧累加的 dt）。`scheduled` 里是计划的开始时间；`start` 里是实际开始的时间，和计划最多差一帧 |
| `leadS` | 发出事件时离开始还有几秒（`start` / `cancelled` 为 0） |
| `dist` | `'near'` / `'far'` |
| `yawWorldDeg` | 以女孩为中心的世界水平方位，0..360。方向向量是 `(sin y, 0, cos y)`，即 0 = +Z、90 = +X，和灯塔光束、运镜bot camera-track 的约定相同。由音频选定，`scheduled` 到 `start` 之间不会变 |
| `distM` | 大致距离：near 6–12 m，far 30–60 m |
| `durS` | 声音时长：gull_1 3.40 s，gull_2 3.29 s，gull_3 3.24 s（真实录音加混响尾巴，最后约 1 s 是尾巴） |
| `kind` | `'random'` / `'distant'` / `'near'` / `'crane'` / `'request'`（附加字段） |
| `clip`, `vol` | 素材名和音量（附加字段，调试用） |

## 什么时候决定（提前量）

| 来源 | 什么时候决定 | 提前量 | dist / 方位 |
|---|---|---|---|
| 岛上随机海鸥 | 计时器离开始还剩 2.5 s 时 | 2.5 s（被 2.5 s 最小间隔推后时会更长） | gull_1 为 near，gull_2/3 为 far |
| 出门近处海鸥 | `onApronLift('full')` 回调里（WindAudio → `notifyApronFull`） | 计划 0.4 s 后开始；被最小间隔推后时更长。真实出门时间线里约 1.7 s（拍打后 0.4 s 那个时间点离前一声远处海鸥不到 2.5 s，被推后到它之后 2.5 s，即约 16.5 s） | near |
| 起升镜头海鸥 | `onCraneStart` 回调里 | 1.5 s（离上一声不足 2.5 s 时不叫，也不发事件） | near |
| 风力越过 0.4 / 0.7 的远处海鸥 | 平滑后的风力越线那一帧 | 0.5 s | far，方位任意 |
| `requestGullCall` | 调用时 | 0（`scheduled` 和 `start` 在同一次调用里先后发出） | 调用方给定 |

- 出门时序完全跟着 `onApronLift` / `onCraneStart` / 风力走，代码里没有写死的时间点。
- 远处海鸥为什么不“预测越线”：出门时风力先在 0.15 停大约 1.5 s，然后才加速上升。按上升速度做线性外推，要么在停住时误报（随后只能取消），要么晚大约 1 s。所以改成越线时决定、固定延后 0.5 s，0.4 那声从约 13.5 s 移到约 14.0 s（从 leaveHome 算起），听不出差别。越线后 0.5 s 内如果风力又回落到阈值 -0.08 以下，就发 `'cancelled'`。
- 任意两声海鸥的开始时间至少隔 2.5 s，这个间隔在决定时就满足了：排进去的时间离已经开始的和已经排好的每一声都不少于 2.5 s。来源允许推迟的上限是：近处 4 s，0.4 远处 4 s，0.7 远处和起升镜头 0 s（放不下就不叫，也不发事件），随机海鸥 30 s。
- 会被取消的情况：环境声不能播（静音、切后台、还没有手势），或者世界看不见、没有 rig；随机海鸥另外在出门风声段开始或者进了室内时取消。

## 方位怎么选

- near（随机 gull_1、出门近处、起升镜头）：在决定的那一帧，取镜头水平朝向 ±60° 以内的方位，让可见海鸥从画面里飞过，而不是在镜头背后。镜头正在转（水平角速度平滑后超过 4°/s）时，放在转向的那一侧，偏离 5°–60°；不在转时，在 ±60° 内均匀随机。读不到镜头时方位任意。
- far：0–360° 均匀随机。
- 镜头朝向取 `WorldFlowComponent.worldCamera.node.forward` 的 `atan2(x, z)`。

## 声像（每帧）

- 每一帧都用当前镜头朝向重算：`pan = 0.5 * sin(camYaw - yawWorldDeg)`，海鸥在镜头右边时为正。所以出门时镜头一转，声像会跟着变。海鸥在正前方或正后方时居中。
- 播放方式：每声海鸥用两个 AudioSource 同时播放 `audio_sfx/gull_lr/<clip>_L.mp3` 和 `<clip>_R.mp3`（同一份单声道素材分别只放在左声道、只放在右声道；64 kbps 立体声，每声道码率和原来的 32 kbps 单声道相同，电平也和原文件对齐）。增益按等功率声像算：`L = √2·cos θ`，`R = √2·sin θ`，`θ = (pan+1)·π/4`。居中时两边都是 1，和原来单声道居中播放一样响；pan = ±0.5 时约为 1.31 / 0.54。
- 最多同时两对声源（间隔 2.5 s，单声 3.4 s）。静音或不能出声时立即停止。L/R 素材没加载到时，退回原来的 `GameAudio.play(clip)` 居中播放，事件照常发。
- 手机上需要确认：两个声源在同一帧起播；在微信里如果起播时间差几十毫秒，只会让声像一开始稍微偏向先响的那边。
- 声像只看方位，不算视差（海鸥离女孩的距离远大于镜头离女孩的距离）。

## 夜里

- 夜间权重取自 `world-r2/IslandPropsLayout.ts` 的 `propNightWeight()`（0 白天，1 夜里），由 `audio/AmbienceNight.ts` 接进 `AmbienceAudio.setNightSource`。单独放一个文件，是为了让 AmbienceAudio 不直接 import world-r2，音频测试的模块加载器就不用改。在室内这个值可能停住不更新，不过室内本来就没有声音。
- 随机海鸥的频率按权重插值：白天 1，夜里 0.4，计时器按这个倍数走。音量按权重插值：白天 1，夜里 -3 dB（0.6 → 0.425）。出门、起升镜头和 request 的海鸥保持原来的混音音量。

## requestGullCall(dist, yawWorldDeg)

- 只在以下条件都满足时播放：离上一声开始至少 2.5 s；前后 2.5 s 内没有已经排好的海鸥（保证最小间隔）；环境声可以播；在室外（室外量大于 0.5，或者处在出门风声段且世界可见）。
- 满足就立即播放，返回 id，并发出 `scheduled`（leadS 0）和 `start` 两个事件。不满足返回 `null`，不发事件。参数不合法时也返回 null。
- near 用 gull_1，音量 0.5；far 随机用 gull_2（0.3）或 gull_3（0.38）。

## 测试

- `node tools/voice-bot/gull/test_gull_events.cjs`：提前量和调度（随机、近处、起升镜头、远处、取消）、id 配对、每帧按镜头朝向算声像、near 方位选择、requestGullCall 的间隔和条件、夜间频率和音量、`__worldIntegration` 挂载、ES5。
- `node tools/voice-bot/wind/test_wind_audio.cjs`：出门真实时间线（运镜bot 138bca5）。现在 0.4 那声在约 14.0 s，近处那声在拍打后约 1.7 s，所有间隔都不少于 2.5 s。
