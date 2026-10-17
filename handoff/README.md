# handoff/

- `MASTER_HANDOFF.md`：總交接文件（繁體中文），從這裡開始讀。
- `BRANCHES.tsv`：全部本機分支（完整 SHA、負責、狀態、是否已在 origin、是否推送）。
- `bots/`：各 bot 的 HANDOFF.md 副本與 m1v2 布料 PROBLEM_BRIEF。
- `EXCLUDED_FROM_SNAPSHOT.tsv`：沒有放進快照的檔案（路徑、大小、原因），它們仍在 box 的 `/workspace/wechat-game/` 原路徑。
- `workspace-snapshot/`：`/workspace/wechat-game/` 非 git 資料快照（product/、team/、ui-audit/、ui-design/ 等）。
- `tools/`：產生本交接包的腳本（選檔規則、分支表、密鑰掃描結果）。
