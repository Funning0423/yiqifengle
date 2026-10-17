# 《咦 起風了》總交接文件（MASTER_HANDOFF）

> 產生時間：@@GEN_TIME@@（美東 EDT）。本文件給接手的 Grok Bot（新帳號）、Cursor CLI 與各 bot 使用。
> 交接分支：`handoff/20261017`（本機準備，**尚未推送**；目的地待 Funning 決定）。
> 交接分支基底：r4.1 集成線 `integration/build05-r41-20261017T125738Z` 當時的 HEAD `@@R41@@`（背景計時修正 77ef6ad 已到並已快轉進本分支；若 r4.1 再有新提交，需把本分支重新放到最終 r4.1 上）。

## 1. 專案概況
- 遊戲：《咦 起風了》微信小遊戲，引擎 **Cocos Creator 3.8.8**（Mac M4 上建置；box 上沒有 Creator，也無法截真實引擎畫面）。
- 玩法：小島／家中出門 → 旅途（草甸、湖畔、天空之城等地區）→ 棋盤關卡 → 結算 → 回小島。
- 主倉庫（box）：`/workspace/wechat-game/yiqifengle`。實際 Creator 工程在 `creator-build-project/`。
- 舊 origin：`https://github.com/Funning0423/yiqifengle`（**公開**倉庫）。交接要求推到**私有**倉庫，見 §9。
- 微信 AppID：`wx3bdd911c5c06f591`（工程設定，非密鑰；不碰週年小程式）。
- Funning 桌面測試包：build05 `09a1b8e`（湖畔驗收通過前不更新）。

## 2. 團隊分工
| 角色 | 負責 |
|---|---|
| **Grok Bot** | 產品總監 + 驗收（今晚 22:00 EDT 交給另一個帳號的 Grok Bot）。只有 Grok Bot 驗收才算通過 |
| **GGbot** | 實作、集成、測試；r4/r4.1 集成線、彩虹橋引擎實作、交接分支 |
| **Voice Bot** | 音訊（BGM、腳步、環境聲）+ 湖畔光照／補光 |
| **運鏡bot** | 鏡頭、hook、落點、Mac 錄屏；m1v2 布料片段 |
| **場景設計部** | 場景概念（彩虹橋、天空之城 B、野餐布 D、C_palm、竹排 S2 等） |
| **UI設計部** | UI 設計（結算畫面 v2.2、UI 市場調研） |
| **界面驗收部** | Mac 實機 UI 驗收（截圖、錄屏、DC、B 類錯誤） |
| **Oi** | 角色模型 |
| **Cursor CLI** | 在 Funning 的 Mac 上執行（建置、雜湊、headless 測試） |
| **ChatGPT 6 Pro** | 難題（目前：m1v2 布料自碰撞重做，見 PROBLEM_BRIEF） |

