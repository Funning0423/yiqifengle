# 湖畔 r5h 入包 · 包体预算方案（基线 b0020ed，只读分析）

作者：GGbot　时间：2026-10-16 20:44Z（16:44 ET）　**未改任何 worktree、未提交、未构建。**
清单：`inventory_b0020ed.csv`（creator-build-project/assets 283 个源文件，含 md5 与重复标记）。

## 0. 基线（界面验收部 Mac 实测 b0020ed）
- 总包 24,553,771 B，上限 24,641,536 B（24 MiB 口径 = 23.5 MiB），**余量 87,765 B**。
- 构建分包：region_island 8,912,286 · region_skycity 3,326,944 · region_meadow 2,934,382 · static_seat_preview 2,556,372 · board_art 2,109,392 · 根/主包 1,862,103 · shared_effects 563,694 · resources 433,034 · audio_bgm_island 418,907 · internal 297,535。
- 所有 bundle 都是 `subpackage`、`isRemote=false`，当前没有任何远程资源。

## 1. 要放进来的东西
| 项 | 源大小 | 构建后估算 |
|---|---|---|
| 湖畔 55 个 GLB + 调色板 1.8 KB + LUT 9 KB | 1,012 KB | **不开网格压缩：约 1.10–1.20 MB**（float 顶点、无 Draco，Cocos 另生成 prefab/mesh json）；**开 meshCompress（compress+quantize+encode）：约 0.30–0.45 MB** |
| 出门音轨 B5.5（20 s） | 160,539 B | 32 kbps 单声道约 80 KB；24 kbps 约 60 KB |
估算依据：湖畔 GLB zlib-9 后 223,303 B；草地 env_meadow.glb 开了 compress 后构建体积约为 zlib 结果的 1.15 倍，再加每个 GLB 约 2–3 KB 的 Cocos 元数据。**都是估算，必须实构建确认。**

结论：湖畔不开压缩光它自己就超出余量 10 倍以上，**无论哪个方案，湖畔 GLB 都必须开 meshCompress**。

## 2. 包体大头与发现
- 角色 `chr_b_r5g2_..._grokbot2.glb` 3,584,600 B：**没开 meshCompress**（草地/天空城/房间都开了 compress）。其中网格 2.62 MB、动画 0.56 MB、贴图 0.17 MB；整文件 zlib 后 2.23 MB。region_island 构建 8.9 MB 主要来自它（动画转 Cocos clip 会膨胀）+ anim_meta.json 372 KB + combined_collision_proxies.json 281 KB。
- env_meadow 6.4 MB / room 5.29 MB / env_skycity 1.19 MB：只开了 `compress`，`quantize`、`encode` 都关着。
- 三首 BGM 已是 40 kbps 立体声（bgm_main 83.5 s 417,819 B；meadow 363,615；skycity 360,480），合计 1,141,914 B。环境/音效都已很小。
- PNG：全部 2D 图都是 PNG，没有压缩纹理（ASTC/ETC）配置；最大的是 board_art/r2 三张 hero 1200×1200（共 527 KB），已是调色板 PNG。前 16 张 1.36 MB，重新量化（256 色）可到约 0.58 MB，但它们已经量化过一次，再压是有损的。
- 微信小游戏包体按文件计，ASTC/ETC 一般比 PNG 更大，**不建议为省包体转压缩纹理**。
- 疑似重复（只报告，不删）：`scripts/r4-cloud-compat/runtime/engine.js` 与 `scripts/regional-r05/runtime/vendor/engine.js` 完全相同（45,173 B）；`board_art/board/tool_{starlight,tidebottle,windbell}.png` 与 `board_art/r2/hero_*` / `tool_*` 可能是新旧两版，请设计确认是否都在用。仓库根目录的 art-src/、archived-imports/ 不进包，与包体无关。

