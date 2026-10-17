# PR #55 / PR #56 录屏验收 · 2026-10-15（进行中，分步写盘）

## 构建（Funning 的 Mac，临时目录 ~/qf-pr55-audit-tmp，独立 clone + worktree，未动现有工作区，未合并、未 push，push URL 已设为 DISABLED）
| 版本 | commit | Cocos 3.8.8 构建 |
|---|---|---|
| 改前 int/v2-slim | edc65d5 | exit 36（成功） |
| 改后 PR #55 ui/audit-fix-20261015 | 5575c78 | exit 36（成功） |
| PR #56 feat/sailboat-transition-20261015 | 8d50212 | exit 36（成功） |

## 已确认的阻断问题
1. **PR #55 夜间冷启动直接失败**：`World startup failed Error: Backdrop day/night uniform postcondition failed`（WorldFlowComponent.ts:135 新的 `paint()`）。白天正常启动，但在设置里切换昼夜时同样的错误会反复抛出。原因推测：新版本把材质回读值 v 和 sRGB 插值 c 做 0.02 的绝对比较，但回读值是线性空间；旧代码只判断夜间 max<0.5。改前同一环境下夜间正常。
2. **PR #56 构建无法启动（白天、夜间都一样）**：`Each script can have at most one Component.` → `TypeError: Cannot set properties of null (setting '_sealed') at CCClass`。原因是 `cine/SailboatTransitionPlayer.ts` 在同一个脚本里声明了 `@ccclass('SailboatPrefabSlot')`（L48）和 `@ccclass('SailboatTransitionDriver')`（L75）两个 Component，Cocos 规定每个脚本只能有一个 Component。
- 17:40 raw 批次1 已传回盒子 (72 webm)

## 批次1 原始结果（自动检查，17:40 ET）
- PR55 夜间 13 条全部冷启动 FATAL（Backdrop day/night uniform postcondition failed，约 3.5–11s）。
- PR56 (sail) 12/13 白天夜晚均启动 FATAL（"Each script can have at most one Component."）。
- PR55 白天 01/05 横幅文字扫描为空 ✓（改前有"地区流程测试 / 独立测试进度 · 主线 00"）。
- PR55 三指双击（CDP 触屏模拟）未打开调试面板；03/04/09/11 改用 Ctrl+Shift+D 重录中。
- 发现录屏只占画面左上 375 宽（录制未按 DSF 放大），compose 已改为先裁剪再放大

## 条目 2★ 主页白天木牌阴影（≥10s，已做逐帧亮度统计）
- 观察窗：录屏 30–42s（12s，10fps），木牌下方阴影带平均亮度。
- p750：改前 sd 12.3，单帧最大跳变 25.1（阴影随波浪消失/出现）；改后 sd 3.0，最大跳变 3.7 → 阴影连续。
- SE：改前 sd 4.7 / 跳变 15.4；改后 sd 1.6 / 跳变 3.6 → 连续。
- 对照条：frames/02_before_signpost_15s.png、frames/02_after_signpost_15s.png（改前 28.0–28.5、31.0–31.5、37.0–38.5s 等处阴影缺失；改后 15s 内都在）。
- 白天：通过。夜间：不通过（PR55 夜间启动 FATAL，无法观察）。
- 17:55 重录批次（03/04/09/11）已传回；旧版移入 raw_v1/
- 17:55 Mac 清理完成：停 8801/8802/8803 http.server，删除 ~/qf-pr55-audit-tmp（1.48 GiB），可用空间 11.0→12.5 GiB（另有中途删除的 raw 约 0.27 GiB）

## 逐帧闪烁检测（A-B-A，30fps，白天 p750，结果 frames/flicker_day_p750.txt）
- 改前、改后所有白天视频均未检出单帧闪烁。

## 条目 6 R4 昼夜 0.8s 渐变（白天启动后在设置里切换）
- 前景/海面：改前约 0.4s 硬切；改后约 0.6–0.7s 单调渐变，无回跳。
- 天空背景：改后**完全不变**（顶部 60px 亮度一直 81；改前切到 22）。控制台 7 次 "Backdrop day/night uniform postcondition failed"（paint→setWeight）。截图 frames/06_after_night_state.png：海面已入夜，天空还是白天的蓝色，层次断开。
- 时间点：06_after_day 32.8s 切到夜，34.8s 切回日。结论：不通过。

## 结论总表（改前 int/v2-slim edc65d5 ｜ 改后 PR55 5575c78 / PR56 8d50212）
夜间：PR55 全部 13 条冷启动 FATAL → 夜间一律不通过（阻塞 1）。下表为白天结论。

