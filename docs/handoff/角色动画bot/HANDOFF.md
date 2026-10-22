# HANDOFF — 角色动画bot — 分支 anim/b15-basket-standup

- 分支：anim/b15-basket-standup
- 交接前最新 SHA：968be1d1（本文件为其后一个提交）
- 日期：2026-10-22

## 当前规划
热气球篮内起身：sit_hold → stand_up（1.2667 s）→ idle → getout v3b。

## 进度
完成（已被接受）：968be1d1 座位 basket-local (0.032,-0.1,-0.099)，朝门；飞行中朝门，无转身；篮×身体/布 0；起身滑动 ≤1.24 mm/帧。未完成：RegionJourneyAdapter 改动由 Grok Bot 负责。

## 待 Grok Bot 定
- 无（RegionJourneyAdapter 由 Grok Bot 改）。

## 下一步怎么接
- 无需继续；后续在 anim/b15-getout-stepdown。

## 预览和产物路径（不进仓库）
- /workspace/yiqifengle/previews/角色动画bot/b15-balloon/standup/

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3：/workspace/tools/blender-4.5.3-linux-x64/blender）
- 规则：工作到阶段即推 GitHub 后暂停（2026-10-22 新规则，取代“不要推”）。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- 骨架：30 关节，.L = 她的右侧；index 29 = scarf.tail（neck 下）。骨架已满，不能再加骨。
- 预览根目录：/workspace/yiqifengle/previews/角色动画bot/
- QA 标准：30 fps 逐帧（含过渡）；0 穿模、无滑步、无膝盖突直、手臂不外张、手腕不扭。
