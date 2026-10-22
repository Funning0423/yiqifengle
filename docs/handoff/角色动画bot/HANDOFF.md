# HANDOFF — 角色动画bot — 分支 anim/b15-getout-stepdown

- 分支：anim/b15-getout-stepdown
- 交接前最新 SHA：3c5025af（本文件为其后一个提交）
- 日期：2026-10-22

## 当前规划
下篮下台阶起步 walk_start_stepdown（场景特效bot 底板 333f0b15）。

## 进度
完成（已被接受）：3c5025af 新片段 walk_start_stepdown 1.733 s，根 Y 0.602→0.572，下台阶点 P0+0.36 m，停步 warp 0.979；篮/叶×身体/布 0；INTEGRATE.md 已更新。未完成：无。
注意：湖畔实测地形与 0.572 有约 3 mm 差，驱动改按实测地形待 Grok Bot 定（见 anim/lantern-v2 HANDOFF）。

## 待 Grok Bot 定
- 起步段根节点高度不写死 0.572，改按实测地形（属于驱动代码）。

## 下一步怎么接
- 无需继续；已合并进 anim/b15-stepdown-merge。

## 预览和产物路径（不进仓库）
- /workspace/yiqifengle/previews/角色动画bot/b15-balloon/stepdown/

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3：/workspace/tools/blender-4.5.3-linux-x64/blender）
- 规则：工作到阶段即推 GitHub 后暂停（2026-10-22 新规则，取代“不要推”）。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- 骨架：30 关节，.L = 她的右侧；index 29 = scarf.tail（neck 下）。骨架已满，不能再加骨。
- 预览根目录：/workspace/yiqifengle/previews/角色动画bot/
- QA 标准：30 fps 逐帧（含过渡）；0 穿模、无滑步、无膝盖突直、手臂不外张、手腕不扭。
