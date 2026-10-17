# audit-fixes 第三轮（基于 6bdbf5b）
HEAD a4a1041819699fee605643f2654df4dd0daaee71，tree 356e5d263db9e27599f9a447bb2eb5f85b9b1d7f。补丁打在 6bdbf5b 上；bundle 范围是 b0020ed..ggbot/audit-fixes-77b76c3。TREE_CHECK 已用 git am 和 bundle fetch 核对过。

## 提交列表（大小以源码资产净字节计，基线 19,100,765 B）
1. c843ba1 A1b 补丁：WindAudio 和 AmbienceAudio 改为防御式注册 ambienceMounters，并各自保留一份本地 [QF_AUDIO] 日志函数，Voice Bot 的 mock 测试又能加载了。+548 B
2. 24b30d1 A1c：户外风声、海浪声太小。
   - 根因：两条环境声床都直接乘了音乐滑杆的值（默认 0.4，约 −8 dB）。素材本身又比 bgm 母带轻（风 −22/−24 dB，浪 −19.8 dB，bgm −18.1 dB），bgm 只为风声避让了 −4 dB。叠在一起，环境声比 bgm 低了约 12 dB。
   - 修复：只改参数。环境声按 0.4 = 设计电平归一化：增益 = min(1, 滑杆/0.4) × 过渡值。静音和切后台的行为不变。
   - 新增 [QF_AUDIO] wind-level / waves-level 日志，每秒一条。
   - +1,508 B
3. 27acf22 N2：夜间旅程（93–120 s）里，草和最上面那层云（meadow_clouds_near，unlit 材质）还是白天的亮度。
   - 修复：
     - 草：shader 的夜色由 windParams.w 选择，旅程中 w=1，用世界夜间光照（lightScale 0.35 × 月光 [180,198,232] 转线性 = 0.16/0.20/0.28）。棋盘背景保持 w=0，外观不变。
     - 云：材质实例的 mainColor 跟随 uiNightWeight，夜间色用 env_cloud_layer 同款 [.22,.28,.43]。
   - 测试：tools/test_meadow_night_grade.cjs，已加入 suite。
   - +1,639 B
4. 0500567 + a4a1041 运镜bot 的玻璃牌 v4r32。两个补丁先核对了 SHA256SUMS，再用 git am -3 叠上来，没有冲突。和它们的 87c4c68 做 patch-id 对比，结果一致。没有使用旧的 50afbbc。
   - 源码资产 +17,329 / +156 B
   - web 包 +30,429 B（运镜bot 的数据）

## N1 说明
界面验收部说得对，夜空本来就是暗的，所以 N1 对天空本身基本是多余的。它不出问题、测试也通过，而且给草地加了夜间穹顶，所以保留。

## Suite
共 49 项，44 项通过。没通过的只有已知那几项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 失败，navigation-guard 是 BLOCKED。详见 suite.txt。

## 需要在 Mac 上验收
- A1c：户外风声、海浪声要能清楚地盖过 bgm，同时不刺耳。看 [QF_AUDIO] wind-level / waves-level 日志。静音和切后台都要正常。
- N2：夜间旅程中，草和最上面那层云要和其他夜间物体一样暗。白天和棋盘背景应该和以前一样。
- 玻璃牌（界面验收部）：
  - 放大看牌子边缘的抗锯齿；
  - 文字是粗体；
  - 叶子图标是 42px；
  - 关掉深度测试后，牌子没有错误地挡在别的东西前面。
