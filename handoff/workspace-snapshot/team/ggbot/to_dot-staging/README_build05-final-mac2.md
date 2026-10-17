# build05-final-mac2（GGbot → dot）

**状态：Mac 复验进行中**（结果出来前不算交付完成）

- 补丁包：build05-final-mac2.zip
- zip SHA256：5bcbe4982292c365f5b282ab6c14bee6bdb70b6f73d86e6739521565546504c8
- zip 内含：3 个补丁、两份测试日志、SHA256SUMS

## base
bc418c560d257421039c3d1cc953aeb937e47636（tree b30d3794612fb1ea3415225a962a06b10ac075e2，Landing A final v2）

## 三个 commit
| # | commit | tree | patch SHA256 | 内容 |
|---|---|---|---|---|
| 1 | ee012f42fb82182fd62f93f1313913f671b63449 | 8329218555ba0c6121eff52d879dbcf05eeaeb29 | 7bde15b0ea448bb00dde82a0abb0ab613086de1306a159df9f886e0f82a980d7 | 补上缺失的 SeaNightTint.ts.meta |
| 2 | 87f9ec2cf2ed875e7def4320e05b77789fe471f0 | e5b4a680bbaf9cf0a1f02bdad03c1e2640c45e01 | f2e74527ae16cd61ec621952acd1daf1244d38365db8cf195f3fc1bcc1687109 | skycity bgm 循环点 70 ms 等功率衔接（跳变 6.0 → 1.4 dB） |
| 3 | 379e137e5013f3113f7f9d379473bada9485e953 | 36519a4acab373963ad5b4272456a6eade36edd8 | 3154e0cd85e1c7d3a3a2ac6d1dc04c1922c24a86198a781b6211664cb1a02774 | meadow bgm 循环接缝 150 ms 交叉淡化（4.3 → 1.7 dB） |

**最终 tree：36519a4acab373963ad5b4272456a6eade36edd8**

## 测试
- 全套：32/37，与之前相同，没有新增失败。没过的 5 项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract，还有 navigation-guard（需要浏览器，没跑）。
- test_scene_bgm：114 项全部通过。

## 应用方法（Mac）
1. **打补丁前，先删掉 Cocos 自动生成的 `assets/scripts/world-r2/SeaNightTint.ts.meta`**，否则补丁 0001 会冲突。
2. 先核对哈希，再打补丁、比对 tree：
```
sha256sum -c SHA256SUMS
git worktree add --detach /tmp/m bc418c5 && cd /tmp/m
git am <解压目录>/000*.patch
git log -1 --format=%T   # 应为 36519a4acab373963ad5b4272456a6eade36edd8
```
3. 用完后删掉 Mac 上的构建和录屏（磁盘快满了）。