## 3. 可腾空间的候选
| # | 动作 | 腾出 | 画质/音质影响 | 风险 | 工作量 |
|---|---|---|---|---|---|
| C1 | 角色 GLB 开 meshCompress `compress`（只开无损这一项） | 约 0.9–1.3 MB（估） | 无（无损） | 中：蒙皮网格首次开压缩，要回归走路/坐下动画、加载时长 | 小：改 meta + 构建 |
| C2 | 湖畔 GLB 开 compress+quantize+encode | 相对不压省 0.7–0.8 MB | quantize 有轻微精度损失；调色板 UV + 顶点色，肉眼基本无差 | 低 | 小（接入时就设置） |
| C3 | 草地/天空城/房间加开 quantize+encode | 约 0.4–1.0 MB（未测，波动大） | 顶点位置/UV 量化，远景几乎看不出；需对比截图 | 中：三个大场景都要回归，可能出现接缝/抖动 | 中 |
| C4 | 三首 BGM 改成远程加载 | 1,141,914 B | 无 | 中高：需要 CDN/服务器 + 微信后台 downloadFile 合法域名；首次进入要下载（可先静音再淡入）；离线只有缓存过才有 | 中：新建 remote bundle + 部署 |
| C5 | BGM 重压 32 kbps 单声道 | 约 230 KB | 失去立体声、高频变闷，耳机能听出 | 低 | 小（Voice Bot 出） |
| C6 | 前 16 张 PNG 重新量化 | 约 0.78 MB | 有损：渐变色带、半透明边缘发脏风险 | 中：要 UI 验收逐张看 | 中 |
| C7 | 消掉重复 engine.js | 约 45 KB | 无 | 中：两套 runtime 引用路径要改 | 小 |

## 4. 方案
记号：余量 R0 = 87,765 B；湖畔 L（开压缩）= 0.30–0.45 MB；出门音轨 E = 60–80 KB。

**方案 A：只做无损/近无损压缩（推荐先试）** = C1 + C2
- 剩余 = 87.8 KB + C1(0.9–1.3 MB) − L − E
- 保守：87.8 + 900 − 450 − 80 ≈ **458 KB**；中值 ≈ **760 KB**。≥200 KB ✅
- 不依赖服务器、离线可玩、画质不变。唯一前提：C1 实构建确实省到 ≥0.6 MB（这是盈亏线：0.6 MB 时剩余约 158 KB，不够 200 KB，就要加 C5 或 C3）。

**方案 B：BGM 远程** = C2 + C4
- 剩余 = 87.8 + 1,142 − L − E ≈ **700–890 KB** ✅
- 收益确定（BGM 字节数就是省下的数），但需要 CDN 地址 + 微信后台域名白名单，测试包要在有网时首次缓存；桌面测试包里 urlCheck=false 能先跑，正式版前必须配域名。

**方案 C：混合兜底** = A + C5（必要时 + C3）
- 若 C1 只省 0.6 MB：A ≈ 158 KB + C5 230 KB ≈ **388 KB** ✅；仍不够再加 C3。
- 全部本地，不需要服务器；代价是 BGM 变单声道。

建议：**先走 A**（下一次 Mac 构建同时测 C1 和湖畔压缩后的真实字节），实测不够 200 KB 再按 C 加 C5；B 留作后续内容继续增长时的长期方案（届时要 Funning/Grok Bot 定 CDN 和域名）。三个方案都不删任何现有内容。

## 5. 湖畔自身还能怎么挤（如需更多余量）
- 已经很省：全部共用 1 张 256² 调色板 + 1 个材质，没有大贴图可缩；LUT 9 KB。
- 5 个零实例备用 GLB（cliff_rock、driftwood、splash_crown、splash_drop、tree_far，共约 28 KB 源）里，两个水花是动态生成要保留，其余三个不放进包可省约 17 KB（属于"先不接入"，不是删除，由场景设计部决定）。
- LK_terrain/far_hills/bridge/house_A/B/C 是最大的几个（每个 75–114 KB 源），合计约 0.53 MB；有需要可让场景设计部减面 30–40%，在开压缩后约省 50–80 KB，影响远山轮廓，优先级低。
- 只有 2 个 GLB 缺 COLOR_0；顶点色是 UNSIGNED_BYTE 已省，normal/UV 都是 float，quantize 会把它们压到 16/8 位，是 C2 的主要收益来源。
- 共享岛上材质：湖畔用自带调色板 + 顶点色，与岛材质体系不同，共享省不了多少字节（只有一个材质 json），不建议为此改。

## 6. 需要实构建验证的数字
1. C1：角色开 compress 后 region_island 构建大小（预计 8.9 → 7.6–8.0 MB）。
2. 湖畔分包开 compress+quantize+encode 后的真实大小。
3. 出门音轨重压后字节数（Voice Bot）。
4. 回归：角色走路/坐下动画、湖畔画面与 renders/cmp_r5h_slim_graded.png 对比。
