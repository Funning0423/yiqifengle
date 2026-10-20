# r5-skyground r3 — 待真实构建，未交付完成

- 分支保持 `fx/r5-skyground-r3`，HEAD 保持 `872cddd1`。未切分支、回退、合入 r2 或推送。
- `env_skycity.glb` 保持已验收 SHA256 `c8558e31ab312a9c0dd94c82e859e34de4cb929407cd0faa893dd64d29657aaa`。
- 接入 handoff 原件 `env_sky_cloudsea_soft.glb`，38,988 B；SHA256 `bed3ed546423a27fa3592695506822a08b44311f30904242834d3bb039238674`。

## 已改

- RegionLoader 准备两个 prefab 后才发布 ready；拒绝把唯一的旧 prefab 错当成 soft，并重新加载已释放的缓存。
- SkycityCloudsea 拥有与 env_skycity 同父、同变换的兄弟节点，随模型图层与生命周期同步；复用 M_env_palette，不投射或接收阴影。
- 正常天空城隐藏旧 cloudsea、cumulus_far，保留 cloud_small、islets_far；源海面节点为 env_sea_surface，按可见天空城租约隐藏、离开后恢复。
- 热气球飞行段仍隐藏旧云与原有布景，并隐藏 soft；到达后启用 soft，保持旧云隐藏。
- 棋盘相机 far=1200；可见天空城相关相机绘制前保证 far≥1200。
- 新预算断言为 100,000 三角形，实际保守统计 98,840、49 primitive；实际棋盘 DC 尚未测量。
- 保留 872 的 RGBA 顶点色；新 GLB 无 COLOR_0，属性为 FLOAT POSITION/NORMAL/TEXCOORD_0。真实导入 stride 尚未回读。

## 已验证

- 完整 run-suite：139 项，137 PASS、navigation-guard BLOCKED_BROWSER、O4 冻结断言 FAIL。
- O4 原因仅为远裁剪面改动触发整文件哈希；现在只归一化该数值，仍保护原构图哈希，并断言 far=1200。
- run-suite 定向复核 journey-types、journey-occlusion、sky-arrival、sky-cloudsea：4/4 PASS。
- 新云海测试另通过最终版本：加载失败、缓存释放、挂载清理、兄弟变换、材质、图层、海面多租约、飞行与销毁。
- 组合结果覆盖 140 项：139 PASS，唯一未通过为允许的 navigation-guard BLOCKED_BROWSER；原始失败记录保留。
- journey-types 在 Creator TypeScript 5.8.2 上复现两项 TS2430（TextDecoder 和 TextEncoder，与用户目录 Node 类型冲突）。
- 增加 types: [] 隔离不相关 Node 全局声明；保持 strict、不使用 skipLibCheck。5.8.2、5.9.3 均通过。
- 新组件另通过 Creator 3.8.8 官方 cc 声明的严格源码类型检查（第三方声明依赖跳过检查）。
- test_manifests PASS：283 资源、891 文本；git diff --check PASS。
- 证据见 `docs/r5/skyground-r3/evidence/`，包括首轮完整套件与修复复核，未抹去首轮失败。

## 阻塞与续做

- 创建共享锁 `/Users/shineanl/cursor-tasks/.build.lock` 被沙箱拒绝：Operation not permitted。
- git add 创建 `/Users/shineanl/cursor-tasks/r5-skyground/repo/.git/index.lock` 同样被拒绝。
- 需要这两个路径的写权限；未绕过共享锁，未启动 Creator、HTTP 服务或拍摄浏览器。
- 尚未真实构建、生成 Creator meta、实测 DC/stride、重拍、提交或打 bundle，不能宣称交付完成。
- 构建前遵守 3.5 GiB 停止线；唯一已读磁盘值为 5,040,000 KiB，未做删除清理。
- 权限恢复后：拿共享锁；用 build-guard 只构建 web-test；采用保留文件的方式处理 guard 原有缓存清理，禁止直接运行其删除步骤。
- 新 GLB/脚本 meta 应由 Creator 生成；核验并入库后更新 manifests。
- 重拍入口：`tools/transitions/shoot_skyground_r3.cjs`，只截 390×844 游戏画布；14:00、day、lightScale=1。
- 02 镜头本地 [30,12,6] 看向 [30,-12,-44]，fov48；03 为 [12,0.2,2]、yaw220、pitch42、dist6.2。
- 脚本不修改模型，核验运行时兄弟关系、节点状态、共享材质、stride 和棋盘 20 次 DC≤64；finally 关闭自己的浏览器和 HTTP 服务。
- 真实截图仍须人工查看近处遮挡；完成后提交，生成 `fx-skyground-r3.bundle`（8fe16bf..HEAD），更新本报告并以“交付完成”结尾。
