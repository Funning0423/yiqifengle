# T8 包体审计（只出报告，不改工程文件）

- 分支 `work/GGbot-t8`，基于 near `41fabe7`。候选清单：`docs/T8-package-candidates.csv` / `.json`；纹理对比图：`docs/T8-assets/texture-compare.jpg`。
- **实际大小来源**：`evidence-mac/evidence/near/BUILD-RECEIPT.json`。这是 near 构建的逐文件清单（228 个文件，总计 30,762,977 B），按 uuid@子资源 id 对回源资源（.meta subMetas）。phase0 的总数是 30,762,652 B，两者只差 325 B。`mac-tests/` 里只有汇总数字，没有构建产物本身。
- 构建日志里写着 `Skip compress image`：现在**没有任何纹理压缩预设**，PNG/JPG 原样进包。

## 结论

| 档 | 内容 | 预计节省 |
|---|---|---|
| A 未使用资源（画面零变化） | C01 background_ground 整包 + C04 botanical-props + C14 两个 json | **约 4.50 MB** |
| B 导入设置（画面基本不变） | C02/C03 两个场景 glb 去掉切线 | 约 3.46 MB |
| 低风险子集（A + C02/C03 + C05/C09/C11/C18 无损感压缩） | 见 CSV 里 low_risk=1 | **约 9.32 MB** |
| 全部计入项（含待确认、中风险） | | 约 13.55 MB |

只做 A 档就能省约 4.5 MB，远超 2 MB 的目标；再加 B 档能到约 8 MB。

## 包体构成（near 构建）

| 分包 | 字节 | 主要内容 |
|---|---|---|
| region_island | 11,651,121 | mesh 8.20 MB、动画 1.83 MB、内嵌图 0.77 MB、打包 json 0.71 MB、json 0.14 MB |
| region_skycity | 8,705,717 | mesh 7.00 MB、打包 json 0.63 MB、内嵌图 0.56 MB、动画 0.51 MB |
| background_ground | 3,555,555 | painted-grass.png 一张（**没有任何运行时引用**） |
| background_foliage | 2,226,485 | painted-cloud.png 1.42 MB + botanical-props.png 0.81 MB（后者没用到） |
| 根目录 | 1,806,960 | cc.js 1.63 MB |
| resources | 1,464,079 | pieces.png 0.78 MB、bgm 0.38 MB、loading-reference.jpg 0.13 MB |
| main | 1,055,525 | game.js（脚本），其中 ResultChestGeometry 约 0.43 MB |
| internal | 297,535 | 内置资源 |

**为什么区域包比源文件大很多**：glb 源文件用的是 Draco 压缩（岛 5.0 MB、天空城 1.1 MB），但 Cocos 3.8 在**导入时就把 Draco 解开**，存成 float32 顶点（运行时不解 Draco）。而且切线是默认 Require 自动生成的。按顶点数反算每个 mesh 文件，结果都是整数：
- 静态 mesh：48 B/顶点 = 位置 12 + 法线 12 + UV 8 + **切线 16**
- 带顶点色：60 B/顶点
- 蒙皮：72 B/顶点；蒙皮带顶点色：84 B/顶点

三个 glb 的材质都没有 normalTexture，脚本和 effect 里也没有用 a_tangent 或法线贴图。所以切线现在是白占空间。

## 候选（按“节省/风险”排序）

