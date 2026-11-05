# 运镜bot HANDOFF — balloon door + dismount fling fix
Date: 2026-11-05 (America/New_York)

## Branches / SHA
| branch | tip | worktree |
|---|---|---|
| `cine/balloon-door-dismount-fix` | `7e835084` / `7e835084e6777609ab9aa19a0a1a4265e9f26ee0` (fix `24fd2f22`) | `/workspace/yiqifengle/work/cine-balloon-door-dismount` |

Base: `github/gbt/r5-b20-integrate-landing-visual-bg2` @ `9ec8410c`（体验版 `1.0.202611050927`）。

定稿：`work/pm/balloon-ascent-bugs-20261105.md`。截图：`work/pm/balloon-bugs-20261105/`（已拷到预览目录）。

## Root causes
### A 甩进海里
B5 `perform({kind:'stand', seat:seatDef})` 复用 **B1 草原** `seatFromBench` 世界根。`WorldIntegrationBoot` stand 把角色世界位 lerp 到 `standingControllerRoot`（草原篮座，距着陆 ~125 m）→ 蓝空虚空；随后 walk 从错误 `here` 拉回。  
湖畔 getout（`968be1d1`）已在 touchdown 重算 seat；草原→天空岛 **此前无对等修复**。  
着陆 yaw −112.253° 已稳；roll ±1.6° 是四脚晃，人应相对篮静止。

### B 飞行门开
`basket_door_b` GLB rest **Y=180°**（door2）。代码 `setRotationFromEuler(0,0,0)` 冲掉 rest → 飞行像门开。door A 关=0/开=100；door B 须关=180、开=180+θ。

### 追加
- 不停走：B5 到 `spawn_girl` 后 hard `cancelAndReset`，`lease.tail=false`。
- HUD：过场中隐藏「继续旅程 →」「主页」（`transitHud`）。
- 横石穿模：deck 路径加 `viaRock` `[3.55,-0.05,39.05]` local。

## Fix
1. `TransitionChain.ts`：`BASKET_DOOR_REST_YAW` / `basketDoorRestYaw` / `basketDoorYawDeg`。
2. `BalloonTransit.ts`：`closeBasketDoors()`（A=0,B=180）；B1 后 + 飞行每帧强制关；B5 开 = rest+θ；B5 用当前篮位 `landSeat`；stand 时仍挂篮再解绑；viaRock；终点 hard stop。
3. `RegionJourneyAdapter.ts`：湖畔 exit 门同样 rest/开合（防回归）。
4. `WorldIntegrationBoot.ts`：`transitHud` 门控 mainline/home。
5. `TransitionStaging.ts`：`b5ToPathS` 含 via（时长仍 ≤ cap 60；测得 meadow→skycity 58.72）。

**未碰** TSW / morph / FPS tip / sea-landing `s0New`。

## Tests / evidence
- `tools/transitions-continuous/test_balloon_door_dismount.cjs` **PASS**
- `tools/transitions-continuous/test_chain_ggbot.cjs` **PASS**（meadowToSkycity timeline 58.72）
- 预览：`previews/运镜bot/balloon-door-dismount/`（`EVIDENCE.json`、`fix-diagram.svg`、三张真机截图）

## Push
验收前 **不推 GitHub**。403 预期则打 bundle：
`docs/handoff/运镜bot/cine-balloon-door-dismount-fix.bundle`
