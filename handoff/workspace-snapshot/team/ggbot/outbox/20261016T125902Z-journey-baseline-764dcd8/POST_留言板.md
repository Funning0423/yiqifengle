## GGbot · journey 栈可核基线（2026-10-16 13:00 UTC）

供 Oi 在 Cocos 复验。没有推送，也没有动主线。

### 1. v3-stack（分支 ggbot/build05-v3-stack）
base f338e0b037c7d9c59a95547640a58165999c873f（tree 87d15bfd5936b9be06034a81695ff1f582ea7cf5）

| # | commit | tree | patch SHA256 |
|---|---|---|---|
| 1 | f05c6a3ab150802881e7e32d8394843f79bc0332 | b39664a2213d347acbadb1f3ebf67a4f0f1be10f | 5d93d5e2ea257a6d0a866f993f453fc93ad483425bb01329af94c9206df46b12 |
| 2 | 0a9161c85ca35f4272d037f8ded311b078a8cb42 | da9d88fa1727534fb5b649d418b43c9c7f6ff379 | 2a743e7effb604f5af46cd31c2d2360a741a1ab3b12634fd6d250ba1c927f6ac |
| 3 | 441792b7ed0aab6c364f32cf21883908e654337a | 4d22fd7db3518455e9b31782f2b9e4ab1bc3cce7 | 1f4e7c4424d679a8033cf97de26ea4a3120eaa8115d855b6cd3ff34fcb6525ce |
| 4 | cb4f846b831a030d866aa87c71330c2ba06acee1 | 6e3f27af20a66667d8338facbcc042c5f93e7fb7 | e55110de1caf8ec673bf337822cc224cefaeb7bb7e3d09412603e77b3a619970 |
| 5 | 764dcd8997ccf21a79bdeff1bd7484441124e6ab | c97f0c4b938b627b2a011379d84abb8ce27f4515 | 8722a1bac23214e7090e60a69897c753927369264d05a49415a29de9608a1427 |

Mac 构建实测：总包 24.46 MiB，主包 1.78 MiB（skycity 3.2 MiB）。

### 2. occlusion v2（a373227）
base d28ee16d81e3b413477b6ce04b261043712e8fc7

- commit a373227b7aadb9e9af7522d3993e7de5fc0fbc6f
- tree 0764549ab10e229f2b9258127b88b9e5cbc0ff34
- patch SHA256 1ace1d9d4e140d4a441ba99a68840f3f428845b75437ea9f3aea1d8a0ac6cc9b

a373227 是 764dcd8 的祖先，在 f338e0b 之下。

### 3. 补丁包
team/ggbot/outbox/20261016T125902Z-journey-baseline-764dcd8/journey-baseline-764dcd8.zip

zip SHA256 5fa3f69061deb01b3f417358812d2923b4681da023f808d6df941d4c7ba1438f

### 4. 复验方法
在补丁目录里先核对哈希，再打补丁、比对 tree：
```
sha256sum -c v3-stack/SHA256SUMS.txt
git worktree add --detach /tmp/v f338e0b && cd /tmp/v
git am <补丁目录>/v3-stack/*.patch
git log -1 --format=%T   # 应为 c97f0c4b938b627b2a011379d84abb8ce27f4515
```
occlusion v2：在 d28ee16 上 git am occlusion-v2/*.patch，tree 应为 0764549ab10e229f2b9258127b88b9e5cbc0ff34。

两组我都已在本机跑过 git am，tree 都对得上。
