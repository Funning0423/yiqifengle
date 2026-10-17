# 给 Oi：审查修复补丁 + 角色驱动代码（GGbot，2026-10-16）

## 1. 16:06 审查 5 项修复（基于 d238881）
- `patches/0001…0005-*.patch`：`git format-patch d238881..450f1f5`。
- 应用：`git checkout d238881 && git am patches/*.patch`。
- 修后 HEAD：`450f1f5774672ef376f26c53bf6af3170847de41`；tree：`dd463b5a045678fd76bd46e1cea88a44b20f880b`。
- 已在全新 d238881 worktree 上 `git am` 验证：tree 完全一致（commit id 因提交者/时间不同而不同，属正常）。
- 说明：群里提到的 021b935/147edea/a2fdecf/1e06f12/efbbc2a 不是直接在 d238881 上，而是同样 5 项修复重放在后来的 0005d7a 线上（中间隔了 25 个无关提交）。基于 d238881 的真实链是 e869b09 → 1eeae18 → a9b814c → c76b6fe → 450f1f5，逐个对照见 `TREE_CHECK.txt`（其中 4 个 patch-id 完全相同，第 4 项因上下文不同 patch-id 不同）。

## 2. 88506aa / 7ecd289 实际使用的角色驱动代码
- `files/<短SHA>/…` 按仓库目录结构用 git 原样导出；`MANIFEST.tsv` 列出每个文件的路径、git blob SHA、sha256、字节数。
- 仓库里没有单独的 MorphDriver 文件：`MorphDriver` 类定义在 `CharacterMotion.ts`（第 497 行），`parseAnimMeta` 也在这里。
- 绑定/启动：`WorldIntegrationBoot.ts`（`loadAnimMeta()` 从 region_island 包读 `character/anim_meta`，`bindVisual` 时按 `motionConfig.morphMeshes` 每个网格 new 一个 MorphDriver）；它挂在场景 `WorldR5Integration.scene` 上。
- 相关：`world-r1/WorldFlowCore.ts`（sit settle 帧）、`anim_meta.json(.meta)`、`region_island.meta`（包配置）、`settings/v2/packages/builder.json`。
- 这些文件在 88506aa 与 7ecd289 之间 blob 完全一致；两者的差别只有角色 glb（7ecd289 换了 BODY09 v44-cold5 角色模型）。

| commit | 完整 SHA | tree |
|---|---|---|
| 88506aa | 88506aa4ddad315bc7b5dbdedff0017b2b91e83c | 0b0f98a6950b957df82716cb842fa847c717bd19 |
| 7ecd289 | 7ecd2890c39043530961e91a0815ddbac986b7ad | 4de33d3921ff3b135af05943dc095ee8da565ca4 |
| 688aad3 | 688aad34343120b0ab12340a8483099729f5bbd4 | 86ca687d7abd82657a49daf97f913ae69df76fbe |

**注意：这三个提交只存在于 GGbot 的本地机器上，从未 push，所以在 GitHub 上读 88506aa 会 404。** 需要完整内容请用此包或 to_dot 里的 bundle。

## 未触及
BODY0 映射漏形（Oi 已在云端纠正）、「已解锁 09 时选 05 暂停/加载失败被覆盖」的 pending 选择缺口（Oi 在修）——本包均未改动。

校验：`sha256sum -c SHA256SUMS`。
