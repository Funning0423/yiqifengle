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
| `src/GrokbotCombo.ts` | `autoplay=combo`：合成帧、期望值、判定、执行状态机（不依赖 cc） |
| `src/GrokbotMarks.ts` | **GB_MARK 名字的唯一登记表**。新增打点只往这里加一行；没登记的名字照样输出，但会带 `unregistered=1` |
| | `ui:cheer-text`（T6 飘字）：只有工程里有 `CheerTextHost` 时才会出现，包住它的 `show()` 记下档位、结果（show/replace/skip/no-board）、位置来源（clear/center）、坐标。 |
| | `audio:unlock`（全局首次触摸解锁声音，只打一次）：`source=wx\|canvas\|cocos\|room-swipe\|door-tap event=touchstart\|touchend\|leave ms=<手势时刻> replay=0\|1 via=__audioUnlock gestureSeen=1 status playbackState playing`，字段取自 `GameAudio.musicDiagnostics()`。来自 AudioUnlock 的 `__audioUnlock.onUnlock`；没有 AudioUnlock 的老构建改为轮询 `gestureSeen`，记成 `source=unknown via=gestureSeen-poll`。`audio:unlock-hook` 表示订阅状态。`audio:playback from= to=` 记录 playbackState 的每次变化，正常顺序是解锁后 `idle→pending→playing`，而且要在 `state:island` 之前。测试：`GB_UNLOCK_DIR=<work/GGbot-audiounlock>`。 |
| | `ui:tap`（T9 岛屿道具）：`target=signpost|bag|book|settings phase=press|confirm blocked=0|1 props=0|1`。来自 T9 的 `__worldIntegration.onPropTap`（真点和注入点都会有）；没合 T9 时不出现。`ui:tap-hooked` = 订阅成功。 |
| | `anim:foot` / `anim:apron-lift`（走路驱动，新的 `anim` 组）：`anim:foot ... event=foot:R bone=foot.R body=L clip=walk_loop phase=0.000 cycle=n pos=x,z`（每次脚跟着地，来自按距离推进的走路相位；bone 和 body 左右相反，body 是身体左右），`anim:apron-lift ... strength=full|soft dur=秒`。来自 `__worldIntegration.onFoot / onApronLift`；没合走路驱动时不出现。`anim:hooked` = 订阅成功。 |
| | `device:caps`（新的 `device` 组，**只打一次**）：世界加载好时（女主角和围裙已经绑定），最迟装上后 20 s 打。字段：`gfxAPI=<数字>(<cc gfx.API 名>) webgl=1\|2 glSource=device\|canvas OES_texture_float OES_texture_half_float rgba32fSampled maxVertexTextureUnits maxTextureSize maxVertexUniformVectors platform model system SDKVersion brand benchmarkLevel pixelRatio apronRenderer=found\|missing apronMorphEnabled=1\|0 apronMorphTargets=<每个子网格的目标数>\|null apronDriver=<__worldIntegration.morph().status> glVersion renderer vendor unmaskedRenderer unmaskedVendor`。值里的空白换成 `_`，取不到写 `-`；`apronMorphTargets=null` = 网格没有形变数据（现在 int/v1 的 glb 就是 null）。`apronDriver` 要合了 work/GGbot-morph 才有，之前是 `-`。每一项都包了 try/catch，拿不到只会是 `-`，不会抛异常。WebGL2 的浮点纹理是核心功能，扩展列表里通常没有 `OES_texture_float`，看 `rgba32fSampled`。测试：`GB_CAPS=webgl1\|throw\|nodevice`、`GB_CAPS_APRON=scene\|driver`。 |
| `src/*.meta` | 固定 uuid（92fca7bf / 59ace17b / 24830118 / 16cf1f79 / c0b1e7a5（Combo），目录 d370c13f） |
| `prelude/gb-touch-prelude.js` | 只用于自动演示构建：`inject_prelude.sh` 把它加到 game.js 最前面，记下所有 wx.onTouch* 监听，回放合成的原始触摸 |
| `install.sh` / `uninstall.sh` | 前置 SHA 校验（`prereq-allowlist.txt`）。不跟随符号链接，失败就整体撤回；卸载前核对 manifest |
| `inject_prelude.sh` | 在构建产物里加 prelude，用 `--mode` 当构建宏；`--remove` 恢复原样 |
| `check_release_strip.sh` | 检查正式包是否干净；`--expect-present` 反过来确认自动演示包里确实有 |
| `test/build_and_run.sh [T1包目录]` | 盒子上的全部测试（esbuild 0.21.5 / typescript 5.4.5，见 test/package.json，只供开发用） |

