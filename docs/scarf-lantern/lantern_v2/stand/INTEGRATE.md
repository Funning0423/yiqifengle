# 高台取灯 / 放灯 挂接说明（灯塔子包）

骨骼命名是镜像的：**.L = 她自己的右侧**（右手提灯）。下文"右手"均指 hand.L。

## 资源
- `lighthouse_lantern_stand.glb`：clip `lantern_pick_up_stand`、`lantern_put_down_stand`（全身 base 层，节点路径与主包一致，无网格）。
- `lantern_stand_meta.json`：时长、交接帧、`lantern_hold_R`、`lantern_settle` 曲线、高台参数、socket 旋转提案。

## 场景
- 高台：0.22 × 0.22 × 0.40 m，台面中心 = 角色根空间 (−0.20, 0.40, 0.36)，yaw 与角色根一致。玩法上把角色根节点吸附到"台前站位"（= 台面中心 − R_root·(−0.20, 0.40, 0.36)），朝向台子。
- 灯在台上时：灯是场景节点，lantern 根（= 握把中心）在台面中心上方 0.1502 m，竖直，yaw = 角色根 yaw。

## 取灯（pick）
1. 吸附站位后播 `lantern_pick_up_stand`（0.2 s crossfade，提灯层权重 0）。
2. **t = 1.0333 s（f31）同帧**：把灯从场景节点挂到 socket.lantern（握把局部位姿归零），铰链摆状态重置（θ=0，ω=0）。
3. `lantern_settle` 在 f31–40 从 1 降到 0：铰链从"手稳住"过渡到自由摆。
4. clip 结束 = `idle_breathing_loop_lantern` f0：切到提灯层权重 1，base 播 idle_breathing_loop（同步）。

## 放灯（put）
1. 从提灯待机/停步进入 `lantern_put_down_stand`；**进入同帧提灯层权重 1→0**（clip 第 0 帧 = idle_breathing_loop_lantern f0，右臂已在 clip 里）。
2. `lantern_settle` f26–33 升到 1，接触前灯身已竖直。
3. **t = 1.1333 s（f34）同帧**：把灯从 socket 解挂到场景节点，放在台面上（世界位姿 = 当前 lantern 根的世界位姿，再把 pitch/roll 清零、高度吸到台面 +0.1502 m；实测误差 ≤0.6°/0.3 mm）。
4. clip 结束 = `idle_breathing_loop` f0，可接 walk_start / 转身走向梯子。

## 程序摆（新，铰链式）见 `../INTEGRATE.md`
