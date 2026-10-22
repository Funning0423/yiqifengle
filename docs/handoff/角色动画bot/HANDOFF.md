# HANDOFF — 角色动画bot — 分支 anim/b15-balloon-getout

- 分支：anim/b15-balloon-getout
- 交接前最新 SHA：bab2dab3（本文件为其后一个提交）
- 日期：2026-10-22

## 当前规划
热气球下篮出门（getout）。

## 进度
完成：ee7438e8 候选1（失败，篮沿穿模）→ e709e651 v2 → c15e5964 v3（真门 GLB 24008c3c）→ bab2dab3 v3b（门 b69faa60 验证，最后 2 m 地面 0.572→0.58，0 穿模）。未完成：无。后续在 anim/b15-basket-standup。

## 待 Grok Bot 定
- 无。

## 下一步怎么接
- 无需继续。

## 预览和产物路径（不进仓库）
- /workspace/yiqifengle/previews/角色动画bot/b15-balloon/（getout/、getout_v2/、getout_v3/、door/、REPORT.md）

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3：/workspace/tools/blender-4.5.3-linux-x64/blender）
- 规则：工作到阶段即推 GitHub 后暂停（2026-10-22 新规则，取代“不要推”）。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- 骨架：30 关节，.L = 她的右侧；index 29 = scarf.tail（neck 下）。骨架已满，不能再加骨。
- 预览根目录：/workspace/yiqifengle/previews/角色动画bot/
- QA 标准：30 fps 逐帧（含过渡）；0 穿模、无滑步、无膝盖突直、手臂不外张、手腕不扭。
