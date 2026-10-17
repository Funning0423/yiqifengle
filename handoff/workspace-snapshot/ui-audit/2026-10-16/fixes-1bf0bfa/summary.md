# fixes-1bf0bfa 复验（基线 a4a1041）
- HEAD 1bf0bfae…ae189，tree 77fc62ba…d7c，两边一致 ✅。bundle SHA256 5e897d42…b892c ✅（sha1 a20ded9a…）。b0020ed 底座 bundle 按 2MB 分 4 片传，sha1 一致。
- Mac fresh clone，push=DISABLED。确认没有别人在用 Creator，清掉 library/temp/build 后干净重建两端，退出码都是 36。
- 录屏（dpr2，__worldFlowLog，真实点击玻璃牌出门）：390 白天和夜间完整流程；320 白天和夜间；切后台测试 3 种：出门中的 walking-out 和 crossing-out，以及坐着时。另外补测了坐着时切后台后点「继续」能否恢复（logs/cont.cjs）。pageerror 0，HTTP≥400 只有 favicon，没有 .cconb，关卡削波 0。

## 结果
| 项 | 结论 | 证据 |
|---|---|---|
| N2b 地面夜间变暗 | ✅ | 夜间画面中段亮度（a4a1041 → 1bf0bfa）：90s 84.6→75.6，95s 81.2→64.0，100s 79.1→54.3，105s 76.8→49.1，110s 97.7→74.2。上一轮只有 85→84。白天不变（149.1→149.6、141.4→142.5…）。frames/N2b_night_travel_before_after.png |
| V1 出门途中切后台 | ✅ | 测了 2 个时间点，都会自动从座位重新出门，不用点「继续」，也不卡。① walking-out 中：12.49 hidden → 16.52 回到前台 → 16.52 standing → 47.33 island，**回前台到出门完成 30.8s**。② crossing-out（户外）中：27.44 hidden → 31.47 回前台 → 31.47 standing → 62.27 island，**30.8s**。正常从点牌（standing 8.24）到 island 39.03 也是 30.8s，所以就是完整重新出门一遍，没有额外卡顿。出门音轨重新播放（42.28 exit-cine play）。hidden 期间录音全静音。frames/V1_vis18000_sheet.png |
| V1 坐着时切后台 | ✅（和以前一样） | 7.18 hidden → 11.22 回前台，state=paused、needsResume=true，玻璃牌隐藏，要点「继续」。补测：点「继续」(195,725) 后变为 home、玻璃牌重新出现，点牌后进入 standing ✅ |
| M2 | ✅ | 干净构建后 git status 为空 |
| G2 排版居中 | ✅ | 叶子加文字这一组：390 左留白 19.0 / 右 16.5 CSS px（差 2.5px，基本居中）；320 左 13.0 / 右 11.5 |
| G2 叶子观感 | ❌ 不通过 | frames/G2_sign_proto_before_after_390.png（原型 / 旧版 / 新版）、G2_leaf_8x.png、G2_sign_before_after_320.png。① **边缘没有抗锯齿**：8 倍放大是硬的阶梯边，叶子和背景之间没有过渡像素，白色叶脉也是锯齿。② 造型：是一个平涂的浅黄绿椭圆加一条白斜线，没有叶柄，也没有明暗，饱和度低，压在磨砂玻璃上对比弱，看起来像药片或胶囊，不像原型里那片有层次的绿叶。③ 叶子到文字的间距：390 下是 13 CSS px，原型大约 5px，看起来还是“叶子一块、字一块” |
| 点牌出门 | ✅ | 390、320，白天、夜间都在约 1.07–1.1s 进入 standing |
| 包体 | ✅ **19,121,346 B** | 上限 24,641,536，余量 5,520,190。比 a4a1041 多 2,695 B，比预估的 19,123,386 还小 |

## 关键日志（walking-out 中切后台 vis3000）
```
12.498 [OI_WORLD_FLOW] event:hide  state:paused stable:home hidden:true
16.502 [GameAudio] music started {"first":false,"fadeIn":false}
16.519 [OI_WORLD_FLOW] event:state:home → 16.519 state:standing → 16.52 event:show (needsResume:false)
16.521 [QF_AUDIO] {"event":"ensure-ambience","state":"standing","gate":"ok"}
17.786 state:turning-out / 19.302 state:walking-out / 25.303 state:opening-door / 27.318 state:crossing-out
27.334 [GameAudio] exit-cine {"event":"play","offsetS":0}
47.329 [OI_WORLD_FLOW] event:state:island
```
crossing-out 中切后台（vis18000）：27.442 hide，27.443 exit-cine cancel:left-exit，31.468 standing/show，42.278 exit-cine play，62.274 island。回前台后风声残留：32.26 wind-level s=0.032，34.23 wind-pause，很轻，可以接受。

## 问题清单
| # | 时间点 | 严重程度 | 改法 |
|---|---|---|---|
| G2a | 主页玻璃牌叶子（7s 前任意帧） | 中（观感，不通过） | Graphics 填充没有抗锯齿：改成 SDF 或贴图（和牌面一样走 shader 里的 derivative AA），或者先用 2 倍分辨率绘制再缩小；也可以直接画一张 48×48 的叶子 PNG，几 KB |
| G2b | 同上 | 中 | 叶子造型照原型：两片叠在一起的叶子，深浅两种绿（例如 #6DBA3C / #A6DB6A），加叶柄和细的深色描边，饱和度提高。叶子尺寸缩到大约文字字高的 1.1 倍 |
| G2c | 同上 | 低 | 叶子和文字的间距从 13 CSS px 缩到约 5–6（本地 12px 换算到 CSS 约 5.7），重新整体居中 |
| N3 | 夜间旅程 90–110s | 低 | 地面变暗后，小路（浅灰）、彩虹桥和风车显得偏亮、突兀。小路可以按 0.6 左右的系数也压暗 |

## 桌面包
**没有替换，仍然是 a4a1041。** 玻璃牌是主页第一眼就能看到的元素，新叶子在观感上比 a4a1041 的 emoji 叶子退步了，按“有退步就不换”处理。N2b、V1、M2 都通过，只要叶子改好，下一轮就可以替换。

## 清理
已删掉 ~/qf-fx4-tmp，停掉服务和 headless Chrome，没有残留的 Creator。Mac 剩余空间：开工时 10,145,252 KiB；清理前 9,582,372 KiB；**清理后 10,137,080 KiB（约 9.67 GiB）**。
