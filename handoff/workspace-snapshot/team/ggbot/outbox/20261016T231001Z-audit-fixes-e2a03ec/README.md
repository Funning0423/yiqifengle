# audit-fixes-e2a03ec（界面验收部 e2a03ec 复验问题修复）

HEAD **6bdbf5bcf02da1185f82241afe4ebe0c97c0c903**，tree **fb3f6718baac3ba617ccd82dfc75a703ba24ddfd**，分支 `ggbot/audit-fixes-77b76c3`（只在本地，没有推送）。
- `patches/`：基于 e2a03ec 的 6 个补丁（合并提交被线性化，git am 后 tree 一致）；bundle 范围 b0020ed..HEAD。核对见 TREE_CHECK.txt，校验见 SHA256SUMS。
- 全量测试：47 项，42 通过；未通过的只有已知 5 项（production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract 失败；navigation-guard BLOCKED）。

| 项 | 提交 | 根因 | 修法 | 包体（对 19,097,915 B） |
|---|---|---|---|---|
| R1a | 576b8ab | 领取是一批：先领宝箱、再领地区奖励，结算页**连续重画两次**，中间没有帧。第二个面板接手时拿到的分数位置是 null（只在点击的面板里记录过），所以不缓动，一帧跳 66pt。 | 每次交接都带上分数当前（缓动中的）屏幕位置；接手时一律缓动。测试新增“连续两次重画”，旧代码会失败（149.5 vs 83），新代码通过 | 源码约 +0.5 KB |
| R1b | b7c5221 | 重画后的面板又播了一次星星落下动画 | 接手宝箱的面板跳过星星入场。测试检查第一帧星星就是不透明的 | 约 +0.1 KB |
| A1b | 827cb1f | 风声 / 海浪只在 `canPlayAmbience()` 为真时出声，这个判断要求有过 UI 按钮手势（gestureSeen）；出门音轨不看这一条，所以音轨照常播放，风和海浪一直被挡住。另外 WindAudio / AmbienceAudio 只靠 `director.once(场景启动)` 挂载，错过就不会挂上。**这是从代码推断的，没有在运行时证实。** | 出门音轨真正开始播放后，环境声也允许出声（静音、切后台仍然优先）；standing / crossing-out 时由 GameAudio 再挂载一次 WindAudio 和 AmbienceAudio；风力仍然跟随 timing.wind（getWindStrength）。打开 `__worldFlowLog` 后会输出 `[QF_AUDIO]` 日志：ensure-ambience（含 gate 原因）、wind-gate / wind-loaded / wind-play / wind-pause、waves-gate / waves-loaded / waves-play | 约 +3.4 KB |
| M1 | c6cd037 | Creator 导入时会补全 meta | 原样应用界面验收部的两个 diff（52 个 GLB 的 subMetas；2 个 png 的 hasAlpha 从 true 改成 false）。**已核对：T_LK_palette_256.png（256×256）和 T_LK_grade_lut_32.png（1024×32）都是 RGB 模式，没有 alpha 通道，也没有 tRNS，hasAlpha=false 是对的** | 0（构建本来就用导入后的值） |
| N1 | 1fd2661 | 去草地时把 meadow_sky_dome 关掉了，改用小岛的天空；这一段镜头看到的天空没有夜色。SkyNightTexture 组件写好了，但没有挂在任何节点上 | 夜里保留 meadow_sky_dome，挂上 SkyNightTexture（夜空图按需加载，加载完之前显示夜色渐变，nightBlend=1）；白天和以前一样关掉。昼夜切换时由 applyDayNight 同时开关穹顶。日志 `[QF_SKY]`。新测试 meadow-night-sky | 约 +1.4 KB（夜空图本来就在 region_meadow 分包里） |
| A2 | 08bd1ca（Voice Bot）+ 合并 6bdbf5b | 消除音效叠加削波 | Voice Bot 把 8 个音效降 7 dB，文件大小不变，没有改代码 | **+0 B** |

代码各项都是 TS 源码的差值，构建压缩后会更小；**估算总包约 19,103,000 B**（+约 5.5 KB），需要 Mac 实测。

## 请界面验收部在 Mac 上确认
1. **A2：录屏里关卡段没有任何样本到 0 dBFS，连消反馈音仍然清楚可闻。**
2. A1b：出门户外段（日志 34–44 s）有风声和海浪，而且**只有一层风声**；请附上 `[QF_AUDIO]` 日志（如果还是没有声音，gate 原因会写在日志里）。
3. R1a：390×844 开箱时分数是 0.25 s 缓动上移，没有一帧跳 66pt；R1b：星星不会消失后再重新落下。
4. N1：夜间去草地和在草地时天空是夜色。注意：草地穹顶在夜里打开后，要看一下从小岛出发、过桥那一段有没有遮挡或接缝。
5. M1：干净构建后工作区里没有被改写的 lakeside meta。
