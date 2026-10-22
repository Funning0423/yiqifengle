# walk_start_stepdown 并入生产版角色 GLB

- 底版：planB_cand3b_ribbonwind4b.glb（sha256 5edddd06…，3,141,660 B），开始前已核对
- 新 clip：walk_start_stepdown（anim/b15-getout-stepdown 3c5025af，53 帧 1.733 s）
- 压缩：compress_keeptr.py，LEGTOL 0.01°（root/hips/thigh/shin/foot），其余 0.10°，hips 平移 0.05 mm；不写 interpolation（默认 LINEAR）；scale 通道等于静止值，丢弃
- 飘带：预览 GLB 没有 ribbon 骨，合并时补 ribbon 通道（ribbon_stepdown.py）：跟随曲线从 door_reach@1.8 s 平滑到 walk_loop@0.453 s，叠加与 ribbon_bake5 相同参数的弹簧，两端 9 帧淡到 0；接缝 0.000°，俯仰 -1.0…11.92°（walk_start -0.0…11.27，walk_loop 6.56…12.24）
- 校验（verify.json）：14 个原 clip 664 个通道逐通道（时间、数值、插值）完全一致，顺序不变，新 clip 是第 15 个（index 14）；原 BIN 字节前缀、bufferViews、accessors、节点、蒙皮（29 关节）、IBM、4 个网格、材质全部一致
- 30 fps 回读 vs 压缩前：旋转最大 0.0998°（hand.L），关节位置最大 0.545 mm（hand.R），脚/小腿 ≤0.002 mm，裙骨 ≤0.509 mm；QA 原值：门对布料最小间隙 47.6 mm、篮/门穿模 0、撑地鞋底 -1.9 mm，误差不改变结论
- 包体：3,141,660 → 3,165,656 B（+23,996 B）；gzip -9 1,877,538 → 1,890,944 B（+13,406 B）；动画数据 148,096 → 164,256 B，超出 anim_meta 的 150,000 B 动画预算
