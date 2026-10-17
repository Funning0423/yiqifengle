# r2 228df2f 验收（integration/build05-next-20261017T0725Z）—— 已停（被 r3 取代），数据留作参考

## 进度
- [x] 来源：bundle cfec8795…9baf ✔；在 box 上把 f60c8ec→v3.2→r2 链成增量 bundle（09a1b8e..r2，edf20059…）；Mac 上 HEAD 228df2f / tree 9af6e8dd ✔；status 干净；**没打任何 TEST-ONLY 补丁**
- [x] 构建（guard both，一次过）：**wechat 19,287,942 B**（比 09a1b8e +162,262；距安全线 5,353,594 B）；main 1,231,957；region_lakeside 542,934；board_art 2,131,356；web-test 20,072,131
  - 产物 SHA256：wechat-release 635 个文件 bb54ade2a973e5e5db8a24ac8aaae479c7ef231e37b0a978fc99ce6c00fb99fa；web-test 615 个文件 b90a69cc61d27d810869a589ad67bbf39a0904d74eb7914ab384cf9e20b3701b
- [x] Mac 上已跑完：lk day / night / day(?lakemerge=off) / day 复测 / 失败注入，rec10 整流程 day / night；数据回传中
- [ ] 回传、分析、对比图

## 测试方法说明
- 湖畔章节解锁：没有改代码，只在测试 profile 的 localStorage 写入旧版进度键 `dot-mainline-r1-isolated-20261009:forest-v3-completed=12`（游戏自带的旧存档兼容路径，读取后 cleared=12）。进入方式是真实点击：旅程册 → 风铃湖畔 → 继续旅程。
- 失败注入：Playwright 拦截 `/assets/region_lakeside/*` 请求。

## 已知结果（day 首跑日志）
- 湖畔正常进入（r04-lake-01），decodeVertexBuffer 0，[object Set] 0
- 首次进湖畔最长一帧 382.6 ms（冷启动，持久 profile 第一次）；之后 night 649.9 ms、mergeoff 133.3 ms、day 复测 135.3 ms
- 棋盘 DC：合并开 **70**（白天、夜间相同），`?lakemerge=off` **103** → **都 >60，不合格**；只看背景时合并开 4，关 37。首跑白天有教学弹窗遮挡，测得 46，不作数。
- 旅程（白天首跑）DC：approach 中位 114 / 最高 137，桥上 292 / 297，到达 281 / 295，level-loading 265；heap 峰值 149 MB，纹理 103→115 MB
- 失败注入：屏幕只出现「湖畔暂时没准备好，先回小岛吧」，人回到小岛
- 环境声：lake-play 在到达段（59.4 s）开始，棋盘上一直在循环（lake-xloop）；waves-gate=lakeside 后海浪停止
- 切日夜（白天进湖畔）：夜里主光 162/181/229、照度 43,750，雾 44/54/84，背景相机 clear 28/39/64；切回白天恢复 255/203/153。

## r2 补充（参考数据，r2/raw、r2pack）
- 旅途 DC 峰值（白天/夜间/白天 mergeoff）：桥上 297/290/299，到达段 295/293/293；heap 峰值 149/163/145 MB；纹理约 103 MB（进棋盘后 115 MB）
- 棋盘 DC：白天、夜间 70，mergeoff 103（不合格）
- A–E：白天/夜间/mergeoff 都是 A0 B0 C=favicon 404（白名单）D0 E0。失败注入：A0；B 是 4 条 4928 bundle 加载失败和 3 条 [QF_LAKE]（journey prepare failed / not reached / lakeside-fallback）；D 是 8 条被有意拦掉的 region_lakeside 请求；屏幕只显示友好提示（r2/raw/lk_fail_fail_toast.png）
- 视频与全量截图因 Mac 断连和磁盘空间问题没有回传，已在 Mac 上删除
