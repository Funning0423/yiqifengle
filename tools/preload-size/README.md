# PRELOAD_PLAN 实际构建大小表

    node preload-size-table.cjs <web-mobile 构建目录> <TransitionChain.ts> --md table.md --json table.json

- 从 TransitionChain.ts 里解析 `PRELOAD_PLAN`（target / stage / bundle / bytes / prefab），统计构建目录 `assets/<bundle>`（也找 `remote/`、`subpackages/`）的实际字节数、gzip-9 字节数、import / native / config+index 分项和文件数，并输出“计划 vs 实际”的差值，以及按 target 的合计。
- 可以接在构建后的钩子里跑：Creator 构建完成后执行这一行即可。不改 TransitionChain.ts。
