# T0 GROKBOT_AUTOPLAY：调试自动演示、GB_MARK 打点、触摸注入（GGbot）

- 任务：T0（含追加的音频/镜头打点和触摸注入）。基线：`near` 41fabe7。`baseline` 1ef9f1d、`matte` 26b6305、T1 l123/l12 的 after 都能直接用，它们相关的源码 SHA 一样或已列进白名单。
- **不改任何现有游戏文件。** 全部代码都在 `tools/`，`creator-build-project/` 外面，不参与导入和构建。只有自动演示构建才用 `install.sh` 拷进 `assets/scripts/grokbot-autoplay/`，构建完用 `uninstall.sh` 删掉。
- 正式包没装这些文件，所以零字节、零字符串。不靠压缩器做死代码剔除。
- 驱动方式只看 WorldFlow 状态，不写死镜头时长。等到 `home`/`island` 且空闲才动手。T2+ 改了路径或镜头，不用改 T0。

## 文件
| 文件 | 作用 |
|---|---|
| `src/GrokbotAutoplay.ts` | 运行时胶水：找到场景里的 WorldIntegrationBoot（按类名找），走真实处理器；观察者负责 app/音频/分段/镜头打点；平台触摸后端 |
| `src/GrokbotAutoplaySequencer.ts` | 出门→海岛→回屋的纯状态机，外加启动参数解析（不依赖 cc） |
| `src/GrokbotTouchScenarios.ts` | 场景格式、T1 预设、场景执行器、导出 automation_game_action 命令（不依赖 cc） |
| `src/GrokbotMarks.ts` | **GB_MARK 名字的唯一登记表**。新增打点只往这里加一行；没登记的名字照样输出，但会带 `unregistered=1` |
| | `ui:cheer-text`（T6 飘字）：只有工程里有 `CheerTextHost` 时才会出现，包住它的 `show()` 记下档位、结果（show/replace/skip/no-board）、位置来源（clear/center）、坐标。 |
| `src/*.meta` | 固定 uuid（92fca7bf / 59ace17b / 24830118 / 16cf1f79，目录 d370c13f） |
| `prelude/gb-touch-prelude.js` | 只用于自动演示构建：`inject_prelude.sh` 把它加到 game.js 最前面，记下所有 wx.onTouch* 监听，回放合成的原始触摸 |
| `install.sh` / `uninstall.sh` | 前置 SHA 校验（`prereq-allowlist.txt`）。不跟随符号链接，失败就整体撤回；卸载前核对 manifest |
| `inject_prelude.sh` | 在构建产物里加 prelude，用 `--mode` 当构建宏；`--remove` 恢复原样 |
| `check_release_strip.sh` | 检查正式包是否干净；`--expect-present` 反过来确认自动演示包里确实有 |
| `test/build_and_run.sh [T1包目录]` | 盒子上的全部测试（esbuild 0.21.5 / typescript 5.4.5，见 test/package.json，只供开发用） |

## 开关（构建宏或启动 query；query 优先）
- `autoplay=out-and-back`（装上后的默认值）| `observe`（只打点，供人手动玩）| `touch` | `off`
- 宏写法：`inject_prelude.sh <out> --mode touch:t1` 等于 `autoplay=touch&gbScenario=t1`
- 其他参数：`gbHold=3000`、`gbStart=2000`、`gbDoor=direct|drag`、`gbReturn=panel|direct`、`gbScenario=t1|t1-multi|名字,名字`、`gbVariant=l123|l12`、`gbExport=wx|only`
- 自定义场景：`inject_prelude.sh <out> --scenarios my.json`，会写入全局 `GROKBOT_TOUCH_SCENARIOS`

## 真实路径
- **出门**：门可见时，用 RoomExploreOverlay 自己的 down/up 处理器，在门把手位置合成触摸。门不在画面里时，过同样的闸，再调它的 leave 回调。两种都会走到 `WorldIntegrationBoot.invoke` → `worldCommands().leaveHome()`。
- **回屋（没装 T1）**：岛上 dock 调 `open('settings')`，再调 `dispatch(returnHome)`，等于点了"回屋小憩"。
- **回屋（装了 T1）**：在灯塔上注入一次原始触摸，经过 IslandHomeInteraction 的 L1/L2/L3。灯塔位置用 T1 的 `hitLighthouse` 真实射线在网格上逐点找出来。