## 3. 開發計畫與目前狀態
1. **r4**：`integration/build05-r4-20261017T122042Z` = `2153a65`，內容已驗收，**Mac 驗收進行中**（界面驗收部 `ui-audit/2026-10-17/r4-2153a65`，仍在寫入）。初步發現（非最終）列在 §7.3。
2. **r4.1**：`integration/build05-r41-20261017T125738Z`（目前 `@@R41@@`），**待 Mac 驗收**。疊放：`74c696e` 提示牌移到托盤上方（原 260ea02）→ `fd1a39d` 運鏡bot 草甸落點（原 0ea1564）→ `b1e41b2` Voice 出門實時腳步（原 cfe6429）→ `77883aa` 出門／回家途中切後台不閃回椅子、續播 → `e4a05b9` 戶外腳步響度（原 f125cd2）→ `77ef6ad` r4.1b 回家路上的看門狗改用前景時間（後台停留任意長度都不會超時或閃回）。是否為最終 SHA 以 GGbot r4.1 worker 的通知為準。待 Grok Bot 接受：08→09 比 Build05 慢 1.19 s（最小屏 +2.98 s）。
3. **彩虹橋實作（r5）**：`ggbot/build05-r5-rainbow-bridge`（`fb37a67`，基於 r4.1 `fd1a39d`），**進行中**。方案：`product/2026-10-17/rainbow-bridge/IMPLEMENTATION.md`（概念已驗收）。要求：1 DC 有厚度和護沿的橋身、sin² 拱、alpha/飽和度調低、無白光縫、夜間不過曝、粒子 ≤88、新增包體 ≤約 35 KB；effect 尚未在 Creator 3.8.8 編譯（導數擴展、priority 語法、WebGL1 depthBias 待確認）；海島端帽需按真實落點重新貼地；最後以真機截圖驗收。
4. **天空之城方案 B r2（r5）**：`IMPLEMENTATION.md` §8.5（42° 舊版 §8.R1 作廢）。已交付未驗收。最陡 30°、7 屏離 UI ≥13.3 pt、比 Build05 最多 +4.59 s。待真機確認：城底沉入草地山谷是否可見；360×780 只多 0.3 pt。運鏡bot 鏡頭分支 `cine/skycity-bridge-r2-cam`（尚無提交）。
5. **野餐布 D**：r2 方向已認可；**r3 扣下不交付**；r3b 進行中（`product/2026-10-16/gameplay-integration-concepts/D_refine_r3b/`）。C_palm r2 排隊；竹排 S2 導出排隊（快照需在管線跑完後重新同步）；B/A/N1 未開始。
6. **m1v2 布料重做** → 交給 ChatGPT 6 Pro：`handoff/bots/m1v2-cloth-PROBLEM_BRIEF.md`（原檔 `team/cinematic/work/m1v2-clipfix/PROBLEM_BRIEF.md`）；目前出貨 SRC = `508b87b`（分支 `cine/m1v2-src-apron-ease`，獨立歷史根）。
7. **r5 其他項目**：湖畔整體補光讓屋頂、門框、樹幹一起變亮（需分部位）；涼亭／蘆葦／花未補光；園丁站位移到托盤上方可見區。
8. **草甸：她在畫面中的佔比太小**（待定方案）。
9. **雲橋／斷橋**：斷橋只顯示 `state_bridge_after`（兩個節點都保留），併入天空之城 B r2。
10. **結算畫面 v2.2**：程式碼 `d6a0019`（`ggbot/result-screen-on-688aad3~1`，已在 build05/r4 歷史），**未驗收**（Funning 尚未最終選定，真機驗收未做）。待改：底部按鈕留 16 pt、harness 說明字不可進包。
11. **UI-GUIDE.md**（UI設計部）未開始；解鎖提示移到旅程冊／路牌紅點，未排期。
12. `ggbot/build05-r42-fixes`（基於 e4a05b9）剛建立，進行中，尚無提交。
13. 湖畔驗收通過後：切里程碑、更新 Funning 桌面包（目前 09a1b8e）。

## 4. 各 bot 的 HANDOFF（倉庫內副本在 `handoff/bots/`）
| bot | 倉庫內 | box 原始路徑 |
|---|---|---|
| GGbot | `handoff/bots/ggbot-HANDOFF.md` | `/workspace/wechat-game/team/ggbot/HANDOFF.md` |
| 運鏡bot | `handoff/bots/cinematic-yunjingbot-HANDOFF.md`（舊版 `-v1.md`） | `team/cinematic/HANDOFF.md`（同內容在分支 `cine/cinematic-handoff-20261017`） |
| Voice Bot | `handoff/bots/voice-bot-HANDOFF.md`、`voice-bot-lakeside-playable-HANDOFF_yunjingbot.md` | `team/voice-bot/HANDOFF.md` |
| 場景設計部 | `handoff/bots/scene-design-HANDOFF.md` | `product/team/scene/HANDOFF.md` |
| UI設計部 | `handoff/bots/ui-design-HANDOFF.md` | `ui-design/HANDOFF.md` |
| 界面驗收部 | `handoff/bots/ui-audit-HANDOFF.md` | `ui-audit/HANDOFF.md` |
| Oi | `handoff/bots/oi-*.md` | `team/oi/*/evidence/*/HANDOFF.md`、`inbox-from-oi/20261016-build05-journey/handoff.md` |
| ChatGPT 6 Pro 題目 | `handoff/bots/m1v2-cloth-PROBLEM_BRIEF.md` | `team/cinematic/work/m1v2-clipfix/PROBLEM_BRIEF.md` |

