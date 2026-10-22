# HANDOFF — 角色动画bot — 分支 anim/planA-verify

- 分支：anim/planA-verify
- 交接前最新 SHA：e0f065e2（本文件为其后一个提交）
- 日期：2026-10-22

## 当前规划
r5 坐姿布料 Plan B cand3b + 丝带/风（ribbonwind 系列）验证。

## 进度
完成：9603ec8e…e0f065e2，planB cand3b ribbonwind4b 重打包（去孤立数据，解码数据与 ribbonwind4 相同）；风只向外作用于 skirt.back/back.low；拉伸 ≤2.46%。未完成：无。该成果已成为 anim/b15-* 的基础包。

## 待 Grok Bot 定
- 无。

## 下一步怎么接
- 无需继续。

## 预览和产物路径（不进仓库）
- /workspace/yiqifengle/previews/角色动画bot/planA-verify/、/workspace/yiqifengle/previews/角色动画bot/planB-verify/

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3：/workspace/tools/blender-4.5.3-linux-x64/blender）
- 规则：工作到阶段即推 GitHub 后暂停（2026-10-22 新规则，取代“不要推”）。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- 骨架：30 关节，.L = 她的右侧；index 29 = scarf.tail（neck 下）。骨架已满，不能再加骨。
- 预览根目录：/workspace/yiqifengle/previews/角色动画bot/
- QA 标准：30 fps 逐帧（含过渡）；0 穿模、无滑步、无膝盖突直、手臂不外张、手腕不扭。
