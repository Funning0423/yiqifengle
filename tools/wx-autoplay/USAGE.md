# QF_AUTOPLAY：微信開發者工具背景自動操作（只限測試包）

分支 `ggbot/b17r16-autoplay`（基於 `ggbot/b17-cand-r16` 4d864fe6）。工具全在 `tools/wx-autoplay/`，**不改任何遊戲原始碼**（`creator-build-project/` 零變動，沒有新增 .ts，所以也沒有 .meta）。

## 1. 開關與正式包排除
- 開關＝**建置後注入**：Creator 照常建置微信包後，執行
  `node tools/wx-autoplay/inject.cjs <微信建置輸出目錄> [--script 腳本.json]`
  它會把 `qf-autoplay.js` 和 `qf-autoplay/script.json` 複製進輸出目錄，並在 `game.js` 第一行加上 `require('./qf-autoplay.js')`（原檔備份為 `game.js.qfap-orig`）。
- 正式包：不執行 inject，包裡就**完全沒有**這些檔案和字串（0 位元組）。上傳前請跑
  `node tools/wx-autoplay/check-release.cjs <輸出目錄>`，印出 `CLEAN` 才算乾淨；有任何 `QF_AUTOPLAY`/`qf-autoplay` 會 exit 1。
- 第二道保險：執行時若 `envVersion==='release'` 直接不啟動。沒有腳本檔也不啟動。畫面上不顯示任何測試標記。
- 還原：`node tools/wx-autoplay/inject.cjs <輸出目錄> --remove`。

## 2. 腳本格式
座標一律用**設計解析度 390×844**（左上角為原點，y 向下）。執行時按 `windowWidth/390`、`windowHeight/844` 逐軸換算成 wx 觸控座標；DevTools 選 iPhone 12/13（390×844）時等於原值。
```json
{ "launchQuery": "?qfSkip=lakeside",   // 可選，只在測試包生效
  "stateEveryMs": 2000,                 // 可選，定時寫狀態（最小 500）
  "steps": [
    {"op":"tap","x":175,"y":458},
    {"op":"drag","x1":120,"y1":600,"x2":300,"y2":600,"ms":600},
    {"op":"wait","ms":1000},
    {"op":"waitState","name":"island","timeoutMs":30000,"stopOnFail":true},
    {"op":"screenshot","name":"island"} ] }
```
- `waitState` 的名稱可用：世界狀態（`home`、`island`、`level`…，即 `__worldIntegration.snapshot().state`）、`region:<id>`、`phase:<x>`、`explore`（自由探索開啟）、`lakeside:<mark>`。逾時（預設 90 s）→ `result.json` 的 ok=false；`stopOnFail` 預設 true（停止後續步驟）。
- 觸控注入：腳本啟動前先包住 `wx.onTouchStart/Move/End/Cancel`，記下引擎、轉接層以及 `IslandHomeInteraction` 的原始監聽器，再把合成的原始 wx 觸控事件送進**這些同一批監聽器**。所以會經過 Cocos 輸入→節點命中與吞觸控（如 `IslandLighthouseTouch`）→`ExploreInput`，和真手指同一路徑。不直接呼叫任何遊戲邏輯接口。tap＝Start→60 ms→End；drag＝每 16 ms 一個 Move。
- 腳本上限：500 步、最多 20 張截圖（超過直接拒絕）。

### `preTransition`（轉場前擺位，b18）
```json
{"op":"preTransition","key":"island-board","timeoutMs":90000,"tap":true,"recordMs":20000}
```
- 別名 `preT`。不需要啟動參數（DevTools `cli open` 不套用 project.config 的編譯條件／啟動參數）：會先設 `globalThis.__qfHooksEnable=true` 並呼叫 `__qfPreTransition('enable')`，再呼叫 `__qfPreTransition(key)` 只做擺位。
- 需要遊戲包含 `ggbot/pre-transition-hooks-fix`（或之後的整合包）；正式版 `envVersion==='release'` 下遊戲不註冊這個入口，enable 也會被拒絕。
- `tap:true`：擺位成功後，用一般合成觸控點回傳的 `tap.point`（被測轉場走真實輸入路徑）；`point` 為 null 時判失敗。`recordMs`：之後再等多久（錄影/取樣）。不加 `tap` 就只擺位，後面自己用 `tap` 步驟點。
- `timeoutMs` 預設 **90 s**（DevTools 從屋內到小島約 31.8 s）；湖畔 `lake-*` key 擺位要經過帆船＋兩段熱氣球，建議 `300000`。失敗（ok=false）時 `stopOnFail` 預設停止。
- `waitState` 的預設逾時也改成 90 s。

已校準的點擊座標（DevTools 390×844）：小島路牌 175,458；進關 282,575；繼續 195,497；規則彈窗 195,554；暫停 38,67；離開棋盤 195,560。

