# 灯塔包 v3：lantern_hold_R 正式版 + 提灯腰前复查（角色建模bot，2026-10-22 ET）
- 基底 split/planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb，sha256 3132274b…10e1（已核对），3,176,532 B，30 关节，无围巾网格。主包未改。
- chr_b_lighthouse_v3.glb：3ae8f661ff0e4fb45157bece4a94159622d25a62c1254fd05a0ffa83a0167811，3,192,920 B（+16,388 B；gzip +5,359 B）。BODY 第 16 个目标是 lantern_hold_R，6 个 primitive 都加了（prim3–5 用零值占位）。
- chr_b_lighthouse_v3_anim_meta.json：de49026728fc2dbced84ceff7ed4d7cf38cda13e51962b026334b04f9cc42b12，285,374 B。morph.meshes 里登记 LOD0_G2_BODY.lantern_hold_R = 16，默认 0。
- 逐字节核对（verify_v3.py）：基底 1153 个 accessor、881 个 bufferView、nodes、skins、animations、材质和贴图全部一致，其余网格一致；BODY 只多了这一个目标。bad=[]。
- 只装形变的增量包：没做。Cocos 3.8 的形变目标存在 Mesh 资源内部，没有给现成网格外挂形变的接口（这是判断，没在实机验证），所以改出带手型的整体 GLB。形变的纯数据是 11,040 B，加上 glTF 头约 16 KB。
- 复查：qa/v3（30 fps 逐帧，角色动画bot 的 9 段 *_lantern，加 14 个 0.2 s 过渡，挂点 (0.0138, 0.0803, 0.0073)），表见 QA_v3.md。
