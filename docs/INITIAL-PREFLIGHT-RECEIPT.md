# 本机 Cocos 集成准备回执

2026-10-09。仅在本目录工作，未修改旧固定视角、运镜工程，未上传微信或发布。此目录是待导入工程源码，尚非经过 Creator 打开的可运行工程；未生成 .scene/.meta/.prefab，没有伪造导入结果。

最新接入优先项：主线程后续提供的DOT-FIRSTSLICE-SCENES-v0.1小包已经正规接收，6,134,540字节，SHA256 d9face94fe0b82ecad6da9fde606684d3ef46d63e5a3812b59afb2db246b548d；24个manifest条目全通过。combined_visual_m.glb与anchors/collision sidecar已复制到creator-project/assets/firstslice。它是室内外合并米制候选，首次引擎导入只实例化它一次，**不要同时实例化assets/preflight内旧室内诊断GLB**。本机静态确认scene_root、seat_back、door_handle半径.07元数据存在，col/preview/ship=false没有mesh渲染引用，14室内代理描述存在；前述旧包缺口在本候选中已有静态修订。外部8组碰撞源保存在解包目录，存在分离形体，不可整组/整岛一凸包。资产声明与本机静态核验不扩展为Cocos导入、碰撞接触或手机通过。

## 环境与工具

- MacBook Air Mac16,12，Apple M4（10 CPU / 8 GPU），16GB，arm64，macOS 27.0.1 (26A434)。初次可用空间约16GiB。
- Node 24.14.0、Python 3.9.6、Git 2.53.0。
- 已安装微信开发者工具：产品版本 **2.02.2608080**（app.asar.unpacked/package.json）；Info.plist 的36.6.0是容器版本，不当作产品版本。未打开或抢占其旧工程，基础库尚未选择。
- 原本未在 /Applications、~/Applications 或用户目录最大5层搜索中发现 Cocos/Blender；不能断言搜索范围以外不存在。
- Cocos 官方3.8.8候选ZIP已接收并解包在 tooling/creator-3.8.8。Info.plist为3.8.8，最低macOS10.15；主程序同时含arm64/x86_64。ZIP大小1,181,883,559字节，展开约4.30GB。未启动、激活、登录、编译、锁定版本。
- 官方 Blender 4.5 目录明确列出4.5.14 Apple Silicon安装包。本机未安装，未下载/启动；4.5.14仍为旁路兼容候选。

## 已落实

Google Drive连接器正规读取了指定执行方案、资产契约、A–F交接和静态勘误。室内ZIP通过连接器签发的临时文件传输接收，19,506,119字节、SHA256 e48534a69128eeb5a66595a43bd511eb63a476c70d8c0ef978c3025063e76726；manifest中198文件全部大小及SHA一致。

tools/asset_preflight.py生成独立米制GLB候选，移除14个col_*节点与1个preview/ship=false节点的mesh引用，不缩放角色或场景。原GLB和全部源文件保留。候选保留binary、meshes、skins、animations、所有节点变换与层级；原collision mesh索引记录在sidecar，真正的Cocos Collider仍未建立，**不得把该候选称作碰撞已接入或直接用于最终交付**。

资产实查111节点、5 skins、仅环境idle_loop。B角色/坐起/门动作仍缺；scene_root、seat_back语义仍缺；门把半径冲突仍待资产负责人修订。门轴+X、外侧+Z及镜头角色右侧作为接入约束，尚无运行验证。

assets/scripts/FrameWindow.ts是有界原始帧间隔采样窗口（120000样本），RuntimeProbe.ts是Cocos组件接入稿，处理前后台断点，GPU/主线程工作时间/温度未测值保持null。其Cocos编译和运行尚未验证。必须在实际主场景根节点启用组件，并记录真实构建/资产SHA/设备/微信/基础库/画质/网络/测试时长；采样组件只导出JSON，不写旧存档、不上传。

VisualEpoch.ts只管理视图回调代次。它不是ChallengeController，也不写业务存档。R4接入流程是controller previewAction→commitAction→视图action/clear/drop→finishVisualStep。退出、重试、恢复或换局时invalidate；业务一次性令牌和存档重放以R4源码为准。新active key forest-challenges-c01-active v1仅作接口说明，未写入；旧forest-v33-journey v3和历史键未碰。动作世界位移只能由角色controller提供；动画必须原地，root trajectory仅供参考。坐姿过滤仅限移动胶囊与椅，不停用手/裙/围裙接触。

AssetVisibility.ts提供运行时renderer关闭接入稿，保留节点/collider，避免把extras当成自动导入规则；Cocos端待编译验证。草甸EXT_mesh_gpu_instancing为extensionsUsed，不在extensionsRequired，不支持时仍可能丢实例；COLOR_0/_ROOT_COLOR/_DRIFT也需专门适配。草甸/外景候选等待场景代理，不在本机重复制作。

## 可执行验证

在本目录执行：

```sh
python3 tools/asset_preflight.py inputs/interior-v2.1.0/GROKBOT-ART-001-INTERIOR-v2.1.0 creator-project/assets/preflight
node --test tests/preflight.test.mjs
python3 tests/asset_preflight_test.py
```

当前3个Node测试与1个Python测试通过：窗口环绕与停顿、后台断点、陈旧/重复回调、真实资产候选二进制/骨架/变换一致与15个渲染引用排除。属于静态/脚本测试，不是Cocos运行、视觉或手机性能证据。Node原生TS测试未编译含cc/decorator的组件。

## 主线程需要处理的门槛与交接

包内EDITOR_license_and_terms_zh.txt第1.1条把下载/安装/复制/使用视为接受；第3.1条要求注册登录。我在下载解包后才发现该协议，前置核查顺序错误。未点击接受或登录，已停止启动编辑器及使用其包内开发工具。请主线程先处理用户对该协议和Cocos账号登录的明确决定。tooling保留为隔离、未启用的包，不复制到/Applications。

后续还需正规交接：B角色冻结GLB/动作/参考root轨迹与接触事件、B量尺；场景代理最新房间门椅/外景候选及manifest/锚点；R4源码+精确API签名/存档样本/测试夹具；旧R2/R6权威归档完整SHA和固定/运镜版本索引。已找到的本地旧目录不自动视为最新云端基线。主线程也需指定中端Android型号和两台可测设备。

协议/账号门槛解除后，第一段引擎验证是以3.8.8候选新建独立3D模板→加入采样组件→导入米制房间与门椅→确认15个非渲染代理/辅助面、蒙皮bounds和idle动画→本地web预览→仅生成微信小游戏构建并校验AppID wx3bdd911c5c06f591。基础库、空工程真机与首资产运行后才锁patch。上传/发布不在本次授权范围；周年小程序不操作。G0–G3未通过前不迁全游戏，也不承诺手机60fps或发热修复。

官方依据：[Cocos3.8.8版本列表](https://creator-api.cocos.com/api/cocoshub/editor_version_list?lang=zh&ver=2.3.2)、[官方Dashboard登录说明](https://docs.cocos.com/creator/3.8/manual/en/getting-started/dashboard/index.html)、[Blender4.5官方目录](https://download.blender.org/release/Blender4.5/)、[Blender要求](https://www.blender.org/download/requirements/)。本机协议确切内容以隔离包内engine/licenses文件为准。
