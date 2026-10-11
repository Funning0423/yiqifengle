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
| 出门近处海鸥 | `onApronLift('full')` 回调里（WindAudio → `notifyApronFull`） | 0.4 s，优先级最高：和它冲突的远处或随机海鸥让路（见下） | near |
| 起升镜头海鸥 | `onCraneStart` 回调里 | 1.5 s（离上一声 near 不足 2.5 s、或离上一声 far 不足 1.2 s 时不叫，也不发事件） | near |
| 风力越过 0.4 / 0.7 的远处海鸥 | 平滑后的风力越线那一帧 | 0.5 s | far，方位任意 |
| `requestGullCall` | 调用时 | 0（`scheduled` 和 `start` 在同一次调用里先后发出） | 调用方给定 |

- 出门时序完全跟着 `onApronLift` / `onCraneStart` / 风力走，代码里没有写死的时间点。
- 远处海鸥为什么不“预测越线”：出门时风力先在 0.15 停大约 1.5 s，然后才加速上升。按上升速度做线性外推，要么在停住时误报（随后只能取消），要么晚大约 1 s。所以改成越线时决定、固定延后 0.5 s，0.4 那声从约 13.5 s 移到约 14.0 s（从 leaveHome 算起），听不出差别。越线后 0.5 s 内如果风力又回落到阈值 -0.08 以下，就发 `'cancelled'`。
- 最小间隔分距离：同距离（near 和 near、far 和 far）至少 2.5 s；near 和 far 之间只要 1.2 s。远处那声轻，又带混响，叠上近处那声的开头也听得清。间隔在决定时就满足了：排进去的时间离已经开始的和已经排好的每一声都满足这个间隔。来源允许推迟的上限是：近处 4 s，0.4 远处 4 s，0.7 远处和起升镜头 0 s（放不下就不叫，也不发事件），随机海鸥 30 s。
- 出门近处海鸥优先，远处海鸥让路：决定近处那声时，和它冲突的远处或随机海鸥（不满足上面的间隔）如果还没开始，就发 `'cancelled'` 取消；如果已经开始，就 0.25 s 淡出，也发 `'cancelled'`，这是唯一一种 `'start'` 之后还会出现 `'cancelled'` 的情况。近处那声因此总是落在 onApronLift + 0.4 s。只有在退回居中播放（L/R 素材缺失，停不了）时，近处那声才按间隔顺延。
- 真实出门时间线（运镜bot 50c0227，int/v1 38b005f，`exit50c_timeline.json`；从 leaveHome 算起）：

  | | onApronLift 14.87（lift_time_s 0.37） | onApronLift 14.93（时间线备注里的值） | 138bca5（拍打 14.82，起升 15.483） |
  |---|---|---|---|
  | 远处海鸥（风力越过 0.4，延后 0.5 s） | 14.03 | 14.03 | 13.98 |
  | 0.7 那声 | 并掉（和上一声远处不足 2.5 s） | 并掉 | 并掉 |
  | 近处海鸥 | **15.30**（拍打后 0.43 s，比起升早 0.27 s） | **15.35**（拍打后 0.42 s，比起升早 0.22 s） | 15.25（拍打后 0.43 s，比起升早 0.23 s） |
  | 起升镜头海鸥（onCraneStart 15.567 + 1.5 s） | 不叫（离近处那声 1.8 s，同距离要 2.5 s） | 不叫 | 不叫 |
  | 近处和远处的间隔 | 1.27 s（要求至少 1.2 s，远处那声保留） | 1.32 s | 1.27 s |

  拍打后多出来的 0.02–0.03 s 是帧对齐：回调在拍打那一帧触发，开始时间落在之后第一个满足条件的帧上。
- 会被取消的情况：环境声不能播（静音、切后台、还没有手势），或者世界看不见、没有 rig；随机海鸥另外在出门风声段开始或者进了室内时取消。

## 方位怎么选

- near（随机 gull_1、出门近处、起升镜头）：在决定的那一帧，取镜头水平朝向 ±60° 以内的方位，让可见海鸥从画面里飞过，而不是在镜头背后。镜头正在转（水平角速度平滑后超过 4°/s）时，放在转向的那一侧，偏离 5°–60°；不在转时，在 ±60° 内均匀随机。读不到镜头时方位任意。
- far：0–360° 均匀随机。
- 镜头朝向取 `WorldFlowComponent.worldCamera.node.forward` 的 `atan2(x, z)`。

## 声像（每帧）

- 随机海鸥的素材用洗牌袋选：每轮三个素材各出一次、顺序随机，新一轮的第一个不会和上一轮最后一个相同。所以不会连着两声用同一个素材，每 6 声里每个素材正好 2 次。
- 每一帧都用当前镜头朝向重算：`pan = 0.5 * sin(camYaw - yawWorldDeg)`，海鸥在镜头右边时为正。所以出门时镜头一转，声像会跟着变。海鸥在正前方或正后方时居中。
- 播放方式：每声海鸥用两个 AudioSource 同时播放 `audio_sfx/gull_lr/<clip>_L.mp3` 和 `<clip>_R.mp3`（同一份单声道素材分别只放在左声道、只放在右声道；电平和原文件对齐）。编码：32 kbps CBR joint-stereo、44.1 kHz，lowpass 8 kHz（`-cutoff 8000`，不加的话 LAME 在 32k 立体声下默认切到约 5.4 kHz，2 号、3 号海鸥 5–8 kHz 的叫声泛音会没掉），由 v6 无损母带（/workspace/gullv3/v6n_*.wav，不进仓库）直接编码，不经过旧 mp3 转码。空的那一边几乎不占码率，所以有声的一边实际码率和原来的 32 kbps 单声道素材相当。六个文件合计 160,070 → 80,926 B（-79,144 B）。。增益按等功率曲线算，再按较响的一边归一化：`θ = (pan+1)·π/4`，`L = cos θ / max(cos θ, sin θ)`，`R = sin θ / max(...)`。较响的一边始终是 1，居中时两边都是 1，和原来单声道居中播放一样响；pan = ±0.5 时为 1 / 0.414。不会把任何一边推到 vol 以上；改版前的等功率 √2 曲线在 pan 0.5 时会推到 1.31 倍，峰值多 2.3 dB。
- 最多同时三对声源（near 0 s、far 1.2 s、near 2.5 s 三声的 3.4 s 会叠在一起）。静音或不能出声时立即停止。L/R 素材没加载到时，退回原来的 `GameAudio.play(clip)` 居中播放，事件照常发。
- 手机上需要确认：两个声源在同一帧起播；在微信里如果起播时间差几十毫秒，只会让声像一开始稍微偏向先响的那边。
- 声像只看方位，不算视差（海鸥离女孩的距离远大于镜头离女孩的距离）。