## 开关（构建宏或启动 query；query 优先）
- `autoplay=out-and-back`（装上后的默认值）| `observe`（只打点，供人手动玩）| `touch` | `combo`（验证连击鼓励音和飘字，见下节）| `off`
- 宏写法：`inject_prelude.sh <out> --mode touch:t1` 等于 `autoplay=touch&gbScenario=t1`；`--mode combo` 等于 `autoplay=combo`；`--mode combo:here` 等于 `autoplay=combo&gbComboEnter=none`
- 其他参数：`gbHold=3000`、`gbStart=2000`、`gbDoor=direct|drag`、`gbReturn=panel|direct`、`gbScenario=t1|t1-multi|t9|名字,名字`、`gbVariant=l123|l12`、`gbExport=wx|only`
- 自定义场景：`inject_prelude.sh <out> --scenarios my.json`，会写入全局 `GROKBOT_TOUCH_SCENARIOS`

## 真实路径
- **出门**：门可见时，用 RoomExploreOverlay 自己的 down/up 处理器，在门把手位置合成触摸。门不在画面里时，过同样的闸，再调它的 leave 回调。两种都会走到 `WorldIntegrationBoot.invoke` → `worldCommands().leaveHome()`。
- **回屋（没装 T1）**：岛上 dock 调 `open('settings')`，再调 `dispatch(returnHome)`，等于点了"回屋小憩"。
- **回屋（装了 T1）**：在灯塔上注入一次原始触摸，经过 IslandHomeInteraction 的 L1/L2/L3。灯塔位置用 T1 的 `hitLighthouse` 真实射线在网格上逐点找出来。

## autoplay=combo（连击鼓励音和飘字）
- 用的是**喂帧**，不是滑动。要保证出 2～5 波连消，得对带种子的引擎（含掉落补充）做搜索，T0 不值得做这个。
- 流程：
  1. 走真实 UI 路径进关卡：门 → 海岛 → 点“继续旅程 →”（`mainline` WarmButton）。
     - 有触摸后端（装了 prelude 或在 web 上）时，在按钮中心注入一次真实触摸。
     - 没有后端，或注入后 2 s 内没反应时，改用按钮本来要执行的那个动作 `WorldIntegrationBoot.invoke(composition.enterMainline)`，只调一次，并在 `via=` 里写明。
  2. 等到 `ManagedMobileBoardUI` 是 `run.ready` 且没有弹窗，超过 `gbComboBoardMs`（默认 30 s）也照样开始喂。
  3. 往 `GameAudio.instance.onBoardFrame` 喂 1 个 `{kind:'action'}`，再每隔 `gbComboGap`（默认 400 ms）喂一个 `{kind:'clear'}`，共 `gbComboClears` 个（默认 5，范围 2～5）。
