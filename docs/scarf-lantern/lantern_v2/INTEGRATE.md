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
3. 进入或退出提灯（拿起、放下灯）：见 `pickup/REPORT.md`（lantern_pick_up 样本；取灯期间提灯层权重 0，clip 结束切 1）。高台版取放灯见 `stand/REPORT.md`、`stand/INTEGRATE.md`（lantern_pick_up_stand / lantern_put_down_stand）；地面版样本作废、不进包。

## 灯的程序摆（v3，铰链式；替换旧的"世界下垂"钟摆）
起因：角色建模bot 查到手指穿握把的原因是旧 lantern_pivot 按世界方向下垂，手一转握把就相对手掌转（关掉手型也穿 5.5–5.8 mm）。
- **握把**（lantern 网格里 z > −6 mm 的握把部分，20 tris）**刚性挂在 socket.lantern 下**，局部位姿恒为单位 → 握把相对手掌转动 = 0（QA 全部帧实测 0.0000°）。
- **socket.lantern 需要一个固定局部旋转**（否则在 9 段提灯 clip 里灯整体歪 38–47°）：相对 hand.L 的局部四元数 xyzw = (−0.78587, 0.05101, 0.18423, 0.58811)（= 旧模式下灯相对手的平均方向，相对旧 socket 帧再转 43.08°，旧帧中轴 (0.3636, 0, −0.0507)）。由角色建模bot 写进 socket 节点。
- **灯身**（提环以下：灯框、玻璃、灯芯）挂在子节点 lantern_hinge 下，lantern_hinge 位于握把中心（挂点不变），只绕握把轴（lantern 局部 −Z，glTF）转一个角 θ：
  - 每帧：a = 握把轴世界方向，d0 = 握把帧的"下"（−Y）世界方向，t0 = a × d0；
  - 框架转角 dψ = d0_prev→d0 绕 a 的有符号角；θ −= dψ（灯身惯性保持世界朝向）；
  - 支点加速度同旧版：v = Δp/dt，a_raw = Δv/dt，一阶低通 0.35，第 1 帧只记 p、第 2 帧只记 v；首帧 θ = 重力平衡角；
  - 10 子步积分：θ'' = ((g − a_pivot)·(a × d(θ)))/L − 2ζω·θ'，d(θ) = cosθ·d0 + sinθ·t0，g = (0,−9.81,0)，L = 0.098 m，ζ = 0.8，ω = √(9.81/L)；
  - 显示角 θs = 8°·tanh(θ/8°)；lantern_hinge 局部旋转 = 绕握把轴 θs；
  - `lantern_settle` 曲线值 k∈[0,1]（取放灯 clip 提供；其余 clip 为 0）：θ ← θ·(1−k)，θ' ← θ'·(1−k)，显示角同样乘 (1−k)。
- 9 段提灯 clip 新摆法重跑（`qa_hinge/`）：1618 帧（含 14 段 crossfade、最大风两相位）穿插 0，灯-布料最小间隙 39.0 mm；压力测试（每帧 ±8° 取靠身体一侧）0，最小 25.8 mm；摆角 ≤8°；灯身相对竖直最大 11.1°（转身时随手腕）。
- 灯不受风层影响（同前）。

## 需要实机验证
1. 遮罩层同步、crossfade 同步。
2. 程序摆（铰链式）的帧率无关性：30 和 60 fps 下摆角一致；lantern_settle 曲线生效。
3. 灯与手握把的视觉。
4. 子包加载后 clip 绑定到主包骨骼（节点路径 B_SINGLE_WORLD_ROOT_SOURCE_K/R5G2_RIG_22P4/root/hips/spine/chest/upper_arm.L/…）。
5. 基础 clip 切换时，提灯层权重保持为 1，不闪。
