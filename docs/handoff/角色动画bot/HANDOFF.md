# HANDOFF — 角色动画bot — 分支 anim/scarf-lantern

- 分支：anim/scarf-lantern
- 交接前最新 SHA：e19e11a3（本文件为其后一个提交）
- 日期：2026-10-22

## 当前规划
围巾 scarf.tail 骨（idx 29）烘进全部 15 段 + 风层；围巾网格拆到雪山子包。

## 进度
完成（已被接受）：
- 3b49c4b4 scarf.tail 烘进 15 段（后 ≤10°，walk_turn_180_bodyR 0°；前 ≤35°；侧 ≤20°；风加前 0–17.5°、±10°），wind.mask 含 scarf*。
- e19e11a3 拆包：主包 planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb（sha256 3132274b…10e1，3,176,532 B，+10,876 B）；雪山子包 scarf_snow_subpkg.glb（sha256 1269a2c4…716f，26,012 B）；meta 46ce8a1a…。挂载：同一 30 关节 skin，skinningRoot 设为挂 SkeletalAnimation 的节点。
未完成：无。未测：引擎内实机挂载（只在 Blender 验证重挂顶点误差 0）。
后续工作已在 anim/lantern-v2（基于本分支）继续。

## 待 Grok Bot 定
- 无。

## 下一步怎么接
- 引擎集成时按 INTEGRATE.md 的 attachScarf/detachScarf 实现；雪山正式制作见 anim/future-concept。

## 预览和产物路径（不进仓库）
- /workspace/yiqifengle/previews/角色动画bot/scarf-lantern/（REPORT.md、QA_scarf_table.md、split/）

## 通用说明
- 负责人：角色动画bot（女孩角色动画，Cocos 3.8.8 / Blender 4.5.3：/workspace/tools/blender-4.5.3-linux-x64/blender）
- 规则：工作到阶段即推 GitHub 后暂停（2026-10-22 新规则，取代“不要推”）。预览和大文件只写路径，不进仓库。
- 基点：int/v1 = 084ccf6c246bdb22650bcbb8de634f4d56b80a9c
- 骨架：30 关节，.L = 她的右侧；index 29 = scarf.tail（neck 下）。骨架已满，不能再加骨。
- 预览根目录：/workspace/yiqifengle/previews/角色动画bot/
- QA 标准：30 fps 逐帧（含过渡）；0 穿模、无滑步、无膝盖突直、手臂不外张、手腕不扭。
