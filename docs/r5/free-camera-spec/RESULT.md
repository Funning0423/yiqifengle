# Y2 自由视角镜头规范：结果（r1）

- 分支：`cine/free-camera-spec-r1`，基线 `gbt/r5-integrated-b07-wip` = `bc81575fead2d4d05b11b962c936d3b76708ad4b`。只加了文档和 QA 工具，**没有改运行时代码**，也不用刷新两个根清单。
- 文件：`docs/r5/free-camera-spec/SPEC.md`（规范）、`camera-config.json`（配置表）、本文件；`tools/camera-frame-test/free_cam_audit.cjs`（审计脚本）。
- 预览（不进仓库）：`/workspace/yiqifengle/previews/运镜bot/free-camera-spec/`，每个区域一张 `*_safety.png`（方位 × 俯仰安全图）和一张 `*_mosaic.png`（8 个方位的 CPU 光线投射拼图；房间是 9 个偏航），全部数据在 `free_cam_audit.json`。
- `feat/free-camera-r1`：fetch 时（2026-10-18 15:00 EDT）还不存在，表结构是我先定的，见 SPEC §2 和 §7。

## 已测
- `free_cam_audit.cjs` 在 bc81575f 上完整跑过一次（6 个区域，约 340 s），数值都来自这次运行。
- 默认机位换算回 `ExploreCameraCore.FOLLOW`，逐项对得上（d 7.36、pitch 17.4、heading -160）。帆船 K1–K6 换成船坐标系后都落在安全区里（K2 设计上就是被前帆挡住的，已经豁免）。
- 看过全部 6 张拼图和小岛安全图：房间 -140/+14 两端没有透墙；+45…+145 只有空墙；风铃湖畔和天空之城的空黑带跟统计结果一致。

## 没测
- 没有在 Cocos 里跑，也没有上真机（云端还没实现）。没有用 Blender 渲染。
- 没审计的：小岛总览 ±35° 以外、近距离往门里看、"模型背面没做的面"（材质全是双面，从数据上分不出来）、运行时动画物的全相位（只算了 bind pose 加余量）。

## 需要用户拍板
见 SPEC §8：过场里能不能小幅转视角（A 全锁 / B 帆船和热气球段 ±20°，我推荐 B / C 全自由）；室外并轨的线加速度是保持 3 m/s²（转 90° 要 4.7 s）还是放宽到 15 m/s²（2.1 s）；草甸最远距离 9 m；风铃湖畔先限 ±55°，还是等美术补南岸。
