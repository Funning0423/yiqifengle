# r4 交付 — integration/build05-r4-20261017T122042Z

HEAD `2153a65cd4c97208a202746d251e3a458d4bb98f`（= dryrun3 6f42df4 + cherry-pick 95d3eee，无冲突）

- `r4.bundle`：`f3d3614..HEAD`（前置 f3d3614），含分支 ref。
- `PATCH-LIST.txt`：47 个提交（顺序、完整 SHA、作者、标题）；`patches/`：format-patch。
- `suite-node22.txt`：v22.23.3，91/92，仅 navigation-guard BLOCKED_BROWSER。
- `suite-node20.txt`：v20.19.2，89/92，legacy-board-ui-pure / reward-background-return BLOCKED_NODE + navigation-guard BLOCKED_BROWSER；无 FAIL。
- `MAC_CHECKLIST.md`：界面验收部 Mac 清单。
- 包体估算（f3d3614→r4，TS→ES2020 去注释去空白，`/tmp/r4sd-min.cjs`）：JS +58,785 B（dryrun3 部分 +50,916，95d3eee +7,869），raw TS +92,403 B；effect 源码 +981 B；8 个新 .meta。预计包 ≈ 19.35 MB，门限 24,641,536 B，余量约 5.29 MB。需 Mac 实测。
