# tip · SkycityLegHeavy 默认 OFF（升空 + 着陆后往广场 共用重路径 A/B）· 2026-11-05

## Tip / feature
- **feature** `2beb1cd44355a11fcfa092b49f26cc165c2e91f8`
- **tip** `0773db7382c4268fa64a6461880003fc09b60a81`
- **父 tip / 对照体验**：integrate `9ec8410` / 体验版 `1.0.202611050927`（TSW 已默认 OFF，Funning「整机不卡了」）
- **叠合 tip 栈**：`ggbot/b20-meadow-c-skycity-rt` @ lakeside trial ON `8aa88827` 之上

## 覆盖两段（同一刀）
| 段 | Funning 反馈 | 本 tip 闸住的嫌疑 |
|---|---|---|
| ① meadow→skycity **升空** | 热气球升空**周期性掉帧** | BalloonTransit `scanSeas` ~0.5s 全场景树扫；阈值未变时每帧 `showNamed×N` / meadow grass / clouds / farCard / arrived dress；`driver.step` 与 `beforeDraw` **双 apply** |
| ② skycity **着陆后 walk→广场** | 着陆后往广场走**一直掉帧** | `SkycityCloudsea.sync` 在 `setFlightHidden(false)` 后每帧 `syncDay` 全场景 walk + Camera far 扫 |

**假设（非 ROOT HIT 级证据）**：TSW 已证伪为整机周期源并保持 OFF；升空周期 + 着陆后持续 hitch 更吻合 BalloonTransit 升空重 paint 与着陆后 Cloudsea 每帧全树 sync 的共用「skycity-leg 重路径」。本 tip 用**一个总开关**默认关掉两边，便于一轮 A/B。


## 与 PM 定稿分工（`work/pm/balloon-ascent-bugs-20261105.md`）
| Bug | Owner | 本 tip |
|---|---|---|
| A 甩海（B5 seatDef） | **运镜** | **不改** seatDef / B5 解绑 |
| B 门开（door B rest 180°） | **运镜** | **不改** 门角 / doorB rest |
| C 升空+广场 walk stutter | **GGbot（本 tip）** | SkycityLegHeavy 默认 OFF |

**硬约束覆盖 md 旧「TSW/warm」建议**：体验 `9ec8410` TSW 已 OFF 且 Funning 仍报升空+walk 卡 → **勿再归因 TSW，勿重开 TSW**。本 tip 另找 BalloonTransit/Cloudsea 负载源。勿为掉帧回退 sea-landing 视觉。运镜 tip 稍后合入时勿冲掉 B5 seatDef + door B rest（本刀未叠运镜改动）。

## 一句话
`SKYCITY_LEG_HEAVY_ENABLED` **默认 false**：关掉升空段重 paint / 双 apply / 0.5s scanSeas，以及着陆后 Cloudsea 每帧 syncDay；**保起身**；**TSW 仍 OFF**；**湖畔 kit trial 仍默认 ON**；阈值/镜头/海面/火焰/handoff 视觉保留。

## 成对约束（未拆）
| 资产 | 标识 |
|---|---|
| COUNT GLB | content sha **e3fbce98…** |
| formal anim_meta | tip **`6fd22962`** |

## 改动
| 文件 | 改动 |
|---|---|
| `region/SkycityLegHeavy.ts` (+meta) | `SKYCITY_LEG_HEAVY_ENABLED` 默认 false；`setSkycityLegHeavyEnabled`；`skycityLegHeavyFromFlag`（`?qfskyheavy=0/1` / `__qfSkyLegHeavy`） |
| `region/BalloonTransit.ts` | mount 读 flag；scanSeas / runVis showNamed / 双 apply 闸 |
| `region/SkycityCloudsea.ts` | OFF → syncDay/camera far 仅 night 翻转或 `setFlightHidden` 时跑 |
| identity / warm / meadow 测 | BalloonTransit 故意 DIFF peel；默认 OFF + 手动 ON |
| meta-allowlist | allowAdd `SkycityLegHeavy.ts.meta` |
| handoff / NOTES | 本文件 |

## 明确不做
- **不**重开 `TRANSITION_SHADER_WARM`（ROOT HIT 已确认；本 tip 源码断言仍 `=false`）
- **不**改 StandupProgramWarm / Morph idle / PeriodHeavy / SceneAudioPoll 默认 OFF
- **不**改湖畔 `LAKESIDE_KIT` trial 默认 ON
- **不**拆 e3fbce98 + 6fd22962；**不**叠内容线；**不**传微信；**upload=等 PM**
- **不**回退 K.s1 / sea-landing 视觉门槛（仅减冗余树走）

## 回滚 / 对照打开（恢复旧重路径）
```js
// 控制台
setSkycityLegHeavyEnabled(true);
// 或启动参数 / __qf
?qfskyheavy=1
globalThis.__qfSkyLegHeavy = true;
```
关回：`?qfskyheavy=0` 或 `setSkycityLegHeavyEnabled(false)` / `__qfSkyLegHeavy=false`。

## 如何验证默认 OFF
1. 源码：`SKYCITY_LEG_HEAVY_ENABLED=false`；`TRANSITION_SHADER_WARM_ENABLED=false` 仍在
2. 离线：`node tools/meadow/test_skycity_leg_heavy.cjs` → PASS
3. 离线：`node tools/walk-driver/test_standup_program_warm.cjs` → `skycityLegHeavyDefaultOff/Gates=true`
4. 离线：`node tools/meadow/test_integrate_vs_fb74_scripts_identity.cjs` → BalloonTransit PEEL OK
5. 真机：升空周期 stutter + 着陆后往广场持续掉帧对照；起身仍顺；湖畔 kit 仍在；控制台按上节回滚

## 验收读法（Funning / PM）
1. **若升空周期 + 着陆后广场掉帧都消 / 明显减轻**：命中 skycity-leg 共用重路径 → 可再只开其一定位（paint vs Cloudsea）
2. **若只消一段**：记下哪段仍卡 → 下一刀只剥剩余段
3. **若两段都仍在**：本假设非主因 → 下一刀列 Morph seat 全程 / GC / 其它 skycity 常驻（勿重开 TSW）
4. **若起身变卡**：本 tip 未碰 Standup/Morph seat；回报
5. 不以 Mac setCamera/board=0 否决（CONTROL_FAIL_NOISE）

## 未 upload
本 tip **未** WeChat upload；合入体验版 = 等 PM。
