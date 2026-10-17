# integration/build05-next-20261017T0438：A3b + 风铃湖畔 + 湖畔合批（一轮 Mac 测试）
- **HEAD** f60c8ec79e8ef16f52b1761352b1d2f4253f6394，**tree** ef4261a70716f24228ca454bf923a2fb7b76d538，基于 09a1b8e，共 7 个提交：
  1. c49801b A3、a17395c A3b（GGbot，原样）
  2. 76b18d6 / 8bbbbd8 / ad17dfe / 30440cc：Voice Bot 湖畔 dbcc5aa / 17849b2 / 65a7281 / d8cd409 的 cherry-pick。**没有冲突**，run-suite 列表自动合并。
  3. f60c8ec B1：湖畔 GPU instancing（GGbot，单独提交，免费，不改资源）
- integration/build05-20261016T2048 没动。只在本地：没有 push，没有 force，没有动主线。
- 拿代码：`git fetch integration-build05-next.bundle integration/build05-next-20261017T0438:integration/build05-next-20261017T0438`（前置提交 09a1b8e），或在 09a1b8e 上 `git am patches/*.patch`。
- Suite 56 项 51 项通过；没通过的只有已知 5 项。wind-audio、exit-restart-quiet、home-sea-fadein、lakeside-rules、lakeside-entry、lakeside-instancing 都通过。见 suite.txt。

## 静态检查（box）
- 解锁门槛一致：progress-journal.js 和 IslandPanels.ts 的 LAKE_GATE_RECORD 都是 11（主线第 12 关）。
- 湖畔实际摆放 465 个实例，用到 42 个 GLB。每个都在 `bundles/region_lakeside/models/` 下、有 .meta，.meta 里有 gltf-scene 子资源 `<名字>.prefab`，和代码 `lakesidePrefabName()` 对得上。静态上看不会出 lakeside-prefab-missing，但 Prefab 子资源的名字要在 Creator 里实测。
- Draw call：每个 GLB 自带一份 M_LK_palette，不合批时约 **465 个 DC**，明显超过 60。
- B1：给每个源材质做一份共享副本并开 USE_INSTANCING，同一个 GLB 的实例合成一批，**基础 pass 约 42 个**。
- ⚠️ 光照风险：3 个 SphereLight 的 range 都是 600，会照到所有物体。前向渲染下每盏灯可能多一个叠加 pass，最坏约 42×4≈168 个 DC。请看实测，超了要定光照方案：比如去掉亮度 0.08 的那盏，或改成只用 1 盏。光照方案归运镜bot / Voice Bot。

## 包体估算
09a1b8e 实测 19,125,680 B。A3b 约 +0.3–0.5 KB，湖畔约 +32 KB（Voice Bot 估算），B1 约 +0.5 KB，合计约 **19,159,000 B（≈18.27 MiB）**，在安全线 24,641,536 B 以内。需要实测。

## Mac 测试清单
1. **包体**：`CREATOR=… bash tools/build-guard/build-wechat-guarded.sh both`，报 TOTAL_BYTES、主包、各分包（特别是 region_lakeside），并和安全线 24,641,536 B 比较。
2. **A3b**（开 `__worldFlowLog`）：
   - 从草原点「回家」时出现 `[QF_AUDIO] {"event":"home-duck",…,"gain":0.6,"s":0.08,"outS":0.4}`。
   - 海浪重新起播时出现 `{"event":"waves-start","vol":<约0.01–0.05>,"from":"zero"}`。
   - 录音：回家前后没有满幅（≥0.999）采样。
   - 点击音降了 2.5 dB，仍然要听得清。
3. **湖畔截图**：真实游戏内截图，720×1280 和 9:19.5 各一张。2D 棋盘和 3D 湖面没对齐是已知问题（归运镜bot），只需记录。
4. **报错**：控制台有没有 `lakeside-prefab-missing: …`、`lakeside-background-*`，以及缺 builtin-standard / shader 的报错。
5. **性能**：湖畔关卡里的 FPS 和 draw call（`__worldIntegration` 或 Cocos 的 profiler / 微信开发者工具性能面板）。**DC > 60 判不通过。** 同时记下 diagnostics 里的 `instancedMaterials`（预期 ≥42）。
6. **旅程册**：4 行在 375×667 和更矮的屏幕上（比如 320×568）会不会挤或被裁，请截图。
7. **回归**：白天、夜间整流程；切后台；草原回家。

## 快速解锁湖畔（只用于测试，不要合并）
正式门槛是主线第 12 关。release 和 web-test 配置都是 debug:false，所以调试用的「地区流程测试」用不了。最快的办法是用测试补丁，把门槛降到主线第 1 关：
```bash
git switch -c test/lake-gate-0 integration/build05-next-20261017T0438
git am TEST-ONLY-lake-gate-0.patch          # 两处 LAKE_GATE_RECORD 11 → 0
bash tools/build-guard/build-wechat-guarded.sh web
```
在全新的浏览器配置里通关主线第 1 关，再打开旅程册 → 第 4 章「风铃湖畔」→「继续挑战」。**包体请用正式分支测，不要用这个分支。** 测完删掉这个分支。
