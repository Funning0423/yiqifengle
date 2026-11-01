# 本轮本地最小修复交接

独立目录：`/Users/shineanl/Documents/Codex/2026-10-14/task/game-entry-fix`。
基线：`8f330c23eb521f96f1f85d33f8c02cd27923de2c`。原任务目录、产物和进程未修改。

## 改动

- 构建入口使用正式 `WorldR5Integration.scene` / `WorldIntegrationBoot`，保留正式 WorldNativeComposition、WorldFlowComponent、RoomExploreOverlay、棋盘与动态骨骼角色。
- 正式世界改用 r2 去椅 room 的真实 Creator 导入 prefab、idle_loop 与 palette UUID。原 combined GLB/meta 移至 `archived-imports/static-seat-original-world` 留档，避免在 Creator assets 内重复打包完整世界。
- static_seat_preview bundle 使用既有 wx_subpackage 配置；构建配置关闭 separateEngine，使用本地压缩引擎；首次开启时生成未授权云插件，实际启动失败，已关闭并重建。
- room 保持原始 GLB SHA 不变，导入排除不使用的切线；actor 有法线贴图，切线保留。
- 家中静坐使用静态模型，位置独立于动态控制器。仅切换渲染，原动态适配器、真实动画和动作 Promise 未替换；静态人凳在出门过渡中整体隐藏。静态模型没有 rig，静态外观与旧动态角色的模型切换尚未验收，凳子独立留场及匹配站坐动作仍缺资产，不能宣称完整角色衔接修复。
- actor 三张纹理从 2048 降为 1024；法线重归一化。几何/节点/材质参数保持不变，GLB 7,925,240 -> 3,477,896 字节。原始 actor GLB 留档。

## 已测

Creator 自带 TypeScript 的启动回归 9 项通过（6 次预期失败场景）；原动态动画初始化 3 项通过。Boot 转译无语法诊断，git diff --check 通过。真实 UUID、必要 bundle 留存、actor 切线留存、room 源哈希已审计。证据在 output/home-seat-*.json。

## 构建与阻塞

补充上游用户原文证据后自动审批已通过，本轮Creator构建实际完成。首次构建exit36、Finished11s，但云引擎插件未授权；关闭separateEngine后修复重建exit36、Finished10s，主包1,861,856字节、总包28,709,186字节（27.38MiB），无云引擎插件。主包<4,000,000字节及总包<30,000,000字节门禁通过，必要分包保留。详细实测以output/home-seat-final-receipt.json为准（开发工具可能增加本地私有配置字节）。

微信实际进入正式WorldR5Integration，WORLD_STARTUP_READY。窗外夜景/云/棕榈及新静坐人凳可见；原生房间拖动改变相机视角，触摸解锁BGM。修正引擎后未观察到游戏错误，仅HarmonyOS与开发工具音频API不支持警告。截图output/home-seat-wechat-home.png、output/home-seat-wechat-room-drag.png。仅检查75%模拟器画面，未做2k逐像素对照或真机质量验收。

一次后续原生拖动误触工具栏预览，出现“正在编译代码”弹层，已立即取消，未见上传阶段或二维码结果；不宣称没有任何网络传输。停止进一步拖动。出门/回家与棋盘完整操作未测，静态凳独立留场与动态衔接未解决。个别分包配送限制、BuildInfo dev仍待核对。

复现本地构建：

```sh
/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project /Users/shineanl/Documents/Codex/2026-10-14/task/game-entry-fix/creator-build-project --build configPath=/Users/shineanl/Documents/Codex/2026-10-14/task/game-entry-fix/tools/wechat-home-seat-local-build-options.json
python3 tools/check_wechat_build.py creator-build-project/build/wechat-home-seat-local resources region_island region_skycity board_art audio_bgm_island static_seat_preview
```

结合 Finished 日志及产物校验判断成功（本项目 Creator exit 36 为既有成功约定）。先检查总包 <30 MB、本地主包限制，再仅本地打开微信工具检查窗景、静坐外观与正式交互。不得预览上传/发布、修改真实存档或权限。

下一轮按用户要求新开独立对话，不在本轮自动继续无限验收。