## 夜里

- 夜间权重取自 `world-r2/IslandPropsLayout.ts` 的 `propNightWeight()`（0 白天，1 夜里），由 `audio/AmbienceNight.ts` 接进 `AmbienceAudio.setNightSource`。单独放一个文件，是为了让 AmbienceAudio 不直接 import world-r2，音频测试的模块加载器就不用改。在室内这个值可能停住不更新，不过室内本来就没有声音。
- 随机海鸥的频率按权重插值：白天 1，夜里 0.4，计时器按这个倍数走。音量按权重插值：白天 1，夜里 -3 dB（0.6 → 0.425）。出门、起升镜头和 request 的海鸥保持原来的混音音量。

## requestGullCall(dist, yawWorldDeg)

- 只在以下条件都满足时播放：和已经开始的、已经排好的每一声都满足分距离的最小间隔（同距离 2.5 s，远近之间 1.2 s）；环境声可以播；在室外（室外量大于 0.5，或者处在出门风声段且世界可见）。
- 满足就立即播放，返回 id，并发出 `scheduled`（leadS 0）和 `start` 两个事件。不满足返回 `null`，不发事件。参数不合法时也返回 null。
- near 用 gull_1，音量 0.5；far 随机用 gull_2（0.3）或 gull_3（0.38）。

## 测试

- `node tools/voice-bot/gull/test_gull_events.cjs`：提前量和调度（随机、近处、起升镜头、远处、取消）、id 配对、每帧按镜头朝向算声像、near 方位选择、requestGullCall 的间隔和条件、夜间频率和音量、`__worldIntegration` 挂载、ES5。
- `node tools/voice-bot/wind/test_wind_audio.cjs`：出门真实时间线（138bca5，以及 50c0227 拍打 14.87 / 14.93 两种）。检查的是：近处那声在拍打后 0.4 s（误差一帧）、在起升之前，远处那声保留，0.7 那声并掉，起升镜头那声不叫；另外检查 WindAudio 每帧都调了 setWindDuck。
- `node tools/voice-bot/bgm/test_scene_bgm.cjs`：BGM 让风（时间常数、-4 dB、-2 dB、乘在玩家音量上）。

## 峰值余量（出门那段）

工具：`tools/voice-bot/wind/sim_exit.cjs` 在真实时间线上跑真正的 WindAudio + AmbienceAudio（60 fps），导出每帧增益和事件；`tools/voice-bot/wind/render_exit_mix.py` 用游戏素材把它混成立体声，下面垫岛屿 BGM v1。BGM 按 GameAudio 的方式播放：musicVolume 0.4 × 风力让路 × 两个声源的循环交叉。近处海鸥按最坏的 pan 0.5 放（较响的一边）。

| | 改之前 | 改之后（BGM 让风 -4 dB + 新声像曲线 + 新间隔） |
|---|---|---|
| 最坏叠加：每层峰值 × 该帧增益直接相加，BGM 按循环交叉的最坏情况（×√2），拍打 0.7 和近处海鸥同时到顶 | **+5.06 dBFS** | **+3.95 dBFS** |
| 实际混音，BGM 起点在整首循环里扫一遍（含交叉接缝，375 个位置）取最坏 | **-2.94 dBFS** | **-3.89 dBFS** |
| 实际混音，各个 BGM 起点的中位数 | -4.50 dBFS | -4.93 dBFS |

- 实际混音满足"至少 3 dB 余量"；把所有层的峰值硬加在一起的最坏情况不满足。要让硬加也到 -3 dBFS，出门这段所有层（风、海浪、拍打、海鸥、BGM）都得再降大约 7 dB，出门那一下就没劲了，所以没有这么做。风两层、海浪、BGM 都是噪声类或者互不相关的信号，峰值几乎不会在同一个采样上对齐，扫 BGM 起点得到的最坏值是 -3.89 dBFS。
- 玩家把音乐音量拉到 1 时（默认 0.4）：实际混音最坏 -1.99 dBFS，改之前 -0.14；中位数 -3.52，改之前 -2.38；硬加 +5.77，改之前 +7.46。
- 各层在最坏那一帧（约 16.0 s）的峰值（dBFS）：风 soft -12.7，风 strong -10.3，海浪 -11.6，BGM（交叉，已让风）-12.3，拍打 -11.0，近处海鸥 -11.9。
- BGM 让风：`GameAudio.setWindDuck(s)`，由 WindAudio 每帧调用，传入平滑后的风力 s。BGM 增益 = `musicVolume × 10^(-4 × d / 20)`，其中 d 是 `smoothstep(0.2, 1, s)` 按 0.5 s 时间常数平滑后的值。满风时 0.4 → 0.252。WindAudio 被静音、销毁或者没有风时传 0。
