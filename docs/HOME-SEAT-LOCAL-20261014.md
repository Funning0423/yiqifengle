# 本轮本地最小修复交接

独立目录：`/Users/shineanl/Documents/Codex/2026-10-14/task/game-entry-fix`。
基线：`8f330c23eb521f96f1f85d33f8c02cd27923de2c`。原任务目录、产物和进程未修改。

## 改动

- 构建入口使用正式 `WorldR5Integration.scene` / `WorldIntegrationBoot`，保留正式 WorldNativeComposition、WorldFlowComponent、RoomExploreOverlay、棋盘与动态骨骼角色。
- 正式世界改用 r2 去椅 room 的真实 Creator 导入 prefab、idle_loop 与 palette UUID。原 combined GLB/meta 移至 `archived-imports/static-seat-original-world` 留档，避免在 Creator assets 内重复打包完整世界。
- static_seat_preview bundle 使用既有 wx_subpackage 配置；构建配置打开 separateEngine。主包和总包是否达标必须重建后实测。
- room 保持原始 GLB SHA 不变，导入排除不使用的切线；actor 有法线贴图，切线保留。
- 家中静坐使用静态模型，位置独立于动态控制器。仅切换渲染，原动态适配器、真实动画和动作 Promise 未替换；静态人凳在出门过渡中整体隐藏。静态模型没有 rig，静态外观与旧动态角色的模型切换尚未验收，凳子独立留场及匹配站坐动作仍缺资产，不能宣称完整角色衔接修复。
- actor 三张纹理从 2048 降为 1024；法线重归一化。几何/节点/材质参数保持不变，GLB 7,925,240 -> 3,477,896 字节。原始 actor GLB 留档。

## 已测

Creator 自带 TypeScript 的启动回归 9 项通过（6 次预期失败场景）；原动态动画初始化 3 项通过。Boot 转译无语法诊断，git diff --check 通过。真实 UUID、必要 bundle 留存、actor 切线留存、room 源哈希已审计。证据在 output/home-seat-*.json。

## 构建与阻塞

本轮未运行成功构建，未打开微信新产物，主包/总包暂无实测数据。自动审批两次拒绝 Creator 命令：先引用最初只读诊断的禁止构建要求，补充后续委派修复授权后仍称未见可信用户原文。没有绕过审批。

待直接用户确认本轮本地构建后执行：

```sh
/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project /Users/shineanl/Documents/Codex/2026-10-14/task/game-entry-fix/creator-build-project --build configPath=/Users/shineanl/Documents/Codex/2026-10-14/task/game-entry-fix/tools/wechat-home-seat-local-build-options.json
python3 tools/check_wechat_build.py creator-build-project/build/wechat-home-seat-local resources region_island region_skycity board_art audio_bgm_island static_seat_preview
```

结合 Finished 日志及产物校验判断成功（本项目 Creator exit 36 为既有成功约定）。先检查总包 <30 MB、本地主包限制，再仅本地打开微信工具检查窗景、静坐外观与正式交互。不得预览上传/发布、修改真实存档或权限。

下一轮按用户要求新开独立对话，不在本轮自动继续无限验收。
