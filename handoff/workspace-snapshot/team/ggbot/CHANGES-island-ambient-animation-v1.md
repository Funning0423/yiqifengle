# 改动说明：海岛环境动画循环播放（GGbot，2026-10-09）

补丁：`patches/0002-island-ambient-animation-…patch`，基于 0001，在同一工作副本 `work/ggbot-island-bundle/` 上，原工程未改。

## 现状
`combined_visual_m.glb` 有 12 套骨骼（猫、吊植物、窗风、小物、船模、3 棵椰树、海鸥、螃蟹、奶牛猫、海龟），只有一段 clip `idle_loop`（12 秒，30 fps，225 条通道，meta 里设了循环，UUID `498b3fa5-…@f2bf2`）。工程脚本和场景里都没有播放它的代码。

## 改了什么
1. 新增 `assets/scripts/region/RegionAmbientAnimation.ts`（带 .meta），这是通用组件，以后草甸、天空之城也能用：
   - 用 glTF 预制体自带的 SkeletalAnimation，如果没有就加一个；预制体里没有 clip 时，按 `clipUuids` 从已加载的 bundle 里取。
   - `clipNames` 为空时播放全部 clip，否则只播指定的那几个；**多个 clip 同时循环播放**，每个都是独立的 AnimationState，设为 Loop。
   - 只有一个 clip 时保留烘焙动画模式（最省性能）；同时播多个时自动切到实时模式，因为一个组件上同时跑多个烘焙状态不可靠。
   - 设置了 `playOnLoad` 和 `defaultClip`；`randomizeStart` 可以把各 clip 的起始时间打散；`diagnostics()` 给测试脚本用。
2. `world-r1/WorldFlowComponent.ts` 改了一行：实例化海岛模型后挂上 `RegionAmbientAnimation`，`clipUuids` 填 `idle_loop` 的 UUID。

## 海岛 v2.2 怎么接（@Grok Bot）
- 每段动画拆成独立命名的 clip（建议 `anim_<对象>_idle`，例如 `anim_crab_01_idle`），每个 clip 只驱动自己那套骨骼的节点，不同 clip 之间不要动同一个节点。
- 两种接法，合入前选定：
  - A（改动最小）：全部 clip 挂在模型根节点的同一个组件上，组件同时播放，代价是要用实时模式。
  - B（性能更好，推荐）：每套骨骼的根节点上各挂一个 `RegionAmbientAnimation`，各自只放一个 clip，这样可以保留烘焙模式。这要求 GLB 里每套 rig 有自己的父节点，并且 clip 的通道路径从那个节点算起。
- 导入后在 GLB 的 meta 里把每个 clip 的 wrapMode 设为 Loop。

## 需要 Oi 在 Cocos 里确认（not_run）
- 进入海岛后 12 套动画都在动，而且是循环播放；切换场景、隐藏或显示后不报错。
- 确认 glTF 预制体自带的 SkeletalAnimation 有没有带上 `idle_loop`（两种情况代码都能处理）。
- 性能：E6 的帧时间不要比静止版明显变差。
- 只做过 TypeScript 语法检查，没有在 Cocos 里运行过。
