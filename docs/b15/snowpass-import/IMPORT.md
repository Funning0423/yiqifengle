# 雪山口灰盒：导入 Creator 3.8.8 前的整理（scene/b15-snowpass-import）
- 基于 fx/r5-snowpass-grey @11a59249。
- 文件结构：assets/bundles/region_snowpass/（bundle meta：isBundle、wx_subpackage、priority 1，与 skycity 一致）/models/SP_snowpass.glb(+.meta)。
- GLB：几何改为 KHR_draco_mesh_compression 压缩（16 位位置、12 位法线、14 位 UV），和 env_skycity / 云海使用同一种压缩扩展。
  - 大小：1,782,824 B → 134,060 B。
  - 不变的部分：节点 19 个，名字和层级不变（根节点 SP_snowpass，下有 SP_chime_tube_0..4、SP_stone_lantern_17..20 等）；34,604 面；单材质 M_LK_palette；内嵌 T_LK_palette_256（nearest）。
  - Blender 5.2.2 回读结果和原文件一致：18 个网格，34,604 面，包围盒 x −490..410 m、高 −3.6..233 m，Y-up，单位米，没有缩放，没有动画和蒙皮。
- glb.meta：保留 uuid 55d98240…，userData 补上 tangents、meshCompress、lods（和 skycity 一样）。subMetas 只能由 Mac 上的 Creator 3.8.8 首次导入时生成，导入后要提交生成的 .meta。
- 尚未接入 RegionLoader.REGIONS（这次没改代码）。接入时可以先写 `{bundle:'region_snowpass',prefabName:'SP_snowpass'}`，导入后再补 prefabUuid。
- 验证：
  - test_snowpass_grey PASS；test_manifests PASS；
  - run-suite 148 项里 145 项通过，0 FAIL，3 项 BLOCKED（浏览器 1 项，Node ≥22.6 2 项）；
  - 原文件 glTF-Validator 0 错误 0 警告。新文件的 Draco 内容 validator 不解码，改用 Blender 回读来验证。
- 没有在 Creator 里实际导入过：这台机器是 Linux，没有 Creator。Mac 盘快满了，这次没有在 Mac 上写入任何东西。

## b16 复查：除 SP_snowpass.glb 外还有没有要导入的模型（scene/b16-skycity-night，2026-10-22）
结论：**没有。fx/r5-snowpass-grey @11a59249 只有 SP_snowpass.glb 这一个模型需要导入**；碰撞体、LOD、远景、道具、天空都不是单独的资源，这次不需要再导入别的。依据：
- 分支内容：`git ls-tree 11a59249` 里 region_snowpass 下只有 `region_snowpass.meta`、`models.meta`、`models/SP_snowpass.glb(.meta)`。`git log --all -- region_snowpass*` 只有 3 个提交：dc0a7323（白模）、c41273ab（b15 Draco 压缩）、40b17b14（GGbot 补 subMetas），没有任何提交加过别的模型。11a59249 本身只加了 HANDOFF.md。
- GLB 内部：19 个节点（根节点 SP_snowpass + 18 个网格），包括 SP_ground、SP_gate、SP_mtn_near/mid/far、SP_steps、SP_rubble、SP_pines、SP_flags、SP_chime_tube_0..4、SP_stone_lantern_17..20。远景山、道具、铃管、灯笼都已经是这个 GLB 里的节点；没有 *_collider、*_LOD*、天空球这类节点。只有 1 个材质 M_LK_palette 和 1 张内嵌贴图 T_LK_palette_256，没有外部贴图。
- 设计文档和交接：
  - 场景特效bot 的 HANDOFF.md 只列了这一个 GLB。它的“未接”项是 Creator 导入、风铃运行时摆动、夜间灯光，都是代码或导入步骤，不是缺模型。
  - docs/r5/cine/snow_pass_transition_draft.md 明确写着“只是草案，不实现”。交通方式复用 transport_balloon.glb，需要新增的只是一个系泊点和一段航线（节点和数据，不是模型）。B2 的“换天空盒”属于转场实现阶段，现在没有天空资源要导入。
- 碰撞体：游戏里没有物理碰撞（脚本里没有 Collider 或 RigidBody，区域都是用锚点节点加路线数据），所以不需要碰撞体模型。
- 源文件和导出脚本：HANDOFF 里提到的 build.py、prev.py、COORDS.md、SP_snowpass_coords.json 在场景特效bot 自己机器的 previews/场景特效bot/r5/snowpass_grey/ 目录下，规定不进仓库，这台机器上找不到。它们是生成上面这个 GLB 的脚本和坐标表，本身不用导入。
- subMetas：GGbot 的 40b17b14（Mac 首次导入生成的 22 个 subMetas）已经合进 integration/build16（7d42967c）。
