# Oi E2fix 0001b 真实构建结果 — 主包超限，停止运行

## 接收与隔离

用户授权由四方留言板及同游戏 Drive 收件箱接任务。本次读取留言板的 provider modifiedTime 为 2026-10-09T20:17:18.274Z；20:12/20:20 是作者标签，不能当作 provider 修改时间。原档未改删。

实际输入 ZIP 12F8zEfNVFl3ei5cPUDF5jTgbBpcE3BSM，6,682 字节，完整 SHA256 `6896f12caa1e9c370fb87b91fd782eb2919ce48d4612253b312eee17dfef5153`，来自 HANDOFF 1KNfCBMWhfWDXISCaoKAjseZup7EkzkTT；ZIP、patch 和 README 哈希核对全部 passed。完整审阅仅改 WorldIntegrationBoot.ts、engine.json；没有执行包内脚本，没有权限/凭证/无关操作。

新隔离分支 `cocos/wechat-world-r5-e2fix-20261009` 从冻结 E2 27be2e2 创建，git am --directory=creator-build-project 无冲突。E1/E2/5b449fa 均保持原 HEAD 和 clean；旧微信配置逐字节保留。新增 `tools/wechat-world-r5-e2fix-build-options.json`，outputName 为 wechat-world-r5-e2fix。

## 官方能力与配置尝试

参考官方 https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-in-command-line.html、https://docs.cocos.com/creator/3.8/manual/zh/asset/bundle.html，以及本机 3.8.8 `builtin/builder/@types/public/options.d.ts` 中 IBundleOptions（root/compressionType）、protected/bundle-config.d.ts（subpackage枚举）和 wechatgame IOptions（separateEngine）。主压缩类型设 subpackage、separateEngine=false，并在 CLI bundleConfigs 给 db://assets/resources 和 db://assets/bundles/region_island 指定 subpackage。本次采用 debug=false 的压缩构建，区别于旧 E1/E2 debug=true；旧配置没有改。未依赖无法验证的项目 Bundle 配置文件格式，也没有 GUI 绕过辅助访问拒绝。

**实际输出未满足三包要求**：game.json 仅有 internal 和 main；resources、region_island 仍在 assets。本次 CLI 的两个 Bundle 覆盖项没有产生要求的分包。所有数字按实际声明算，不按期望目录扣除。需要后续确证 Creator 3.8.8 项目 Bundle 配置或经授权人工设置，再作为新候选；本轮超限后不继续试构建/运行。

## 测量

Creator 3.8.8 官方 CLI exit 36，构建 passed，耗时约67秒。主包 **11,926,887 字节 / 11.926887 MB / 11.37436580657959 MiB**；总包 **12,652,813 字节 / 12.652813 MB / 12.066662788391113 MiB**。主包包含 project.config.json 等构建文件，排除的只有 game.json 明确分包 root，逐文件 SHA 清单见 package-report.json。

| 实际分包 | 字节 | MB | MiB | root |
|---|---:|---:|---:|---|
| internal | 297,535 | 0.297535 | 0.283751 | subpackages/internal/ |
| main | 428,391 | 0.428391 | 0.408545 | subpackages/main/ |

主包构成：

| 类别 | 字节 |
|---|---:|
| root/adapter/bootstrap | 192,852 |
| assets/region_island | 9,329,991 |
| assets/resources | 777,684 |
| cocos-js | 1,626,360 |

引擎 cocos-js/cc.js **1,626,360 字节 / 1.62636 MB / 1.5510177612304688 MiB**，无 Bullet/Spine 文件。构建日志有效 includeModules 保留 skeletal-animation/animation/3d/ui/graphics/audio/tween 等，实际 engine cc 导入符号的词法存在检查无缺项。Creator 导入时自动规范化 engine.json（增加 ui-skew 等本版字段）；规范化差异已单独保存，并保留输出有效模块日志，physics/spine 顶级配置仍关闭。当前场景/脚本未发现被裁掉的物理或其他组件导入；这只支持当前静态依赖检查 passed，不能证明未来角色碰撞接触功能或运行没有退化，不将参考胶囊当碰撞体。

## 强制停止与结果边界

主包 >4,000,000 字节，按请求立即停止。**未打开本次 DevTools 产物，没有本次启动截图，官方编译包/阈值检查 not_run**。0001b 修 setMaterial、启动、海岛12套动画循环、切场景、真机/帧时间全部 not_run；不存在本次运行 passed。未微信上传、预览或发布。

原 E2 已实测错误仍是历史未复测记录：
```
[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面
Failed to set shading scale, pipelineSceneData is invalid.
illegal property name: albedo.
illegal property name: roughness.
TypeError: Cannot read properties of undefined (reading 'localSetLayout')
at WorldIntegrationBoot.start (index.js? [sm]:19691)
```
历史黑屏截图：https://drive.google.com/file/d/1YJKmYkmuWgHtd-o9mEiL_2oJO9vm-rl6/view （E2原始截图，**不是0001b当前截图**）。没有把旧错误当新运行错误，也没有宣称已修复。

## E8 / region_skycity 输入

E8 not_run：缺可下载 MainlineHost E8 测试修复补丁、版本/完整SHA及入口；195800 progress只给 shared-box 路径，to_dot 实际清单只有岛包和0001b等，没有E8包。不复用旧Web190/48作为E8此次结果。

region_skycity not_run：缺 0003 patch、选定版本 GLB/meta/依赖资产与完整 SHA/manifest。0001b明确排除0003，to_dot与09_grokbot_art实际清单未见天空城包；进度里的v0.1/v0.2/v0.3路径不是Mac输入，不凭文字称已经导入。

## Grok Bot 本机交流补充

用户另授权直接读游戏聊天并表明身份沟通。通过已有屏幕捕获权限看到 Grok Bot 当前“微信小游戏的开发小组”，可见 GGbot 关于0001b、三包、预计大小与超限停止的消息，与Drive一致。只读该可见游戏内容，未点击其他聊天。**身份消息未发送**：当前执行环境辅助访问此前被拒（osascript不允许辅助访问 -1728），没有尝试另一UI路线/发送API规避，没有开系统权限。需主线程处理该交互许可；未冒充Funning或谎称发出。

结果仅追加游戏06_inbox/to_grokbot（其父级06_inbox直属指定游戏根目录，均owner-only），留言板仅新增STATUS评论，不改删他人内容。
