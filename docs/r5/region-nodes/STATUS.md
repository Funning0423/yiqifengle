# 区域关卡节点 STATUS

- 2026-10-18 00:26 本地：T0 盘点。基线 Node 22 `QF_TYPESCRIPT` 套件 94/95，唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。与 f569ff0 口径一致。
- 代码对照（以代码为准）：`maps/topmap.cjs` 的地面法线门槛是 `|ny|/len > 0.72`，相邻高差用 `STEP 0.36 * hypot * (cell/0.4)`，不是设计文里的 0.8 / 0.35 m。烘焙沿用这份栅格。
- 没有 Blender。海岛和天空之城的 Draco 用 `/tmp/draco3d` 的 draco3d 1.5.7 解码（CC0/Apache 的解码器，只在工具里用，不进包）。草地 GLB 没有 Draco，直接读。
- 2026-10-18 00:33 烘焙：20 个节点。对照 `docs/r5/maps/nodes.json` 的各段长度误差都 ≤ 2%。直达段 I4→I6 19.0 m、M4→M6 10.4 m、S4→S6 31.5 m。
- 接线：`advanceMainline` 在角色已绑定时才走路；现有旅程测试不绑角色，顺序仍是 prepare → exit → travel → enter。`transportFor` 全部是 `bridge`。`RegionJourneyAdapter.ts` 与 f569ff0 逐字节相同。
- 棋盘位姿：海岛仍是 2D。草地和天空之城主线节点的离线覆盖检查没有在不改 GLB 的前提下证明 ≥ 99.5%，全部标成 `default`（F6 允许）。`setAnchor` 只加在草地棋盘上；天空之城棋盘文件被 `journey-occlusion` 的 Build05 SHA 钉住，不能改字节，所以天空之城节点保持现在的 `skycityVisitPose`。
- 地图缩放：52° 俯视会把站立的人压短。为了保证身体 ≥ 0.12 屏高，`zoomForBody` 会把请求的倍数收到大约 1.34 倍以内。设计里的 1.6 / 1.8 上限仍是请求上限。原因写进 REPORT。
- 2026-10-18 01:04 本地：Node 22 套件 103/104，唯一非 PASS 是 `navigation-guard: BLOCKED_BROWSER`。Node 20 套件 101/104，另外两项是 `legacy-board-ui-pure` 与 `reward-background-return` 的 `BLOCKED_NODE`。新增 9 项测试全部 PASS。
- 2026-10-18 01:08 本地：提交 `6f47e4748e`。冒烟 wechat/web 完成，工作区干净。build-guard both：wechat-release 19,413,434 B（比 r4 多 77,679 B），web-test 20,201,068 B。
- 2026-10-18 01:27 本地：截图在 `docs/r5/region-nodes/shots/`。实机只有海岛世界、海岛棋盘、昼夜和多分辨率。FollowWalk、MapExplore、标记三态、草地 M2、天空 S4 没有接到画面上。headless 海岛帧间隔中位数 99.8 ms。棋盘 DC 45。清理后剩余约 7.0 GiB。
- 2026-10-18 01:30 本地：报告和截图提交 `09a6176858`，tree `36eae1f71a`。代码提交 `6f47e4748e`，tree `a4b071e285`。没有 push。