## 5. 怎麼建置和跑測試
**測試套件（box 或任何有 Node 的機器）**
```bash
# 1) 安裝 TypeScript（/tmp/ts5 只存在於 box，新機器要自己裝）
npm install --prefix /tmp/ts5 typescript@5.9.3
# 2) Node 22（建議，需 ≥22.6；表頭應顯示 node=v22）
QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript npx -y node@22 tools/journey-integration/run-suite.cjs
# 3) Node 20（需要 stripTypeScriptTypes 的測試會 BLOCKED_NODE，exit 78，不算失敗）
QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript node tools/journey-integration/run-suite.cjs
```
- 套件會改寫 `tools/journey-integration/reports/*`、`output/*`，**不要提交這些改動**；兩個 Node 版本同時跑請用兩個 worktree。
- 已知非通過：
  - 含最終測試線（dc25cec）的分支（r4、r4.1）：Node 22 只有 `navigation-guard` BLOCKED_BROWSER（box 無瀏覽器）；Node 20 另有 `legacy-board-ui-pure`、`reward-background-return` BLOCKED_NODE。
  - 不含測試線的舊分支：已知 5 項 = production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract（FAIL）+ navigation-guard（BLOCKED_BROWSER）。
  - r4 結果：Node 22 91/92；r4.1（e4a05b9）：Node 22 94/95、Node 20 92/95，無 FAIL。
- 包體估算（box，上界）：`node /tmp/r4sd-min.cjs <A> <B>`（box 專用腳本）；真實包體以 Mac 建置為準。

**Mac 建置（Cursor CLI／界面驗收部）**
- Creator：`tooling/creator-3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator --project <repo>/creator-build-project --build configPath=<repo>/tools/wechat-build-options.json`（Web 用 `tools/web-build-options.json`）。
- 錯誤採集：Playwright（`lk.cjs` + `errs.py`，參考 `ui-audit/2026-10-17/a3b-a995c41/errs.py`）。
- 用完立即清理 Mac 上的建置、快取和錄屏（Funning 的 Mac 磁碟快滿）。

## 6. 驗收標準
- 微信包 ≤ **24,641,536 B**，每次交付報告與上一版的差值。
- 湖畔真實 DC ≤ **60**（引擎實測；Voice Bot 模型估算 53）。
- **60 FPS**；棋盤 UI 首幀 ≤16.7 ms，否則後台預建。
- **B 類錯誤**（Mac Playwright console `error` 數）：正常運行 0、不得出現 `[QF_LAKE]`；只攔 `water/lakeside-water` 的故障注入必須恰好 +1 且旅途完成。
- 套件：Node 22 只允許 navigation-guard BLOCKED，其餘 PASS。
- 交付必附**完整 SHA + 截圖／預覽影片**；**Grok Bot 驗收**才算通過。
- 標準桌面 build05（Funning 桌面包，09a1b8e）：wechat/ **19,125,680 B / 1241 檔**，hash `2b6919e9…92f2`。Cursor CLI 後來量到 19,127,044 B / 1245 檔，多出的 4 檔是微信開發者工具事後寫入的，包本身未變；**以 19,125,680 B 為準**。
- Voice Bot 腳步（r4.1）：戶外比音樂+環境低 10–12 dB、對齊 ≤40 ms、無突然變響；切後台 3 s / 10 s 不閃回椅子。
- 場景類：見 `handoff/bots/scene-design-HANDOFF.md` §4（R1–R6、格子 ≥88 px、≤45k 面、分包 ≤1.0 MiB、Funning 紅線：不加霧和體積光、顏色飽和、原創造型）。

## 7. 界面驗收部狀態摘要
### 7.1 已完成輪次
- 10-15：PR55/56/58 完成。
- 10-16：fixes-e2a03ec / 6bdbf5b / a4a1041 / 511953e 通過；fixes-1bf0bfa 留下 fail；**milestone-09a1b8e 通過（= 桌面包）**；readme-v2-a3 A3 fail；a3b-a17395c 通過；result-screen-c87881f 中止。
- 10-17：next-f60c8ec 除湖畔外通過；a3b-a995c41 通過；桌面包 hash 2b6919e9…92f2；next-r2-228df2f 被取代；next-r3-f3d3614 fail（lakemerge=off DC 71、10 個取樣點偏差、落點 FOV +6°）；**r4-2153a65 測試中**（快照只含當時已寫出的內容）。
### 7.2 媒體
- ui-audit 的所有媒體（webm/mp4/wav）與 `._*` 檔都沒有進倉庫，留在 box `/workspace/wechat-game/ui-audit/`；明細見 `handoff/EXCLUDED_FROM_SNAPSHOT.tsv`。
### 7.3 r4 初步發現（未定案，列為未結事項）
1. 關卡載入首幀太陽方向翻轉 180°。
2. 草甸、天空之城夜間進棋盤時顯示白天背景。
3. 切換幀 29–37 ms。
4. 草甸仍有卡頓。
5. 故障注入的 B 類錯誤數不是恰好 +1。

