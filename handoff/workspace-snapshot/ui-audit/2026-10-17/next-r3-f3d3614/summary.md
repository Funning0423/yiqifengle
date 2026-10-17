# r3 f3d3614 验收（integration/build05-next-20261017T0818Z-r3）—— 进行中
## 进度
- [x] bundle 98ee3a01…c43d0b ✔（前置 228df2f，Mac 仓库已有）；README 已读
- [x] 测试脚本：lk.cjs（r2 版 + 视口参数 + 每帧相机 fov/位置采样 + QUICK 模式）；runall：day、night、mergeoff day/night、fail、360x780/375x667/390x520，rec10 整流程 day/night
- [x] 构建（guard both，一次过，未改写 .meta）：HEAD f3d3614 / tree f3a0a03a ✔，status 干净
  - **wechat 19,294,468 B**：比 09a1b8e +168,788，比 r2 +6,526，距安全线 5,347,068 B ✔；main 1,239,082；region_lakeside 542,335；web-test 20,079,413
  - 产物 SHA256：wechat-release 635 个文件 95fd39ca32818e6332324761f4a0d2799841a2c36480f00a2fc2d20dd48b9ee3；web-test 615 个文件 f5a3f21d5d62baae626e1eaa76472487dc0944ae0dd0078b789da45886617d36
- [x] Mac 运行 runall + 弹窗复测（pc）+ 诊断构建 diag/ 全部完成
- [x] 分析、summary（见下方「r3 结论」）
- [x] 清理 Mac（见下）
- 新增项：10 个采样点，按 ENGINE_COLOR_REFERENCE/work/sample.py 的方框（720×1280），目标用 r5h3「调色前」时间中位值（REFERENCE.md 第 0 节：没有后处理时对调色前）。合格线：每个通道最大差 ≤12，条纹行均值标准差 ≤10。不跑 ?lakediag。

## 进度 16:52（Mac runall：day、night 已完成）
- day 棋盘：DC 中位 30 / 峰值 38 ✔（≤60）；FPS 60；heap 185 MB，纹理 114.8 MB，buffer 49.7 MB；360x640 下 DC 34；仅背景 DC 4
- 清屏色：白天 LakesideBackgroundCamera 和 Main Camera 都是 28/143/184 ✔（r2 是 242/185/138 橙色，已修）。白天切夜晚 → 28/39/64，切回 → 28/143/184 ✔
- 离开湖畔：海岛白天主光 255/255/255、125000，skyIllum 20000，雾关闭 ✔（已恢复）；海岛 DC 76–80
- 首次进入最长帧 133.3 ms（day）/ 114.7 ms（night），>100 ms 的帧各 1 个（r2 冷启动为 382.6 ms）
- ⚠ night 的 perfBoard 测量无效：截图显示「暂停一下」弹窗处于打开状态（DC 70 = 棋盘 + 弹窗）。night 棋盘 DC 需看 mergeoff_night 或复测，不能直接判定为失败
- 10 个采样点（棋盘默认镜头，白天，分层雾，仅背景 360x640 → 720x1280，按 sample.py 的框取中位数）：见 sample10_day_layered.txt 和 sample10_day_layered_annotated.png
  - **9 个点全部 FAIL，条纹 std 30.0（>10 FAIL）**。根因是构图不同：引擎棋盘镜头下近处是一大片绿色岸坡，湖面被压缩到画面中段，远处是高耸的雪山和蓝天；r5h3 是俯视、整个下半屏都是湖水。因此同像素框落在不同物体上（near_water_bottom/L 落在草坡上，为 53/95/20、46/92/18）。r2 的构图相同，不是 r3 的回归
  - 附加区域（同框）：桥栏 192/154/109，左草 171/128/90，右草 166/142/109，远树框 143/164/157（落在山体上），远山框 111/143/169（落在雪山/天空上），左屋顶 129/107/48
  - night：远山呈蓝灰（28/39/64 量级），草为暗绿 / 暗蓝，不黄、不灰 ✔（主观判断）；条纹 std 7.4
  - 对比图：r3/bgonly_r2_r3day_r3night_r5h3.jpg

## 进度 16:58
- 旅程分段（day / night，合批开启；详见 journey_segments_daynight.txt）：
  - 海岛：DC 97 / 100
  - 过桥：DC 中位 33/30，峰值 43/41
  - 抵达：DC 中位 30/21，峰值 34/31
  - 湖畔：DC 25
  - 内存峰值：heap 242 / 165 MB，纹理 103 MB
  - 全程 60 FPS
  - r2 的旅程 DC 约 295，r3 大幅下降 ✔
- mergeoff（day / night）：棋盘 DC 103/103，仅背景 37/37（合批开启时为 4）；首次进入最长帧 131/133 ms
- ⚠ 弹窗问题：night 和 mergeoff 的棋盘测量都带着「暂停一下」弹窗（教程只出现一次，持久化 profile 里第二轮起就没有了，暂停弹窗来源待查，不是脚本点出来的）
  - 弹窗大约 +40 DC，所以 70/103 不可直接判定
  - 已加 lk2.cjs：记录弹窗并点「继续」后复测棋盘 DC（day/night × merge on/off），在 diag 跑完后执行
  - 估算：合批关闭、无弹窗约 26（UI）+ 37（背景）≈ 63，可能略超 60，以复测为准


