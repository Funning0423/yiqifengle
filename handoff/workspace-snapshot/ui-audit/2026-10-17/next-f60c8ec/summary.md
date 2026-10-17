# next-f60c8ec 验收（2026-10-17）

## f60c8ec（integration/build05-next-20261017T0438）
- 包体（guard，真分支）：wechat 19,154,482 B（较 09a1b8e +28,802），web 19,896,460；安全线 24,641,536 内。
- A3b 昼/夜 草地点「回家」：PASS。0–200 ms 峰值 0.783/0.728，满幅样本 0；click 比 BGM 高 +9.8/+9.6 dB；home-duck gain 0.6 有日志；waves-start from:"zero" vol 0.037/0.002（回家时 bed 不重启，无新 waves-start）。日志 logs/recday.log, recnight.log, home_analysis.txt。
- 旅途书 4 行：390×844、375×667、320×568 均不裁切（320 副标题偏小）。frames/journal_390_375_320.png。
- 整流程：无回归，错误 0，时序与 09a1b8e 差 ±0.1 s。
- 湖畔：不加载，静默退回海岛，DC 测不到。两个阻断 bug：
  1. GLB meta meshCompress encode:true，但 engine.json 关了 meshopt 模块 → 52× `Error 16352 … ek.decodeVertexBuffer is not a function`。
  2. LakesideBoardBackground.ts 第 67 行 `[...new Set(...)]` 被编译成 ES5 `[].concat(new Set(...))`，长度恒为 1 → 必抛 `lakeside-prefab-missing: [object Set]`。第 18 行 `[...shared.values()]` 同理（dispose 时会把 iterator 当材质）。修法：改用 `Array.from(...)`。
  HUD 会吞掉这两类错误。

## 湖畔 v3.2（21c187d），测试分支 + 3 个 TEST ONLY 提交（开 meshopt、includeModules 加 meshopt、Array.from）
- effect：lakeside-water.effect 编译无错误，guard 首次即过，未改写 .meta。
- 包体：wechat 19,197,085（较 f60c8ec +42,603）；开 meshopt 后 19,205,697（再 +8.6 KB）。web 19,988,604。
- Draw call：整屏 79（白天/夜间/三种雾一样），**>60 不通过**。只渲染背景时为 36，棋盘和 UI 约 43。三角面 33.8k，431 个实例，39 个 instanced 材质。v3.2 只有 Main Light（dir，shadowEnabled false），没有 SphereLight 可关。
- FPS（M4 Chromium）：layered 白天 60，linear60 54，off 52，layered 夜间 53。
- 第一次进入的最长帧：1683 ms（构建后首跑，冷启动），其余几次 1000/217/500 ms。
- 三种雾 vs r5h3：v32/v32_fog_sheet_bgonly.png（仅背景，同机位），v32/v32_fog_sheet_board.png（带棋盘）。
  - 近水是**乳白偏亮的青色**，不偏黄绿；比 r5h3 亮且饱和得多。近水左 r5h3 66/152/146，v3.2 是 64/218/216（layered）和 25/219/217（linear60/off）。
  - 远岸：layered 有灰白薄雾，层次最接近 r5h3；linear60 与 off 几乎一样，雾基本看不出来，天空发白。
  - 桥上的亭子：没有了（桥是白色的）。
  - 湖中段有明显的**橙/青条纹带**（像日光拉丝或波纹被夸大），在缓慢移动。逐帧没有突跳，最大帧差 ≤0.6/255。mid_water 时间 std：layered 6.3、linear60 14.4、off 13.9、夜间 4.4；桥 1.3–4.4。见 v32/off_midband_t0_5_10_15.png。
  - 夜间 layered：整体偏灰暗，没有越界。
  - 建议雾模式用 **layered**：远景层次最好，也压住了条纹带。不过条纹带和近水过亮仍需要美术修。
- 错误：4 次运行的 page errors 都是 0，prefab-missing 0（在应用上面的 TEST ONLY 修复之后）。补丁：v32/0001-TEST-ONLY-*.patch。

## README v2.1
- 校验和写在正文里，手动放进 ~/Downloads 的步骤也写清楚了。桌面包未替换（仍为 09a1b8e）。
