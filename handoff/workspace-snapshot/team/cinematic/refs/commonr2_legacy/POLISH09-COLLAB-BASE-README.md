# POLISH09 可编辑协作基底 R1

这是已经完成导入、对齐与无编辑导回验证的协作基底。袖源网格精修尚未完成，模型仍有真实相交；未发布。请勿把它当作可直接交付的无穿插成品。

## 内容

打开 `POLISH09-B-REST-AND-NATURAL-R3-EDITABLE.blend`。采用 Blender 4.3.2 保存，真实图集已打包，不依赖外部纹理路径。场景内的 `START_HERE.txt` 说明四个集合：

- `01_EDIT_approved_B_rest`：认可 B 比例的真实运行时 rest 网格，可编辑骨架、网格与原权重。它已经包含袖口/双墙/腰连接等累积构建结果，不能假定与某份原 glTF 相同。
- `02_PREVIEW_native_LBS_chair_R3`：使用相同 rest 网格和精确游戏最终关节矩阵的原生 Blender 线性蒙皮预览，关闭 Preserve Volume。编辑 rest 会同步影响这个预览。
- `03_REFERENCE_actual_Game_chair_R3`：真实自然坐起 0.6 秒程序最终形态，不带 Armature modifier、不挂骨架父对象。不能再次蒙皮。
- `04_REFERENCE_frozen_outer_partial`：已经保留的一份左外袖局部修复研究参考，不代表肩域或全动作已通过。

11713 个源点、20373 个三角的顺序与稳定 ID 保留；UV 按原三角角点保存。源面来源记录已嵌入文本，属性/选择组标明独立 body-wall、sleeve-inner-wall、558 个 cuff pin、手/腕及程序参与点。衣料真实双墙没有合并。坐标只做 `[x,y,z] → [x,-z,y]` 转换，无缩放；模型单位没有被标为已标定人体长度。

## 精度与程序形态

原始 Double 高精度数据同时保存在 `runtime-editable-source.json.gz` 和 .blend 内的压缩源文本中。Blender 网格/UV/权重存储会量化：本次 rest/最终参考坐标误差不超过 5.96e-8，UV 不超过 2.98e-8，权重不超过 2.98e-8。原生 Blender LBS 对游戏 Double 蒙皮的最大坐标误差为 1.21e-6。详见 `IMPORT-ALIGNMENT-R1.json`，这些数值不等于整模型修复通过。

最终程序形态与纯 LBS 是不同对象。本姿势记录到：袖口材质 loft 写 93 点，BodySeams 写 512 点，衣物 BodyResponse 写 3082 点。最终参考对象的点属性保存总程序差分和这些分阶段差分。rest 已包含生成几何；仅修改权重不自动替代所有程序变形。

## 无编辑回环结果

导出工具将未改点、权重与 UV 恢复为源 Double 原值，避免整模型被无意义量化改写。无编辑回环中，rest/权重/UV/三角完全一致；游戏重建的 Double 最终位置、法线、骨架完全一致，实际上传的 733428 个 Float32 值逐字相同，也与真实 Room 抓帧哈希一致：

`37573f9f9c50150aadcde16d701c6114fdeb4cafbaaa4bb2d5a1a07336136832`

未修改的严格 C++ 检测器给出 752 → 752 对，新增/减少均为 0，pair/kind/detail 完全一致。这证明无编辑回环没有引入改动；原有 752 对接触仍然存在。详见 `ROUNDTRIP-UNEDITED-R1.json`、`GAME-ROUNDTRIP-R1.json`、`STRICT-ROUNDTRIP-R1.json`。

## 工具

在本目录执行：

```sh
blender -b POLISH09-B-REST-AND-NATURAL-R3-EDITABLE.blend --python export_editable_mesh.py
GAME_ROOT=/path/to/matching/game node check_game_roundtrip.cjs
AUDIT_LIBRARY=/path/to/original/validate_candidates.so python check_strict_roundtrip.py
```

Game 检查需要对应的游戏工程、Node 与该工程依赖；严格检测需要原版核库和 Python NumPy。这里没有更改检测口径。

如需取出嵌入图集和高精度源，再重建 01–03 集合：

```sh
blender -b POLISH09-B-REST-AND-NATURAL-R3-EDITABLE.blend --python extract_embedded_assets.py
blender -b --python build_editable_blend.py
```

保存精修工作时另存新 .blend，保留本文件作为已验证基底。当前导出工具只接收保持源点顺序与原三角映射的编辑；拓扑变更必须显式补充新增点和替代面来源。任何真实编辑都必须导回同一 Game，重新验证实际 UV、整域几何与实际镜头；Blender 预览不能替代这些检查。