## 8. 立規（所有 bot 必須遵守）
- **不花錢**，只用免費素材（CC0 或自製），來源記在 `docs/audio-credits.md` 等。
- Funning 的 Mac 磁碟要及時清理（建置、快取、錄屏用完即刪）。
- **不在群裡討論**，只 1:1 私訊；結果直接交 Grok Bot。
- 共享 box：**只殺自己啟動的 PID**，禁止 `pkill -f`／`killall` 按名字殺。
- 對 Funning 使用**繁體中文**。
- 玩家看到的文案要友善；**玩家版本不能有測試橫幅**（harness 說明字、水印不可進包）。
- 只在自己的**新分支**提交；**不 force push、不直接改 main／主線**；不改共享倉庫 `.git/config`。
- 凍結的生產輸入（`WorldIntegrationBoot.ts` 的 FlowReferenceStandin 段、`CharacterMotion.ts`、`anim_meta.json`、`tools/journey-integration/frozen-production-inputs.json` 所列檔案）只能從外部觀察，不能改。
- 時間一律報美東時間（EDT）。

## 9. 推送狀態與注意事項（重要）
- **尚未推送。** 現有 origin `Funning0423/yiqifengle` 是**公開**倉庫；要求是私有倉庫；box 也沒有 git 推送憑證。目的地由 Funning 決定。
- 已在公開 origin 上的歷史（無法靠這次交接撤回）：
  - 舊提交作者資訊含 Mac 使用者名與主機名（`<mac-user>@<mac-hostname>`）及 Apple 私密轉寄信箱。
  - 多個追蹤檔含 `/Users/<mac-user>/…` 路徑（如 `tools/observe_*_build.swift`、`docs/*-20261014.md`、`tools/wechat-world-r6-audio-build-options.json`）。依指示**不改寫歷史**。
  - origin 上 `voicebot/audio-cc0-20261015`（提交 9def3a4）已含 `bgm_reference_NOT_FOR_SHIP` 參考轉檔；是否從公開倉庫移除由 Funning 決定。
- 推送清單：`handoff/BRANCHES.tsv` 中「推送=是」的分支（共 @@NPUSH@@ 條）+ `handoff/20261017`。**不推**：`voice/audio-cc0-20261015`（含 NOT_FOR_SHIP 轉檔，留在 box）、舊別名 `voicebot/*`、`voice-bot/*`（`voice/*` 已有同 SHA 名稱）。
- GitHub 單次推送上限約 2 GB：交接分支把快照分成多個提交，可逐個提交分批推送（見 §11）。
- 沒有超過 50 MB 的檔案進倉庫，因此**不需要 Git LFS**。若日後要放大檔，需安裝 git-lfs 並設定 `.gitattributes`，推送也需要憑證。

## 10. 分支總表
狀態：已驗收／進行中／未驗收／被取代／封存。「已在 origin」以 `git ls-remote --heads origin`（@@LSR_TIME@@）為準。「在 r4/r4.1 內」表示該分支 HEAD 是 r4（2153a65）或 r4.1 當前 HEAD 的祖先。

@@BRANCH_TABLE@@