| # | 项 | 当前 B | 预计省 B | 方法 | 风险 | 把握 |
|---|---|---|---|---|---|---|
| C01 | background_ground/painted-grass.png（整包） | 3,555,555 | 3,555,000 | 删除整个 bundle | 低（要同步改 tools 测试和哈希清单） | 高 |
| C02 | combined_visual_m.glb 切线 | 6,430,152（mesh） | 1,781,216 | Tangents=Exclude | 低~中 | 高 |
| C03 | env_skycity.glb 切线 | 7,003,674（mesh） | 1,680,912 | Tangents=Exclude | 低~中 | 高 |
| C04 | botanical-props.png | 807,554 | 807,554 | 删除 | 低 | 中高 |
| C05 | painted-cloud.png | 1,417,468 | 881,143 | pngquant（Q92） | 低 | 高 |
| C09 | 内嵌 env_window_views_1024 | 351,818 | 320,553 | PNG→JPG q88 | 低 | 高 |
| C11 | 内嵌 tex_sky_rock_strata_512 | 292,771 | 247,408 | PNG→JPG q88 | 低 | 高 |
| C14 | collision_proxies + anchors json | 135,332 | 135,332 | 移出 bundle | 低~中 | 中 |
| C18 | tools-original.png | 66,831 | 46,450 | pngquant | 低 | 高 |
| C06 | 岛 idle_loop 动画 | 1,458,232 | 约 650,000 | fps 30→15 | 低~中 | 中 |
| C13 | 内嵌 tex_sky_foliage_512 | 262,919 | 195,082 | pngquant | 低~中 | 高 |
| C12 | 机器人 3 段动画 | 396,072 | 约 180,000 | fps 30→15 | 低~中 | 中 |
| C08 | 两区域包各约 563 KB 的打包 json | 1,125,830 | 约 450,000 | 共用 effect 放进 resources | 低~中 | **低（要先看内容）** |
| C07 | pieces.png | 776,072 | 586,536 | pngquant（只能到 Q51） | **中** | 高 |
| C10 | ResultChestGeometry.ts | 430,541 | 约 260,000 | 改成 int16 二进制 | 中（改代码） | 中 |
| C15 | 场景 glb Mesh Compress Quantize | — | 约 1,500,000 | 导入设置 | 中~高 | 低 |
| C17 | 星环两个相同 mesh | 298,896 | 149,448 | 共用 mesh | 中（要改美术资源） | 中 |
| C16 | bgm_main.mp3 | 384,929 | 约 95,000 | 单声道 48 kbps | 低~中 | 中 |
| C19 | 两份相同的 engine.js | 45,173×2 | 约 20,000 | 共用一份 | 中 | 中 |
| C20 | 引擎模块 ui-skew | — | 约 10,000 | 关掉模块 | 低 | 低 |
| C21 | 临时角色 glb 切线（不计入合计） | 1,773,654 | 316,704 | Tangents=Exclude；**正式角色导入时直接用这个设置** | 低~中 | 高 |
| C22 | region_skycity 改远程包（只作提示，不计入） | 8,705,717 | — | 远程 bundle | 需要 CDN 和上传，团队现在做不了 | — |

每项的路径、uuid 和验证方法见 CSV/JSON。

## 分项说明

**未使用资源（A）**
- `background_ground`：全工程（scripts、scenes、prefabs、settings、build-templates）都没有 `loadBundle('background_ground')`、`painted-grass` 字符串或它的 uuid。只有 `tools/test_original_background.cjs`、`tools/integrated_3d_scope.json` 提到它。
- `botanical-props`：只有 `OriginalLevelEnvironment.surface()/paint()` 用 `world.botanical` 画它，但这个类没有被实例化；`OriginalLevelBackground` 只 import 了 `paintOcean*` 系列函数。
  - 同一个死代码里还有 `grassArt`，painted-grass 也是给它准备的。
  - 删之前请主程确认：没有计划恢复这个旧背景路径。
- 两个 json：RegionLoader 只 `loadDir('', Prefab)`；它们只在 FirstsliceFacts 的 sha256 核对表里出现。

**纹理**
- 已有的格式：
  - 两张大背景和 pieces 是 RGBA，约一半像素是半透明，所以不能转 JPG。
  - window_views 和 rock_strata 是不透明的，适合转 JPG。
  - 尺寸大多不是 2 的幂（1254²、1774×887、960×640）：不开 mipmap、不 repeat 的话没问题。
  - painted-grass 是 NPOT 却设了 repeat（WebGL1 下不能 repeat），这也说明它没被用到。
