# b15 篮内起身 v1b（样本，接 getout v3b bab2dab3 开头）

## 问题（基线 cine/r5-b17-home-fade 9bab39c9）
board() 让她以 sit_hold 坐在篮中心 (stand_point 局部 0,-0.1,0)，朝向 flight.girlYawRad（世界约 -32°）。着陆时 cancelAndReset 直接把她放到 P0 (0.03,0,0.395) 并转到 95.97°：脚跳 0.396 m、同帧转 128°。9bab39c9 已撤销“坐在 P0 面向门”的方案，因为坐姿腿/裙会穿出篮前壁。

## 方案
- **坐席后移，乘坐时就面向门**：座位根 = P0 沿门向后退 stand_up 根位移 0.494 m。basket 局部（Cocos/glTF）为 **(0.032, -0.1, -0.099)**，即 stand_point 下 setPosition(0.032,-0.1,-0.099)。yaw = seatYawDeg(startYaw)，等于 9bab39c9 撤销前那一行的 yaw。坐姿离前壁约 14 cm（腿 minY -0.56，前壁内侧 -0.70~-0.80），篮体×身体/裙/围裙/蝴蝶结 = 0。
- 着陆后（篮已定 yaw，门镜头内）：sit_hold → **stand_up**（mocap，start_pose = sit_hold f0，硬切，不能 crossfade）。根沿朝向前进 0.494 m，正好到 P0。→ crossfade 0.2 → idle_breathing_loop t=0，这就是 getout v3b 的 t=0。之后完全按 getout_v3/INTEGRATE.md 走（T0 = idle 0.5 s 后 door_reach）。
- 128° 转身被消除，不需要篮内转身：她在乘坐时就面向门。飞行镜头里只露帽子，朝向看不出来。
- morph：按 anim_meta 曲线驱动（sit_drape / corrective_stand_up_* / cloth_*），与凳子起身同一套。

## 代码侧（不是我的文件，需 Grok Bot / 运镜bot 改 RegionJourneyAdapter.ts）
1. board()：`girl.setPosition(0.032,-.1,-0.099)`（basket 局部，篮 yaw 已是 doorYaw）；`setRotationFromEuler(0, moored.seatYawDeg(moored.startYawRad*180/Math.PI), 0)`。
2. 着陆后不要 cancelAndReset 到 P0。要先在座位根播 stand_up（时间时钟 1.2667 s，root_motion forward_m 沿朝向，in_place），结束时根正好在 P0（误差 <2 mm），再 cancelAndReset({standing, P0, startYaw}) 进 getout（idle t=0，crossfade 0.2）。门镜头总时长 +1.27 s。

## QA（v1b，30 fps，t=n/30，f0–98，含 stand_up→idle、idle→door_reach crossfade）
- 篮体 × body/dress/apron/bow：**全部 0**。
- 门叶 × body：f81–82 有 7/41 个（door_reach 手触门帧）。原因是本预览用了 INTEGRATE 的公式开门（2 帧 2.75°），而不是 v3b 的手驱动二分，属于 getout 段，与起身无关。v3b 本身该段已验收为 0。
- 门叶 × 布料：0。
- 脚滑：起身段（f18–62）最大 1.24 mm/帧；全程最大 2.69 mm/帧，出现在 getout 的 idle→door_reach 段，与 v3b 相同。
- 鞋底最低 -1.8 mm（getout 段）；起身段 ≥ -0.6 mm。
- 膝：起身 f36–49 匀速伸展 3–9°/帧（mocap 原样），无突然伸直。末端 L 10.47° 稳定。
- 手臂：起身段 abd ≤ 57°（扶膝起身，向前非外张）。door_reach 段最大 64°（伸手推门，v3b 原样）。
- 逐帧表：qa_v1b.json

## 未测
- Cocos 实机 / 真实门镜头（预览相机是近似的门镜头位置，不是 lakesideDoorLens 求解结果）。
- 运镜bot 参考目录 previews/运镜bot/r5-b17-home-fade/ 不存在，b/c 未能参考。
- e709e651 与 bab2dab3 开头对比：两者开头都是在 P0 播 idle_breathing_loop。差异是 e709e651（v2）门 yaw 112.86°、旧 b14 路径、门 mock；bab2dab3 是 96.19°、真实门 GLB b69faa60。本起身接的是 bab2dab3，局部量（P0、朝向沿篮局部 -0.22°）在两者里相同。
