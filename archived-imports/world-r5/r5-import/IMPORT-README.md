# R5 v1.1 candidate import-only

Only copy runtime/ into the chosen Cocos script folder. Entry: runtime/board-session-provider.js (board adapter) or runtime/index.js (pure session API). Five JS modules and two TypeScript declarations. No tests, negative fixtures, authoring scripts, Node modules, storage samples or original UI files are included.

Read R4-R5-ADAPTER.md and COCOS-3.8.8-INTEGRATION-CHECKLIST.md before integration. The completion prototype is not shipped or integrated. R5 is board-provider compatible, not a drop-in replacement for the whole R4 Controller. The independent active key is forest-regional-r05-active. Terminal checkpoint saved does not mean completion journal/rewards saved.

Node logic, replay, mocked storage/lifecycle and package dependency checks passed. Cocos import, TypeScript declaration compilation, real devices and expert-player difficulty are not verified.