## 触摸场景格式
```json
{"name":"t1-hold-hud","expect":"stay","needs":["lighthouse"],"observeMs":2000,"settleMs":600,
 "expectAlt":{"variant":"l12","expect":"return"},
 "steps":[{"at":0,"finger":1,"phase":"start","target":"lighthouse"},
          {"at":200,"finger":2,"phase":"start","target":"hud","name":"Island-bag"},
          {"frame":40,"finger":2,"phase":"move","dx":12},
          {"at":600,"finger":1,"phase":"end"},
          {"at":900,"finger":2,"phase":"end"}]}
```
- 每一步写 `at`（毫秒）或 `frame`（帧），二选一，都从场景开始算。时间相同的步骤在同一帧里按列表顺序发出。
- `phase` 可以是 start、move、end、cancel。
- 目标可以写 `target`，取值有三种：`lighthouse` 需要 T1；`sea` 是不在灯塔上的场景点；`hud` 要配 `name`，填 UI 节点名。也可以直接写 `n:[x,y]`，按屏幕归一化，左上角为原点。
- move、end 不写目标时，沿用这根手指上一次的位置。`dx`/`dy` 是额外偏移，单位 CSS px。
- 判定看 WorldFlow 在观察窗口里进入 `walking-home` 的次数：0 次是 `stay`，1 次是 `return`。
- T1 预设（`t1`）：hold-hud、quick-tap-hud、same-frame-tap-hud、hold-sea、tap-sea、drag-lighthouse、single-tap-lighthouse、double-tap-lighthouse。`t1-multi` 是其中 5 个多指和单击场景。
- `gbExport=wx` 会额外为每个场景打一条 `touch:wx-script`，内容是 `ga --action touchstart|touchmove|touchend --x --y` 加上 sleep，坐标在 586×1266 图像空间，可以交给 `repo-tools-mac/wx_game_input.sh` 里的 `ga()` 执行。多指重叠的场景会标 `supported=0`，因为 automation_game_action 没有手指 id。`gbExport=only` 只导出，不注入。

## Mac 命令（在隔离副本里跑，不要在原工程里跑）
```sh
ORIG=/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-board-teardown-validation-20261010
C=/Users/shineanl/Documents/Codex/2026-10-09/task/cocos-migration-local-20261009/tooling/creator-3.8.8/CocosCreator.app
T0=/path/to/repo/tools/grokbot-autoplay          # 本目录（work/GGbot-t0 分支）
ISO=~/grokbot-tests/t0-autoplay-$(date +%Y%m%d-%H%M)
rsync -a --exclude build --exclude temp --exclude local "$ORIG/" "$ISO/"     # 要测 near/T1，就先把对应候选装进 ISO
bash $T0/install.sh "$ISO" --check && bash $T0/install.sh "$ISO"
# build-options-t0.json = phase0-build-options.json，只把 outputName 改成 grokbot-t0-autoplay-wechat（debug 保持 false，帧时间才有参考价值）
"$C/Contents/MacOS/CocosCreator" --project "$ISO/creator-build-project" --build configPath=$HOME/grokbot-tests/t0/build-options-t0.json   # 期望 exit 36
OUT="$ISO/creator-build-project/build/grokbot-t0-autoplay-wechat"
bash $T0/check_release_strip.sh "$OUT" --expect-present
bash $T0/inject_prelude.sh "$OUT" --mode out-and-back      # 或 observe / touch:t1 / touch:t1-multi
WX_PROJECT="$OUT" zsh repo-tools-mac/wx_game_input.sh shot pre   # 用开发者工具打开 $OUT，照常截窗口
# GB_MARK 会写到控制台，同时写入 wx.env.USER_DATA_PATH/GB_MARK.log
find ~/Library/Application\ Support/微信开发者工具 -name GB_MARK.log -newer "$OUT/game.js" 2>/dev/null
# 收尾
bash $T0/inject_prelude.sh "$OUT" --remove; bash $T0/uninstall.sh "$ISO"
# 任何正式构建之后：
bash $T0/check_release_strip.sh <正式构建输出目录> "$ISO"        # 期望 CLEAN，exit 0
grep -rIlE 'GB_MARK|GROKBOT_AUTOPLAY|__gbTouch|GrokbotAutoplay|GrokbotMarks|grokbot-autoplay' <正式构建输出目录>   # 期望没有输出
```

## 回退
- 工程：`uninstall.sh "$ISO"`，按 manifest 逐个核对后删除，源码树恢复成装之前的样子。
- 构建产物：`inject_prelude.sh "$OUT" --remove`，或者直接删掉自动演示构建目录。
- 仓库：分支 `work/GGbot-t0` 只新增了 `tools/grokbot-autoplay/`，删掉这个分支或目录就行。
