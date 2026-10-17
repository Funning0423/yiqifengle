# PR #58 草甸 v7.5（0b1181d）验收

## 进度
- 20:42 开始
- 21:00 Mac 临时 clone ~/qf-pr58-tmp（push=DISABLED）正在拉取 PR58（基线 edc65d5 = int/v2-slim，可复用 r2 的改前草甸录屏 14_before）
- 21:20 构建：临时 clone 里没有 library，env_meadow.glb 随整个项目重新导入（library/bb/bb978abb… 已生成，微信包里有 .bin 和贴图子资源）；web 构建 exit 36。
- 21:20 微信构建：tools/wechat-build-options.json 的初始场景已失效（FirstsliceImport），改用 wechat-region-flow-test-build-options.json（WorldR5Integration）。settings/v2/packages/builder.json 里的标题图写死了旧机器的绝对路径，只在临时 clone 里改成本地 tools/branding（未提交）。

## 微信小游戏包大小（上限：主包 4 MiB，总包 24 MiB）
| 构建 | 主包 | 总包 | 结论 |
|---|---|---|---|
| debug（region-flow-test 原配置，debug=true） | 4.23 MiB（4,438,188 B） | 29.89 MiB（31,339,002 B） | 主包超、总包超 |
| release（同配置，debug=false） | 1.78 MiB（1,861,856 B） | 25.97 MiB（27,230,094 B） | 主包通过；总包超 1.97 MiB，不通过 |

release 各分包：region_skycity 8.34、region_meadow 4.09、static_seat_preview 3.70、region_island 3.29、board_art 2.55、main 1.04、audio_bgm_island 0.48、resources 0.41、internal 0.28（MiB）。
- 21:25 草甸录屏 3 段已传回（白天 p750、夜间 p750、白天 SE），Mac 上已删
- 21:28 切片和改前|PR58 并排视频已生成

## PR #58 @0b1181d 草甸 v7.5：结论
录屏：raw/20_pr58_{day_p750,night_p750,day_se}.webm。白天时区 Etc/GMT-11（当地 12 点），夜间 Etc/GMT+2（当地 23 点），游戏 props.night 白天为 false、夜间为 true。草甸进场 t=27.8s，停留到 56s（>28s）；暂停 48.1s，继续 52.1s。时间点按 raw 文件计，并排视频的 0s 对应进场。

| 检查项 | 结论 | 依据和时间点 |
|---|---|---|
| 风车循环转动、暂停时停下 | 通过 | 叶片区帧差：转动时 1.9（白天）/3.3（夜间），暂停时 0.17/0.18，继续后 2.1/3.7 |
| 旗子循环飘动、暂停时停下 | 通过 | 帧差 2.3→0.4→1.8（白天），3.7→0.24→2.1（夜间）。旗子是纯黑色，建议美术确认 |
| 蝴蝶循环飞、暂停时停下 | 通过 | 下半屏帧差 0.76→0.11→0.70 |
| 蝴蝶 0.2–2.7s 从下半屏飞过，看得出拍翅 | 部分通过 | 0.2s 起路边下半屏有 2–3 只蝴蝶（frames/day_butterfly_0.2-2.7s.png）。0.4–0.9s 被新手提示遮暗。蝴蝶只有约 4–6 px，放大看翅膀轮廓在变（day_butterfly_zoom.png），但按 375 宽录屏不能确认拍翅，需要真机确认 |
| 鸟循环飞 | 不通过（没录到） | 进场后 28 秒里天空区帧差约 0.08，没看到鸟；上方被棋盘和标题栏挡住 |
| 大云底边圆鼓 | 无法完整判定 | 草甸画面只露出云的底部一小条，看起来是圆弧（frames/day_meadow_sky_top.png）；整朵云被顶边裁掉 |
| 不闪烁 | 通过 | A-B-A 检测 3 段都是 0 |
| 不突然消失 / 画面正确 | **不通过（阻断）** | 草甸**地面的草地整块不见了**，地平线附近有一条黑带，下方露出淡蓝底色，只剩路、草丛和风车。改前同一位置是绿色草地（frames/day_before_vs_pr58_40s.png）。夜间判定为夜，但草甸还是蓝天白天的样子（night40s_vs_se42s.png）。白天、夜间、SE 都一样，从进场 27.8s 起一直如此 |
| 微信包体 | **不通过** | release 主包 1.78 MiB（通过），总包 25.97 MiB，超出 24 MiB 上限 1.97 MiB；debug 主包 4.23 MiB，总包 29.89 MiB |

构建提示：导入时 env_meadow.glb 报 `KHR_materials_specular` 扩展不支持（只是警告）。地面缺失可能和新 GLB 的地面材质有关，需要开发用编辑器再查。
- 21:29 PR58 完成：Mac 上的 pr58 worktree、构建、日志都已删除，8811 服务已停，释放约 0.52 GB