| # | 结论(白天) | 理由 / 时间点（改后视频时间） |
|---|---|---|
| 1★ | 通过 | p750/SE 文字扫描与逐帧均无测试横幅/调试字样；改前有"地区流程测试 / 独立测试进度"。 |
| 2★ | 通过 | 木牌阴影 12s 窗口亮度 sd 3.0（SE 1.6），无掉帧；改前 sd 12.3、阴影随浪消失。 |
| 3★ | 不通过 | ①三指双击（CDP 触屏模拟，ids 1–3 已到达 document）2.35s 未打开面板，需真机复核；Ctrl+Shift+D 可开，面板 13 个按钮齐全。②点「草甸→草甸01」6.5s 后没进关卡，而是播主页开场→落到小岛，180s 内未进草甸01（186.6s 超时）。 |
| 4★ | 通过（附注） | 三段布局、宝箱居中、全部领取→获得→收下一次领完；SE 不裁切（31.6–37.3s）。附注：收下后结算页文字显示"宝箱已打开"，但「全部领取」按钮仍在（37.3s），有重复领取的风险。 |
| 5 | 不通过 | 无 Cocos 默认启动页 ✓，进度文字+百分比 ✓；但启动图淡出只有约 0.25s（3.17–3.40s），要求 0.4s；0.20–0.40s 有黑帧；进度停在 12% 就切场景。 |
| 6 | 不通过 | 海面/界面约 0.7s 平滑 ✓；天空背景完全不变（postcondition 报错 ×7，32.8s/34.8s），夜里天空仍是白天的蓝色；设置面板没有先关再渐变。 |
| 7 | 不通过 | 31.2s 底栏图标在单帧内直接出现，没有淡入也没有上滑；文字标签晚约 0.2s 才淡入，看起来是逐个闪出。 |
| 8 | 通过 | 点昼夜按钮边缘（68×44 命中区左下角）两次都能切换（33.2s/35.1s）。天空不变属于 #6 的问题。 |
| 9 | 通过 | 暂停面板已去掉音乐/音效开关，「继续」「回到小岛」位置正常；设置里仍有音乐/音效（06 截图）。脚本没点到"设置"格（节点名变了），弹窗内部未录。 |
| 10 | 通过 | 15s 内云在慢慢移动，窗外能看到海鸥，动静轻，不抢眼。 |
| 11★ | 通过 | 第一次进 ToolIntroPanel；第二次无面板，只有"星光"Toast 小气泡；存储 qfl.ui.seenTools。 |
| 12 | 不通过 | PR56 构建启动 FATAL "Each script can have at most one Component."（约 4s），转场无法录制（阻塞 2）。 |
| 13 | 不通过 | 同 12。 |

全部白天视频 A-B-A 闪烁检测：0 处。

