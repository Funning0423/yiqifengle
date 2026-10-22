# 提灯 v2 接入（灯塔子包）

> **骨骼命名是镜像的**：后缀 `.L` 的骨 = 角色**自己的右侧**。本文所有 `upper_arm.L / forearm.L / hand.L` 都是她的**右臂**，也就是提灯的那只手；`.R` = 她的左侧（左臂照常摆）。与 anim_meta 的 `side_convention` 一致（bodyL/bodyR = 她真实的左右）。

## 已定（Grok Bot 决定）
- `lantern_hold_R` 手型放**灯塔包**，不放主包。
- 转身时前臂下倾 21° 已接受（自然惯性）。

## 资源
- `lighthouse_lantern_arm_v2.glb`：9 个 clip，`<基础名>_lantern`，例如 walk_loop_lantern。每个只有 upper_arm.L、forearm.L、hand.L 三个旋转通道，时长与同名基础 clip 相同。
- 灯模型：`prop_lantern_v2.glb`（角色建模bot），挂在 hand.L 下的 `socket.lantern` 节点上，local (0.0138, 0.0803, 0.0073)。

## 播放
1. CharacterMotion 新增一层“提灯层”：
   - 遮罩只含 upper_arm.L、forearm.L、hand.L（她的右臂）；
   - override 模式，提灯时权重 1，不提灯时 0。
   - 风层遮罩不含手臂，两层互不影响。
2. 提灯层播放与基础层同名的 `_lantern` clip，**时间与基础层同步**（相同 normalized time）。基础层 crossfade 时，提灯层用同样的时长（0.2 s）同步 crossfade。
3. 进入或退出提灯（拿起、放下灯）：见 `pickup/REPORT.md`（lantern_pick_up 样本；取灯期间提灯层权重 0，clip 结束切 1）。lantern_put_down 与梯边版尚未制作。

## 灯的程序摆（socket.lantern 下的子节点 lantern_pivot，每帧在 lateUpdate 里更新）
- 支点 p = socket.lantern 的世界坐标；u = 摆锤相对支点的水平位移（世界 XZ 两维）。
- 每帧：
  - v = (p − p_prev)/dt；a_raw = (v − v_prev)/dt；
  - a = a + (a_raw − a)·0.35（一阶低通）；
  - 第一帧只记 p，第二帧只记 v，不积分。
- 积分 10 个子步：u'' = −ω²·u − 2ζω·u' − a，其中 ω = √(9.81/L)，L = 0.098 m，ζ = 0.8。
- 显示角：θ = asin(|u|/L)，θs = 8°·tanh(θ/8°)。灯的朝下方向 = normalize(u_dir·L·sinθs, −L·cosθs)。
- lantern_pivot 的世界旋转 = 从 −Y 转到该方向的最小旋转 × 绕世界 Y 跟随角色朝向（hips 前向）的偏航。
- 灯不受风层影响（风只传强度；需要时可在 a 里加上风的力，但这次没测）。
- 实测摆角：走路 ≤4.6°，转身和停步 ≤8°。压力测试（每帧固定 8° 倒向身体）不穿模，最小间隙 18 mm。

## 需要实机验证
1. 遮罩层同步、crossfade 同步。
2. 程序摆的帧率无关性：30 和 60 fps 下摆角一致。
3. 灯与手握把的视觉。
4. 子包加载后 clip 绑定到主包骨骼（节点路径 B_SINGLE_WORLD_ROOT_SOURCE_K/R5G2_RIG_22P4/root/hips/spine/chest/upper_arm.L/…）。
5. 基础 clip 切换时，提灯层权重保持为 1，不闪。