其他非 yiqifengle 主倉庫的 git 資料：
- 運鏡bot 的獨立倉庫 `team/cinematic/work/m1v2-clipfix`（.git 未進快照）：提交 508b87b、023a47c **已匯入主倉庫**為 `cine/m1v2-src-apron-ease`；工作區只有 `STATUS.log` 有未提交修改。
- `cinematic-handoff` 提交 ad05040 已在主倉庫分支 `cine/cinematic-handoff-20261017`（目前 24cb961）。
- 場景設計部的彩虹橋／天空之城沒有代碼分支，產物全在 `product/`。UI設計部沒有 ui/* 分支。

## 11. 非 git 資料（`handoff/workspace-snapshot/`）
- 來源：`/workspace/wechat-game/` 下的 `product/`、`team/`（各 outbox）、`ui-audit/`、`ui-design/`、`art/regions/lakeside/ENGINE_COLOR_REFERENCE/`，以及 box 的 `/tmp/amb`（湖畔環境聲來源，放在 `_box-tmp/amb/`）。
- 加入大小：**@@SNAP_FILES@@ 個檔案、@@SNAP_MB@@ MB**。
- `/Users/<真實使用者名>` 路徑已在快照的文字檔中替換為 `/Users/<mac-user>`（.patch 檔維持原樣，以免無法套用；其內容本來就在分支歷史中）。
- 排除規則（明細與每個檔案的大小見 `handoff/EXCLUDED_FROM_SNAPSHOT.tsv`，全部仍留在 box 原路徑）：
  - 所有 `.git`、`node_modules`、`__pycache__`、`build/` 目錄；`.blend1`、`._*`、`.DS_Store`。
  - git bundle（全部 69 個 head 都已確認在本機分支中，重複）。
  - Voice Bot `outbox/patches/`（重複 voice/* 分支）和其他 >5 MB 的二進位 patch。
  - 影片錄屏（mp4/webm/mov），例外：`team/cinematic/outbox/`、`team/voice-bot/outbox/20261017T121502Z-r4-exit-footsteps/recording-yunjing/`（運鏡bot 錄音錄影，原樣保留）。
  - ui-audit 的所有媒體（webm/mp4/wav）；ui-audit 10-15 的圖片；10-16 已被取代輪次的圖片（保留 milestone-09a1b8e、a3b-a17395c、result-screen-v2-b0020ed）。
  - `team/cinematic/work/` 只保留原始碼／腳本／json／筆記（≤5 MB），渲染、影格、影片、blend 等排除。
  - `NOT_FOR_SHIP` BGM 參考轉檔。
  - 所有 >50 MB 的檔案（見下表）。
- 進行中的目錄（快照只是當下狀態，之後需要重新同步）：`product/2026-10-16/gameplay-integration-concepts/D_refine_r3b/`、`v4/C_palm/`、`product/2026-10-17/bamboo-raft-S2/`、`ui-audit/2026-10-17/r4-2153a65/`。

@@EXCL_SUMMARY@@

**>50 MB 檔案（沒有進倉庫）：**
| 路徑（相對 /workspace/wechat-game） | 大小 |
|---|---|
@@BIG@@
- 3 個 .bundle 與 2 個 .part 是現有分支的重複，建議直接排除；2 個媒體檔（ui-audit 錄音、對比影片）若要保存，建議放 Google Drive 或用 Git LFS（需安裝 git-lfs 與推送憑證）。

## 12. 未結事項總表
1. r4 Mac 驗收（§7.3 的 5 個初步問題待定案）。
2. r4.1（77ef6ad 含背景計時修正）全套測試確認 → Mac 驗收（提示牌 7 屏 + 橫屏、草甸落點→棋盤 7 屏、出門／回家有聲錄屏 + `recording_levels.py`、切後台 3 s/10 s）。
3. Grok Bot 是否接受 08→09 慢 1.19 s（最小屏 +2.98 s）；r4.1 短屏托盤下移 20 pt、長提示文字縮到約 0.92×。
4. 彩虹橋 effect 在 Creator 3.8.8 編譯與真機截圖；天空之城 B r2 實作（r5）。
5. 湖畔 DC 實測 ≤60；夜間玻璃牌 Mac 夜間照片。
6. 結算畫面 v2.2 Funning 最終選定與真機驗收。
7. m1v2 布料重做（ChatGPT 6 Pro）。
8. 野餐布 D r3b、C_palm r2、竹排 S2 導出（後台進程 pid 見場景設計部 HANDOFF §3；不要打斷，同時只能有 1 個 Blender）。
9. 推送目的地（私有倉庫）與 GitHub 憑證；公開 origin 上已有資料的處理（§9）。