## 结论总表（最终版，18:30 ET）——取代上面的白天表
时间点：改后原始录屏（raw/*_after_* 或 *_sail_*）的秒数。并排视频在 sbs/ 下，命名为 `<条目>_before-vs-<after|sail>_<day|night>_<p750|se>.mp4`。
"夜间 FATAL"指 PR55 夜间冷启动 3.5–11s 报错 "World startup failed: Backdrop day/night uniform postcondition failed"，游戏进不去（阻断 1）。
"SE —"表示该条没有 ★，不需要录 SE。

| # | 白天 p750 | 夜间 | SE | 理由 / 时间点 | 并排视频 |
|---|---|---|---|---|---|
| 1★ 无测试横幅 | 通过 | 不通过（夜间 FATAL @3.6s） | 白天通过 / 夜间不通过（@3.5s） | 白天全程文字扫描和逐帧检查都没有横幅或调试字样；改前有"地区流程测试 / 独立测试进度 · 主线 00" | 01_before-vs-after_{day,night}_{p750,se}.mp4 |
| 2★ 木牌阴影 ≥10s | 通过 | 不通过（夜间 FATAL @7.6s） | 白天通过 / 夜间不通过（@5.5s） | 观察窗 30–42s：阴影带亮度 sd 3.0、最大跳变 3.7（SE 1.6 / 3.6），阴影帧帧都在；改前 sd 12.3、跳变 25（28.0、31.0、37–38.5s 处消失）。见 frames/02_*_signpost_15s.png | 02_…_{day,night}_{p750,se}.mp4 |
| 3★ 三指双击面板 | 不通过 | 不通过（夜间 FATAL @4.0s） | 白天不通过 / 夜间不通过（@7.8s） | 2.35s 三指双击（CDP 模拟）未打开面板，要真机复核；Ctrl+Shift+D 能打开（5.7s），13 个按钮齐全；6.5s 点"草甸01"后没进关卡，而是回到主页开场再落到小岛，到 186.6s 超时都没进草甸01 | 03_…_{day,night}_{p750,se}.mp4 |
| 4★ R2 结算宝箱 | 通过（附注） | 不通过（夜间 FATAL @6.3s） | 白天通过 / 夜间不通过（@7.5s） | 31.4s 结算三段布局，宝箱居中；33.9s 全部领取→获得→36.9s 收下，一次领完；SE 不裁切。附注：37.3s 回到结算后显示"宝箱已打开"，但「全部领取」按钮还在 | 04_…_{day,night}_{p750,se}.mp4 |
| 5 R3 加载衔接 | 不通过 | 不通过（夜间 FATAL @5.8s） | — | 无 Cocos 默认启动页 ✓，进度文字和百分比 ✓；启动图淡出约 0.25s（3.17–3.40s），没达到 0.4s；0.20–0.40s 有黑帧；进度到 12% 就切场景 | 05_…_{day,night}_p750.mp4 |
| 6 R4 昼夜渐变 | 不通过 | 不通过（夜间 FATAL @5.8s） | — | 32.8s 切夜 / 34.8s 切日：海面和界面约 0.7s 平滑；天空完全不变（报错 ×7），夜里天空仍是白天蓝；面板没有先关再渐变。见 frames/06_after_night_state.png | 06_…_{day,night}_p750.mp4 |
| 7 R5 进岛 UI | 不通过 | 不通过（夜间 FATAL @7.8s） | — | 31.2s 底栏图标单帧直接出现，没有淡入也没有从下滑回；文字标签晚约 0.2s 淡入，像逐个闪出。见 frames/07_after_hudfade.png | 07_…_{day,night}_p750.mp4 |
| 8 R6 昼夜按钮边缘 | 通过 | 不通过（夜间 FATAL @6.1s） | — | 33.2s、35.1s 点按钮边缘（命中区 68×44）都能切换 | 08_…_{day,night}_p750.mp4 |
| 9 R7 暂停面板 | 通过 | 不通过（夜间 FATAL @6.8s） | — | 32.0s 暂停面板已无音乐/音效开关，继续和回到小岛位置正常；设置弹窗里仍有音乐/音效（06 录屏）。脚本没点到"设置"格（节点改名），这一步未录 | 09_…_{day,night}_p750.mp4 |
| 10 R8 主页环境 | 通过 | 不通过（夜间 FATAL @7.5s） | — | 13.6–28.7s：云慢慢飘，窗外有海鸥，动静轻不抢眼 | 10_…_{day,night}_p750.mp4 |
| 11★ R9 引导一次 | 通过 | 不通过（夜间 FATAL @9.6s） | 白天通过 / 夜间不通过（@11.4s） | 约 31s 第一次进入弹 ToolIntroPanel；39.5s 第二次进入无面板，只有"星光"Toast | 11_…_{day,night}_{p750,se}.mp4 |
| 12 帆船正常（PR56） | 不通过 | 不通过 | — | PR56 白天和夜间都在约 4.0s 启动 FATAL "Each script can have at most one Component."，转场录不到（阻断 2） | 12_before-vs-sail_{day,night}_p750.mp4 |
| 13 帆船跳过（PR56） | 不通过 | 不通过 | — | 同 12（白天 @3.7s / 夜间 @4.2s） | 13_before-vs-sail_{day,night}_p750.mp4 |

统计（按条目算，13 条）：全部场景都通过的有 0 条。只看白天：通过 7 条（1、2、4、8、9、10、11），不通过 6 条（3、5、6、7、12、13）。夜间 13/13 不通过。SE 白天：1、2、4、11 通过，3 不通过；SE 夜间全部不通过。白天视频 A-B-A 单帧闪烁检测 0 处。

## 阻断问题
1. **PR55 夜间启动崩溃 / 昼夜切换报错**：WorldFlowComponent.ts:135 新加的 paint() 后置检查，把读回的 uniform 和按 sRGB 插值的期望值比较，容差 0.02。疑似线性空间和 sRGB 空间不一致（旧代码只检查夜间 max<0.5）。后果：夜间冷启动直接 FATAL；白天在设置里切换时，每帧抛错，天空背景不变。
2. **PR56 启动失败**：cine/SailboatTransitionPlayer.ts 一个脚本里有两个 @ccclass（L48 SailboatPrefabSlot、L75 SailboatTransitionDriver），Cocos 报 "Each script can have at most one Component."，随后 CCClass `_sealed` TypeError，白天和夜间都进不去。
3. **三指双击无法在网页模拟中触发**：touch 事件已到 document（ids 1–3），面板仍不开，要真机确认是不是缺陷；快捷键能用。
4. **草甸01 跳关失败**（PR55 面板）：跳转后回到主页开场和小岛，180s 内未进关卡。
- 18:32 并排视频补齐：sbs/ 共 36 个，全部能用 ffprobe 打开