- 格式选择（WeChat，Cocos 3.8.8）：
  - ASTC/ETC2/PVR 是显存格式。在包里通常比 PNG/JPG 更大，还要带回退图，**对包体不利**，不建议为了包体用。
  - WebP 在微信 iOS 老版本上支持不稳，不建议。
  - 推荐：用 Cocos 纹理压缩预设里小游戏平台的 PNG(quality，内部用 pngquant) / JPG(quality)。这只改 meta、不动源图。也可以离线处理好再替换源图。
  - glb 内嵌图：要么重导 glb 时内嵌 JPEG，要么确认 gltf-embeded-image 能不能配压缩预设。
- 对比图：`docs/T8-assets/texture-compare.jpg`。painted-cloud Q92、两张 JPG 看不出差别；pieces Q51 细看高光有轻微色阶。

**网格**
- 运行时没有 Draco，Draco 只省源文件大小。去切线是最稳的一刀。
- Quantize/Encode 能再省很多，但 Encode/Compress 要开 meshopt 模块，在微信端的支持要单独验证，所以只列为待确认（C15，要在 C02/C03 之后算，两者有重叠）。
- 索引已经是 uint16，所有 mesh 都在 65535 顶点以内。
- 场景里没有用 LOD（lods.enable=false）。
- 重复的 mesh 很少：只有海鸥和烟各有几份几百字节的重复，以及星环那一对。

**动画**
- 关节轨道按导入 fps（30）逐帧烘焙，所以关键帧很少的片段也很大（robot_idle 每通道只有 2 个关键帧，却有 147 KB）。
- 降到 15 fps：STEP 关键帧时间最多偏 33 ms。

**重复资源**
- 源文件按内容哈希比对，只有两份相同的 engine.js 脚本，没有重复的图片或音频。
- 区域包之间有没有重复要看 C08：两个打包 json 大小几乎一样（562,892 / 562,938 B），像是各带了一份内置 effect。但看不到内容，所以“把握”标为低。

**音频**
- 音效都很小，加起来约 90 KB。
- BGM 48 s 为 385 KB。BGM v1（83.5 s）按同样规格接入会多约 0.28 MB，要提前算进预算。

**字体**
- 工程里没有字体资源（Label 都用系统字体），不涉及。

**引擎模块**
- 已经关掉的：物理（3D/2D）、粒子（3D/2D）、spine、龙骨、地形、tiledmap、视频、webview、rich-text、mask、meshopt。
- 能再关的只有 ui-skew（收益很小）。
- profiler 被 `profiler.hideStats()` 用到，不能直接关。
- cc.js 1.63 MB 基本就是 3D + UI + 骨骼动画的正常大小。

**远程包/分包规则**
- 微信小游戏：主包 ≤4 MB，主包加所有分包 ≤30 MB；远程资源不计入这 30 MB，但需要 CDN/云存储、合法域名和首次下载流程。
- 团队现在不能上传/发布，只作提示。
- 把资源从一个分包挪到另一个分包不会减少总大小。

## 已测 / 未测

- **已测（盒子上）**：
  - 逐文件构建大小对回源资源。
  - 解析 glb：顶点数、属性、Draco、材质、内嵌图、动画通道、关键帧网格。
  - 按每顶点字节数反算切线。
  - pngquant、optipng 和 PIL 的 JPG/WebP 实际压出的大小，并生成对比图。
  - 全工程字符串/uuid 引用搜索。
  - 源文件内容哈希去重。
  - 读引擎模块配置。
- **未测**：
  - 没有在 Mac 上按这些改法重新构建，所以除切线外，动画、C08、C15 的节省都是推算。
  - 所有画面变化都没有在真机上看过。
  - 微信端 meshopt/quantize 的运行时支持没有验证。
  - 构建产物里打包 json 的内容没有看到。
  - C01/C04 删除后 tools 测试需要同步更新，没有跑。
