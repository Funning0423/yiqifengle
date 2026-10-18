# r5-balloon-v22 接入报告（GGbot 美术 v2.3）

## 基线与提交

| 项 | 值 |
| --- | --- |
| BASE_SHA | `0e04ce2ee02ffc0cda1bef8855b79cee8ce1ace2` |
| 最终 HEAD | `80cf40a8a72f94718e58726916910117807239df` |
| 最终 tree | `6592bc8c0254c31dafcfdd49b12f4edfb1b5ee6f` |
| build-guard HEAD | `80cf40a8a72f94718e58726916910117807239df` |

未 push；未碰 `main`；冻结文件未改。

## 测试

Node 22：`run-suite` 基线 **98/99**（仅 `navigation-guard: BLOCKED_BROWSER`）。`test_frame_background.cjs`：5054 帧 PASS；`seamLeak=0`；`seamCamErr≈7.1e-5`；交接 `HANDOFF_COVER_T=35.9`、`handoffFade=1`。

## 接缝（JSON 2.2）

Mw / Cw / P / S 均用 JSON `seam.*`；城 Cw 未动；着陆 S0=(18.0900, 18.7084, 100.8184)；不跨接缝插值。

## 海面

**方案 B**：备选 `transit_sea_fallback`；游戏海面在 11.2–交接隐藏。夜间额外关掉备选海面与易品红的云地板组（夜空穹顶填底），避免 glTF albedo 丢失后的 magenta。

## 夜景 / 缺陷修复

- 03 穿云：球囊+女孩+云可见。
- 04 巡航：远景卡可见，无烧白高光。
- 06 降落：关 strata/vine/风核，无贴脸岛底。
- 07 夜景：无品红、无荧光绿地面条；城与气球清晰（mag%=0）。
- DC@24：≤53（约 33–52，关阴影+裁城饰+城开启后关远云）。
- 对比图正向（BMP 自底向上解码，无 sips -Z 压碎 contact）。

## 包体（HEAD `80cf40a`）

| 包 | 字节 |
| --- | --- |
| wechat-release | **19,934,166** |
| 相对 r4 19,335,755 | +598,411 |
| web-test | 20,722,849 |
| `region_transit_balloon` | **519,891**（≤ 1 MiB） |

## 性能

时长 36 s；自有+女孩+备选海 ≈ 40,994 tris ≤ 45k；城帧 DC ≤ 53。

## 截图

`docs/r5/balloon-v22/shots/`（副本在任务包 `shots/`）：01–07、`*_vs_render.png`、`contact_vs_render_v2_3.png`、`handoff_*`、`light_*`。

## 开放问题

- 夜间关掉云地板后，夜景云量少于日景（为消 magenta 的保守取舍）。
- 城帧 DC 余量小。
- headless rAF 非稳定 60。

## 磁盘

结束时约 **5+ GiB** 可用。
