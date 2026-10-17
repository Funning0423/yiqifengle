# d238881 Oi review (16:05Z, Drive 1cx3sPU6t41Yv3_pTgy1-yOOsB5Xp7uLD) — branch ggbot/d238881-oi-review, local only

base d238881c85df7787fc63a37092a46968bb6f3d34 (tree d0296913f46202d21debd804efd99578447cdc8c)
head 450f1f5774672ef376f26c53bf6af3170847de41 (tree dd463b5a045678fd76bd46e1cea88a44b20f880b)

e869b092445a1bb8eb24e11e1a5ac2dacc4fc8dc tree 947aaa63baa1db417d31757f653b4870ff15268a  Oi review 1/5 night sea: snap weights within 0.002 of 0/1 and always write endpoint changes (day restores author
1eeae1883cab5bb7d7649850a5483147ad2cb67a tree 647a4991ea69e8ec1473a38b0deb7317cadeb3f4  Oi review 2/5 strip tool: respect sampler interpolation (CUBICSPLINE dropped only with zero tangents), keep spar
a9b814ca5f640d3234e35e6829fd6cf799f6efdb tree 34dad11f27fdb84324381911c4d1e9651c850ad2  Oi review 3/5 audio test: correct the MPEG-1 L3 bitrate-index comment (40 kbps = index 2 = 0b0010; assertion unc
c76b6fe890f6c2331a05274f177a1331246c8b14 tree c40c737699923e5ff1a2460d10ff2cdecb568ae7  Oi review 4/5 geometry: fixture rebuilt with build-fixture.cjs from the final GLBs (byte-identical to d238881, b
450f1f5774672ef376f26c53bf6af3170847de41 tree dd463b5a045678fd76bd46e1cea88a44b20f880b  Oi review 5/5 camera: start-continuity test for startBlendM=0 (continuous after set-off; before->after hand-over

Apply: git checkout d238881 && git am 000*.patch; expected tree: see TREE_CHECK.txt
Suite: 33/38 (= baseline 32/37 + new journey-start-continuity PASS); non-pass unchanged: production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract FAIL; navigation-guard BLOCKED.
Standalone: test_sea_night_tint 9/9, test_strip_rest_anim_interpolation 5/5, test_idle_loop_size PASS, test_scene_bgm 114 PASS.
Geometry only; not render/device/listening acceptance. Open design item: set-off is a hard cut (50.73 m, 132.07°, fov 42→48).
