# 新用户静态坐姿实测入口

本独立场景 `creator-build-project/assets/scenes/StaticSeatedPreview.scene` 用于Cocos 3.8.8实际导入和静态场景实测。正常WorldR5Integration、默认构建入口和存档/关卡代码未改变。用户新模型无rig、蒙皮、morph或动画；人物与凳子是一个闭合壳。此入口没有起身/行走按钮，也没有把旧动画人物硬切为新人物。

## 资产

- 原始Drive文件: 1ir6QzXBwsSorFvgq9H5MG2jQp1Yf4CPF，28,809,508B SHA2564771351fb5e200a21cc4c03ab44ff6b9067237ef16b64568d255a47343adb942。
- 包内 actor/user_static_seated_2k.glb：7,925,240B SHA2566667393b50aa9876eb760af6f229c3a2a83ccc70729c4015b7beb5f9e920b478。只将3个嵌入PNG从4K确定性构建为2K，50,000三角/几何/UV/节点/材质因素逐字节不变。原始输入保留在Drive，完整近景差分与真机性能仍待验；不能宣称纹理压缩零质量损失。
- 包内room/room_no_original_chair.glb：5,306,012B SHA2568ae5efeb5f318b22411c0033f450b6de7a935fa3a27fb45d3f3cf240f88e2e42。从原房间1d9c4b56…派生，只将env_interior_props_merged中完整原椅512三角移除；其余primitive JSON/原BIN前缀/节点/材质/图像均不变。目标primitive从Draco解码后属性等原数据，保留原压缩其它几何。正式房间未替换。

## 空间合同

整个人+凳只做统一1.2倍缩放（也可显式reload(1)对照），yaw=-2rad，凳面拟合中心XZ对齐原seat_anchor(.4203000,-4.2133002)，最低鞋底放在原房间地面Y=.000126。原凳脚相对鞋底高3–4mm，1.2倍后保留3.9–4.9mm，未暗改输入压平。新凳面约.49254m高，不强压到旧椅.38m。源节点+90°X保持。

使用原homePoseEntry camera position(-1.32022071,1.38613379,-2.11374307)、target(.04,1.22,-4.45)、垂直FOV75和原RoomLightingRig。Blender几何预演不是Cocos导入/灯光/渲染证明。

## 隔离bundle导入

```sh
git clone --branch cloud/static-seat-intake-20261013 yiqifengle-static-seated-preview-20261013.bundle static-seat-test
cd static-seat-test
git rev-parse HEAD HEAD^{tree}
git fsck --full --strict
node tools/test_manifests.cjs
```

必须显式指定分支（bundle没有远程HEAD）；完整commit/tree以外部SOURCE-MANIFEST.json为准。所有核验后再打开新隔离项目。

## 本地测法

1. 新隔离项目导入，Creator自动导入新GLB并生成subMetas；本包故意不伪造未经编辑器生成的prefab UUID，运行按两个独立目录loadDir(Prefab)各取唯一prefab。记录编辑器实际导入日志及变化，不覆盖原测试项目。
2. 在Creator打开StaticSeatedPreview.scene并预览或将其设为本次隔离构建的唯一启动场景，正常发行构建入口不改。先用Web验证资源和画面，再在微信开发者工具真运行。所有步骤不得清存档或要求新权限。
3. 运行`globalThis.__staticSeatedPreview.snapshot()`，应state=ready且显示上述actor/room来源hash。声明的hash属于构建溯源，须另核实际构建文件，不能只相信运行字段。
4. 实际截图586×1266/390×844与横屏；核女主完整帽/脸/手/靴、自带凳、无旧椅重叠，鞋底地面、茶桌比例/原机位。截图记录实际commit、平台、引擎版本、DPR。
5. `await globalThis.__staticSeatedPreview.reload(1)`对照原比例，`reload(1.2)`恢复；连续重载/加载未完退出场景应无迟到挂载/重复人凳。30秒资源未就绪报错，可用reload显式重试，晚回调不污染新代次。无用户存储读写。
6. 记录加载耗时、纹理/绘制内存和帧率。2K三张RGBA8完整mip粗估64MiB，不是真机测量，禁止据此判设备性能过。

## 已执行/未验证

原输入六视图和2K q34快速实像已看，静态姿态自然；衔接、动态、整体造型验收不包含在本包。9个纯TS租约检查及13个实际Boot TS+node/asset/lighting替身检查通过；glTF源/派生数值与hash已核。真实Cocos导入、RoomLightingRig实渲染、微信资源加载和触屏设备均等待本地实测。材质扩展KHR_materials_specular是否受Cocos importer保留也须核，不自动截断原合法[2,2,2]因素。