- 範例：`examples/example-pretransition.json`（island-board）、`examples/example-pretransition-lakeside.json`（skycity-lakeside：擺位後點「繼續旅程」看完熱氣球→湖畔棋盤；lakeside-exit：擺位後點暫停 38,67→離開棋盤 195,560→湖畔自由探索）。

## 3. 範例
- `tools/wx-autoplay/examples/example-island.json`：回到家→出門→進棋盤→離開棋盤→左右拖、上下拖視角→點草地→點水面。
- `tools/wx-autoplay/examples/example-lakeside.json`：`?qfSkip=lakeside`（隔離測試存檔）→湖畔降落→站 3 秒→拖視角→點地面→點水面。
- `tools/wx-autoplay/examples/example-ending.json`：`?qfPre=ending`（隔離測試存檔）→最後一關湖畔結算→點「继续」(Next)→WindWipe→結局→點「回小岛」(EndingHome，座標待校準)→回小島。
- **tap 座標是估計值，待校準**：第一次跑完看 `shots/` 再調整（例如離開棋盤按鈕位置 36,70）。`launchQuery` 是在引擎啟動前補上 `location.search`，在 DevTools 上是否生效**待實機確認**；若無效，`result.json` 會顯示 `region:lakeside` 逾時。
- 不重新建置也能換腳本：把新腳本寫到 `USER_DATA_PATH/qf-autoplay/script.json`（優先於包內的），或重新 inject。

## 4. 輸出檔案
寫在 `wx.env.USER_DATA_PATH/qf-autoplay/out/`，**每次啟動先整個清掉再寫**（重跑會覆蓋）：
- `console.log`：所有 console 輸出（上限 2 MB）
- `state.jsonl`：每步之後＋定時一行：state、region、phase、journeyPhase、exploreOpen、character（節點名＋世界座標，取場上第一個啟用的蒙皮網格的根節點，為推定值）、camera（位置、euler、fov）、fps、memory（`performance.memory`，DevTools 才有，手機可能是 null）、memoryWarnings、lastGroundTap、onWater（上限 2 MB）
  - **注意 onWater**：遊戲沒有「角色在水面上」的全域旗標，這裡是「最近一次點地面的結果是不是 water」（`onWaterSource` 有標明），不是角色真正的位置判定。
- `shots/NN-名稱.jpg`：寬 195 px、jpg 品質 0.6，最多 20 張（每張約 10–20 KB）
- `result.json`：每步結果、是否命中、耗時、監聽器數量、總結 ok；`consoleErrors`／`consoleErrorSamples`：遊戲的 console.error 次數（不含 `[QF_AUTOPLAY]` 自己的訊息）。**只要 >0 就判 ok=false**（驗收規則：Console Error 必須 0；腳本可設 `"allowConsoleErrors":true` 只用於診斷）。
- `state.jsonl` 的 `characterErr`：引擎類別在微信 cc 命名空間取不到時記錄，不會再把 undefined 傳給 getComponent（舊版因此每次取樣都報 Error 3804）。

Mac 上的位置（**需實機確認**，依官方說明推得）：
`~/Library/Application Support/微信开发者工具/<安裝路徑MD5>/WeappSimulator/WeappFileSystem/<隨機目錄>/wx3bdd911c5c06f591/usr/qf-autoplay/out/`
快速找：`find ~/Library/Application\ Support/微信开发者工具 -type d -path '*wx3bdd911c5c06f591/usr/qf-autoplay' 2>/dev/null`
也可在 DevTools 的「調試器→Storage/文件系統」裡看 `usr/qf-autoplay/out`。

## 5. 清理（Mac 磁碟緊張）
- 每次跑完把需要的檔案拷出後刪除：`rm -rf "<上面找到的路徑>/qf-autoplay/out"`
- 測試結束後也刪掉建置輸出目錄（只刪自己建的那個），或先 `inject.cjs --remove`。
- DevTools「清緩存→清除文件緩存」也會清掉 usr。

## 6. 開發者工具規則
- Mac 上**同一時間只開一個**微信開發者工具視窗，用完就關，留意記憶體。
- 這個工具不碰系統滑鼠、不用 cliclick，不會搶 Funning 的螢幕；開啟專案後放著讓它自己跑即可。
- 只殺自己啟動的 PID，不要用 pkill -f。

## Game failures (not only console.error)
result.json now also fails the run (`ok:false`, `failReason: game failures: N (...)`) when any of these is seen, even with `consoleErrors: 0`:
- `journeyFailures`: a state snapshot with journey phase `failed` (text `region>target: error`)
- `snapshotErrors`: `world.error` / snapshot `error` / snapshot threw
- `uncaughtErrors`: `wx.onError` and `wx.onUnhandledRejection`
- `hudSuppressedErrors`: `[OI_HUD] suppressed {"kind":"error"...}` log lines
Set `"allowGameFailures": true` in the script to report them without failing. `gameFailures` is the total.