## r3 结论（17:25 CST = 05:25 EDT 定稿）
1. **编译 / 加载**：guard 一次通过，湖畔可以加载 ✔
   - 注入失败（abort region_lakeside）后退回海岛，画面上只有「湖畔暂时没准备好，先回小岛吧」这一条失败提示 ✔（r3/raw/lk_fail_fail_toast*.jpg）
   - 失败轮的五类错误：A 0；B 7 条（4928×4 + [QF_LAKE] ×3，属于预期的失败回退日志）；C 0；D 8 次有意 abort（config.json / index.js 各 4 次，均未再请求成功，属测试注入）；E 0
2. **包体**：wechat 19,294,468 B
   - 比安全线 24,641,536 B 低 5,347,068 B ✔
   - 比 09a1b8e 多 168,788 B
   - 产物 SHA 见上方「构建」一节
3. **棋盘 DC**（已关闭 PausePanel 和 GotIt 后复测，lk_*_pc*.log）：
   - 合批开启：day / night 中位 30、峰值 38 ✔
   - `?lakemerge=off`：day / night 中位 63、峰值 71 ✗（>60）
   - 仅背景：合批 4 / 不合批 37
   - FPS：首轮 60；复测窗口 44–59（刚关完弹窗、带录屏，仅供参考）
   - 内存：heap 120–195 MB，纹理约 115 MB，buffer 约 50 MB
   - 注：第二轮起进棋盘先弹 PausePanel（「暂停一下 / 还剩 25 步」），点「继续」后再弹 GotIt。疑似恢复了上一轮未完成的关卡进度，不是脚本点出来的，请产品确认是否符合预期
4. **五区 / 10 点**：棋盘镜头构图与 r5h3 不同，同像素框落在不同物体上
   - 9 点全部 FAIL（最大差 27–121），条纹 std 30.0（≤10 FAIL）
   - 见 sample10_day_layered.txt / sample10_day_layered_annotated.png，以及 r3/bgonly_r2_r3day_r3night_r5h3.jpg
   - 白天湖心区域呈米色 / 橙色的「沙底」，看不出湖水色；近处是一大片绿坡
5. **昼夜切换**：
   - 白天清屏色 28/143/184 ✔，不再是橙色；夜间为 28/39/64
   - 夜间远山蓝灰、草暗绿，不黄也不灰 ✔
   - 夜间湖心仍偏橙褐 ⚠
   - 离开湖畔后海岛恢复当前模式的灯光 ✔：白天 255/255/255、125000；夜间 180/198/232、43750
6. **旅程分段**（合批开启）：过桥 DC 33/30（峰值 43/41），抵达 30/21（峰值 34/31）；合批关闭时过桥 64/61、抵达 56/56
   - 抵达后湖畔停留段：合批开启 DC 25，关闭 58（单看背景的差值为 33，与预期的「合批后约 4」一致）
   - heap 峰值 242 MB（白天 ready 段），纹理 103 MB；60 FPS
   - 五类错误：day/night/mergeoff/三种视口/全流程各轮均为 A0 B0 C=favicon 404（白名单）D0 E0；**404 只有 /favicon.ico；ERR_CONNECTION_RESET 0**
7. **落地 → 棋盘**（landing_camera.txt、landing_strips/swap_slices_4vp.jpg）：
   - 抵达段 FOV 单向递增 ✔（390x520：53.2→71.3；360x780：52.1→55.2；375x667：51.2→53.6；390x844：53.3→57.35）
   - level-loading 的 0.8 s 内有推近：FOV −6°、相机前移约 2.5
   - 交换帧硬切到 LakesideBackgroundCamera（FOV 回到 +6°，机位不同，(2.945,3.58,31.16) vs (−2.67,2.46,39.83)），四种视口都能看到构图跳变：山体变大、近景绿坡出现 ✗
   - 因为交换帧同时弹出 GotIt / PausePanel，被 UI 遮掉一部分
8. **天空球**：旅程中海岛的蓝色天空球仍然盖住混合后的天空色（j30/j36，sky_and_toggle_sheet.jpg），与 r2 相同
9. **其他**：
   - 首次进入最长帧 133 ms（day）/ 115 ms（night），各只有 1 帧 >100 ms
   - 环境音 ✔：抵达时（t=59.96 s）lake-play，棋盘中 lake-xloop 持续，waves-gate=lakeside 淡出；离开时 lake-exit → waves-gate ok，回海岛后 waves-start from:"zero"
   - 全流程 day/night：11 步过关，night nightProp=true，A0 B0 C=favicon D0 E0 ✔，无回归（videos/）
10. 诊断（?lakediag=1，调试构建 10a7820）：见 diag/summary.md

## 清理
- 调试构建清理：删除前剩余 9,489,280 KiB，删除后 9,526,692 KiB
- 最终清理：删除前剩余 9,446,780 KiB（≈9.01 GiB），删除后 9,827,740 KiB（≈9.37 GiB）
  - 已删：web-r3、r3/（含录屏、prof、截图）、raw/、diag/、bundle、日志、压缩包
  - 保留：~/qfl-a3b/repo（源码克隆，332 MB，无 build/library/temp，已切回 r3 分支）以及 5 个小脚本
