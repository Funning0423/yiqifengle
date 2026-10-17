## GGbot · journey 最新线可核基线 d238881（2026-10-16 13:00 UTC）

> ⚠️ **Mac 待验、落地未定**：Mac 构建还没跑，包体（预计约 23.4 MiB）未实测。landing（A / A2 / E）等 Funning 选定，本线不含 landing 改动。
> ⚠️ **764dcd8 已验收不通过，仅作历史记录**。

供 Oi 在 Cocos 复验。没有推送，也没有动主线。

### 1. 分支 ggbot/build05-v3.2-final
base 1c21428d3235f16866d879a078df7cf324117d98（Voice Bot 地表 v4.1，tree 49c90a372aa45349d1b7d1d297733a20a2a99324）

| # | commit | tree | patch SHA256 |
|---|---|---|---|
| 1 夜海 | fd434fe8c603c5be3f0687b3f20fecf3dc405ccf | c740d938d17b32c468f8c7106467fe21fd6acbc2 | 2d6e417c1c6b28dcf0fd8f2c774d8accac17805d8590729f3fd200ba1099347d |
| 2 idle_loop | dc34e4d5402413d62ab4662eb9e65866192e456d | b8186511748e5aecfd778ed72c916534427a76e9 | a3912aebc699b4fc57c62b460fa668ce0be4d2ab2eb875e1136b19a565f8b77f |
| 3 bgm 40 kbps | 3e0bdc3d678a257d862746b98cd87c2b759b5cd2 | 54e9b0d99912576fb7100ca3e44865bdd3c0eff0 | 04c462b9453f38c7c9ef5cfe814d56bf525de804f0387555e28849518902767d |
| 4 运镜 fix 3 | 218b03062e3ab07bdcf0e735012ab79faae1f34e | e7034d1b01afafb30c94da4260d3a762536e1781 | 3d59549fc421399c21e18257ca4d360e404ddc7eea864a9d35a3c3b1f572abcd |
| 5 fixture | d238881c85df7787fc63a37092a46968bb6f3d34 | d0296913f46202d21debd804efd99578447cdc8c | a7cfb259939d81a6d758cbd487b7f878d0f17f1a4d2c4ed942bd340ad75da48c |

### 2. 补丁包
team/ggbot/outbox/20261016T125957Z-journey-baseline-d238881/journey-baseline-d238881.zip

zip SHA256 0c8489f9ebed780c1c36f91b1eea34b34e7f0136939965708ab5ddc50d1137f1

### 3. 复验方法
在补丁目录里先核对哈希，再打补丁、比对 tree：
```
sha256sum -c v3.2-final/SHA256SUMS.txt
git worktree add --detach /tmp/v 1c21428 && cd /tmp/v
git am <补丁目录>/v3.2-final/*.patch
git log -1 --format=%T   # 应为 d0296913f46202d21debd804efd99578447cdc8c
```
我已在干净的 worktree 上跑过 git am，tree 对得上。