- 合成帧的形状照搬主线 session 的真实 clear 帧：`wave.removed=[{index,id,type,special}]`。棋盘能读到格子时，id/type 用真实值。
- 每波取一行横向相邻的 3 格（第 1～5 行，第 2～4 列）。所以 CheerText 走 `source=clear`，按格子位置显示；没有棋盘时记 `no-board`。
- 每帧都带 `gbSynthetic:1`、`token:'gb-combo:<i>'`，`audio:clear` 会多出 `synthetic=1`，不会和玩家消除混淆。
- 连击段位、音效、onCheer、CheerText 全部由**真实的** GameAudio / CheerTextHost 判定。T0 只订阅 `GameAudio.onCheer`（只读），另外数自己观察者打出的 `audio:sfx`、`ui:cheer-text`。
- 判定：4 个段位按 0,1,2,3 的顺序各触发一次 onCheer，各出一次飘字（show 或 replace），各播一次 `sfx_cheer_1_great`…`sfx_cheer_4_unbelievable`（accepted=1）。
  - GameAudio 静音或挂起时，它按设计会丢掉鼓励音，这时判定为不出声，飘字仍然必须出现（`sfx=skipped-by-GameAudio(muted)`）。
- 结束后停在关卡里，不回家。
- 参数：`gbComboEnter=level|none`、`gbComboClears=2..5`、`gbComboGap=100..2000`、`gbComboBoardMs=0..120000`、`gbStart`。
- 示例（时间、帧号省略）：
```
GB_MARK combo:armed ... enter=level clears=5 gapMs=400 path=feed
GB_MARK combo:enter-level ... via=mainline-button-touch(wx-prelude)@195,722
GB_MARK combo:board-ready ... boardState=run.ready
GB_MARK combo:start ... path=feed frames=6 clears=5 gapMs=400 board=ready boardState=run.ready muted=0 suspended=0 cheerText=1 onCheer=1
GB_MARK combo:frame ... i=0/5 token=gb-combo:0 kind=action resets=cascade
GB_MARK combo:frame ... i=1/5 token=gb-combo:1 kind=clear cascade=1 cells=9,10,11 expectSfx=sfx_match_normal expectTier=-1
GB_MARK combo:frame ... i=2/5 token=gb-combo:2 kind=clear cascade=2 cells=16,17,18 expectSfx=sfx_combo_1 expectTier=0 expectClip=sfx_cheer_1_great
GB_MARK ui:cheer-text ... tier=0 word=Great! decision=show source=clear x=0 y=108 replaced=-1
GB_MARK combo:cheer ... level=0 word=Great! expectClip=sfx_cheer_1_great token=gb-combo:2 cells=16,17,18
GB_MARK audio:sfx ... name=sfx_cheer_1_great accepted=1 clip=sfx_cheer_1_great vol=1 effVol=1 loop=0 dur=... muted=0 suspended=0
GB_MARK audio:clear ... wave=2 tier=combo_1 synthetic=1 token=gb-combo:2
  ...（第 3/4/5 波分别是 Excellent/Amazing/Unbelievable，decision=replace replaced=前一档）
GB_MARK combo:done ... frames=6 cheers=4 cheerSfx=4 texts=4 totalMs=...
GB_MARK combo:result ... expect=0,1,2,3 tiers=0,1,2,3 sfx=sfx_cheer_1_great,sfx_cheer_2_excellent,sfx_cheer_3_amazing,sfx_cheer_4_unbelievable text=0,1,2,3 textSource=clear,clear,clear,clear muted=0 suspended=0 tiersOk=1 sfxOk=1 textOk=1 PASS
```
- 中途失败时会打 `combo:done aborted=1 phase=… reason=…`，然后是 `combo:result FAIL reason=…`。
- `combo:here` 是原地喂、不进关卡。在家里用会得到 `text=…:no-board` FAIL，只适合已经在关卡里的情况。

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
bash $T0/inject_prelude.sh "$OUT" --mode out-and-back      # 或 observe / touch:t1 / touch:t1-multi / combo / combo:here
WX_PROJECT="$OUT" zsh repo-tools-mac/wx_game_input.sh shot pre   # 用开发者工具打开 $OUT，照常截窗口
# GB_MARK 会写到控制台，同时写入 wx.env.USER_DATA_PATH/GB_MARK.log
find ~/Library/Application\ Support/微信开发者工具 -name GB_MARK.log -newer "$OUT/game.js" 2>/dev/null
# 收尾
bash $T0/inject_prelude.sh "$OUT" --remove; bash $T0/uninstall.sh "$ISO"
# 任何正式构建之后：
bash $T0/check_release_strip.sh <正式构建输出目录> "$ISO"        # 期望 CLEAN，exit 0
grep -rIlE 'GB_MARK|GROKBOT_AUTOPLAY|__gbTouch|GrokbotAutoplay|GrokbotMarks|grokbot-autoplay' <正式构建输出目录>   # 期望没有输出
```
- 注意：int/v1 的 `ui/CheerText.ts`（T6）里有一行**注释**提到 “T0 GB_MARK observer”。debug=false 的正式包会经过 terser，注释被去掉，所以照样 CLEAN（盒子上用 terser 验证过）。但如果用 debug=true 或带 sourcemap 的包去跑 check_release_strip.sh，会报 NOT CLEAN，误报在 CheerText 这一处。

- combo 也可以不加宏，直接用启动 query：`autoplay=combo`（可加 `&gbComboGap=400&gbComboClears=5`）。看 `GB_MARK.log` 里的 `combo:result` 是 PASS 还是 FAIL。
- 真实 Cocos 构建的两个坑（int/v1 5d66c30 Mac 实测发现，已修）：
  - `WorldIntegrationBoot` 挂在 **Scene 节点本身**，而 Cocos 的 `getComponentInChildren` 不查自己。`findBoot()` 现在先 `scene.getComponent`，再查子节点。测试桩已改成 Cocos 的真实语义（默认挂在 Scene 上，`GB_BOOT_ON=child` 测挂在子节点）。其他查找都走 `js.getClassByName` + 静态 `instance`，不受影响。
  - Cocos 构建用 babel loose 转 ES5：`[...map]` 会变成 `[].concat(map)`。T0 源码里不再对 Map/Set/迭代器用展开或 for-of，统一 `Array.from(...)`。
  - `build_and_run.sh` 新增 loose-ES5 任务：先用 babel preset-env（loose:true，targets ie 11）只转译 T0 源码，再跑 unit/out-and-back/touch/combo 关键路径，并检查输出里没有 `[].concat(Map/Set)`。需要 GB_TOOLS 里装 `@babel/core@7.29.7 @babel/preset-env@7.29.7 @babel/preset-typescript@7.28.5`（见 test/package.json）。
- 盒子上的测试：`GB_INT_DIR=<int/v1 检出目录> test/build_and_run.sh [T1包目录]`。combo 跑的是 int/v1 **真实的** `audio/GameAudio.ts` 和 `ui/CheerText.ts`（含 CheerTextModel），引擎是模拟的。没设 GB_INT_DIR 时跳过这部分。

## 回退
- 工程：`uninstall.sh "$ISO"`，按 manifest 逐个核对后删除，源码树恢复成装之前的样子。
- 构建产物：`inject_prelude.sh "$OUT" --remove`，或者直接删掉自动演示构建目录。
- 仓库：分支 `work/GGbot-t0` 只新增了 `tools/grokbot-autoplay/`，删掉这个分支或目录就行。

## T9 道具命名目标（touch 模式）
- 目标名：`signpost`（路牌 = mainline 命中区）、`bag`（Island-bag）、`book`（Island-journal）、`settings`（Island-settings）。自定义场景可直接写 `{"finger":1,"phase":"start","target":"bag"}`。
- 预设组 `t9`（`autoplay=touch&gbScenario=t9` / 宏 `--mode touch:t9`）：t9-tap-bag、t9-tap-book、t9-tap-settings（各开弹层、不回屋，清理时关掉）、t9-press-signpost（按下再 cancel：只有 press，不进关卡）。
- 期望 GB_MARK：每个按钮 `touch:start ... target=bag` → `ui:tap target=bag phase=press blocked=0` → `ui:tap target=bag phase=confirm blocked=0`；路牌只有 `phase=press`。
- 盒内测试：`GB_T9_DIR=<work/GGbot-t9> build_and_run.sh <T1_DIR>` 跑真实 T9 IslandJourneyOverlay + IslandPropTaps。
