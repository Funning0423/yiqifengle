# HANDOFF — 角色动画bot — 分支 anim/future-concept

- 分支：anim/future-concept
- 交接前最新 SHA：2e053de5（本文件为其后一个提交）
- 日期：2026-10-22

## 当前规划
未来场景：滑翔（独立子包，雪山→灯塔途中加载、终章复用）与雪山行走（顺风 tail / 逆风 head）。

## 进度
完成（概念已被接受）：
- 70c0df82 未来场景 PLAN.md + 滑翔概念 blocking（glide_concept.mp4）。
- 2e053de5 PM 决定写入 PLAN（风字段、拆包、lantern_pick_up）+ 雪山行走 blocking：tail 1.27 s / 0.727 m/s；head 1.53 s / 0.554 m/s、前倾 14°。
未完成：正式制作（需含围巾、风层、挡风手势、逐帧网格 QA）。未测：网格穿模 QA（blocking 阶段未做）。

## 待办
- 等 场景特效bot 的雪山灰模后开始正式制作。

## 待 Grok Bot 定
- 无。

## 下一步怎么接
- 拿到灰模后在本分支（或基于 anim/lantern-v2 新分支，以便带上围巾/提灯最新包）做正式片段，按 30 fps 逐帧 QA。

## 预览和产物路径（不进仓库）
- /workspace/yiqifengle/previews/角色动画bot/future-scenes/（PLAN.md、glide_concept.mp4/.blend、snow/snow_walk_tail.mp4、snow/snow_walk_head.mp4）

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3：/workspace/tools/blender-4.5.3-linux-x64/blender）
- 规则：工作到阶段即推 GitHub 后暂停（2026-10-22 新规则，取代“不要推”）。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- 骨架：30 关节，.L = 她的右侧；index 29 = scarf.tail（neck 下）。骨架已满，不能再加骨。
- 预览根目录：/workspace/yiqifengle/previews/角色动画bot/
- QA 标准：30 fps 逐帧（含过渡）；0 穿模、无滑步、无膝盖突直、手臂不外张、手腕不扭。
