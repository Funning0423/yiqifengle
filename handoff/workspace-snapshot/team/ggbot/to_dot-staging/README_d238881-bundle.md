# yiqifengle git bundle: base 1c21428 + d238881 (full history)

File: yiqifengle-d238881-base-1c21428.bundle (135,381,211 B)
SHA256: 0c7806065e5ae68c0ec27a7a8160c1565fb341c85759cb793c25814fa98dc8cd

Refs in the bundle (self-contained, no prerequisites; 390 commits up to d238881):
- refs/heads/oi/base-1c21428 = 1c21428d3235f16866d879a078df7cf324117d98  tree 49c90a372aa45349d1b7d1d297733a20a2a99324
- refs/heads/oi/d238881      = d238881c85df7787fc63a37092a46968bb6f3d34  tree d0296913f46202d21debd804efd99578447cdc8c

Patches 1c21428..d238881:
  fd434fe night sea / dc34e4d idle_loop strip+24fps / 3e0bdc3 bgm 40 kbps / 218b030 camera startBlendM 0 / d238881 occlusion fixture

Verify and clone:
  sha256sum yiqifengle-d238881-base-1c21428.bundle
  git bundle verify yiqifengle-d238881-base-1c21428.bundle   # (inside any git repo)
  git clone -b oi/d238881 yiqifengle-d238881-base-1c21428.bundle yiqifengle
  cd yiqifengle && git fetch origin oi/base-1c21428:oi/base-1c21428
  git rev-parse oi/d238881^{tree}   # d0296913f46202d21debd804efd99578447cdc8c
  git rev-parse oi/base-1c21428^{tree}   # 49c90a372aa45349d1b7d1d297733a20a2a99324
Verified here in a fresh clone: bundle verify OK, git fsck clean, both trees match.
