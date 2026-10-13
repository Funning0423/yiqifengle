# QF-WRIST-20261013 / QF-HEEL-20261013 本地候选：局部修复完成，整体验收未通过

隔离 checkout `/Users/shineanl/Documents/Codex/2026-10-14/task-5/character-fix`，分支 `character-wrist-heel`，从指定完整提交 `b31cfa544562aaae2b1d25cd03e9e31bb231e310` 以本地 `git clone --no-hardlinks` 创建独立 Git checkout（不是共用 Git 元数据的 worktree）。未操作棋盘、微信窗口、真实存档、凭证或权限。没有云端候选输入或交付。

## 实际资产修改

动态资源原路径 `creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb` 已替换成本地可验证候选，1,426,060 B。该改动只属于本独立 checkout。原始动态文件完整保留在 `output/character-repair/original.glb`，与指定基线一致。

- 全 14 个动作、左右手共 28 个旋转通道：相对各手的绑定局部旋转进行球面平滑压缩；40°开始缓和，渐近上限60°。处理四元数符号及180°附近分支跳转，保持各clip首尾姿态，并投影到240°/s的关键帧角速度包络。不是将hand设成identity，也没有焊表面掩盖扭转。
- 左右掌心86顶点组件：用手骨绑定局部Y的 `[-.018,.025] m` 区间平滑过渡前臂/手权重；五个独立指部30顶点组件随hand刚性运动。保留既有拓扑与指形。
- 左右靴壳各257顶点：鞋底、后跟与前掌下部（绑定高度≤.094m，各177顶点）全随foot；`.094–.176m`靴筒以smoothstep向shin渐变。避免鞋后沿下部被shin/foot不同变换拉弯。**没有重新制作棕色参考靴的几何或材质**。
- 初版腕角修正导致门把接触误差100.26mm，未作为成品保留。最终 `door_reach` 的左upper_arm/forearm两骨IK补偿，把接触阶段掌心轨迹恢复到原动作目标，手腕仍受60°约束；动作首尾不受IK影响。原采样时间布局不变，所有目标可达。

GLB JSON chunk、拓扑、POSITION/NORMAL/UV/COLOR、纹理、材质、所有骨骼/逆绑定矩阵、动画名称/通道/采样时间、下半身动画与根运动均原样保留；只改变旋转输出及指定掌/指/靴的JOINTS_0/WEIGHTS_0。Creator原`.meta`和`anim_meta.json`未修改。游戏TS源码没有修改。

## 验证与证据

`python3 tools/character-repair/repair_asset.py` 从保留的原件可重复生成候选；`validate_asset.py` 检查二进制修改白名单、全动作LBS及LINEAR四元数球面插值。每clip121个时间点，共1694个采样。腕部混合顶点的局部LBS矩阵最小奇异值从旧最坏约.134改善到候选约.866；这是局部变换指标，不能解释为真实腕径、封闭表面或自然度判定。鞋下部固定顶点对距离的旧最坏误差17.70mm，候选小于1µm。检查全部有限值及手关键帧角速度≤240.02°/s。详见 `skin-audit.json`。

`test_action_transitions.cjs`：10项通过（当前TS+真实GLB的FK，非Cocos GPU）。门把接触0.63333s、门保持0°，掌心误差4.397mm；0.65s才开始门旋转；2s后才行走。坐起/坐下下半身、动作取消/重试、缺clip回退通过。

`test_walk_driver.cjs`：仍FAIL，2项旧行走滑移检查未通过，2项因当前metadata无足踝stance窗口而跳过。使用相同 `anim_meta.json` 的基线原件重跑，失败项目及其数值/错误文本与候选一致：toDoor鞋底滑移25.06mm，3.2m路径滑移26.05mm（允许16.47mm）。没有通过修改阈值消除失败。报告分别为 `walk-tests.json`、`baseline-walk-tests.json`；不能把跳过算通过。

Blender5.2.2LTS本地CPU低分辨率渲染：14clip各取**旧腕部最坏采样时刻**，同一clip/时间/相机比较原件与候选的全身、左腕、双鞋后沿；84张帧加3张原始新坐姿参照，`comparisons/*.jpg`逐姿态拼图及 `pose-sheet-1/2.jpg`。最终door帧在IK完成后单独重渲染，其余clip数据未变而复用已有图，身份见 `render-identity.json`。仅一时刻/clip的左腕图，双腕及区间数值验证覆盖全clip。参照以原生尺寸单独取景，拼图不是等尺头身测量，更不是把无rig参照播放成14个动作。

参照从用户本机原始GLB读取，SHA256 `4771351fb5e200a21cc4c03ab44ff6b9067237ef16b64568d255a47343adb942` 重核一致；未复制或覆盖大原件。

沙箱Blender首轮Metal初始化exit139；自动审批允许本地Blender执行后导入/渲染成功。无Creator构建、浏览器GPU实渲染、微信或手机操作。磁盘检查最初约1GiB、后续约6.3GiB；本checkout没有上一轮build输出，未删除其他目录、未清空废纸篓、未杀进程。顺序完成渲染；证据目录约18MiB。中间 `candidate-probe` 是早期诊断，不作为最终图，最终证据仅 `frames` / `comparisons`。

## 全部仍未通过项

1. 头身、帽子/发型、袖口和服装外形、腿长与新坐姿仍未统一；POSITION和腿骨数据完全未改。坐姿依旧是旧向后坐，而参照更直立；不能称完成新人物rig/重拓扑/造型匹配。14姿态差异见逐项 `pose-review.json`。
2. 靴型及材质仍为旧红靴，参考是更圆的棕短靴；鞋后沿**蒙皮稳定性候选**不等于靴型视觉通过，也没有完成鞋底地面接触验收。
3. 上述25–26mm行走滑移是基线已存在且仍未通过。没有正式Cocos跨淡化、风层、房间相机/灯光、GPU或手机验收。
4. 开门IK改变左手臂姿态：肘混合区域最小LBS奇异值由旧.694到候选.585；最终左前臂最大关键帧角速度约607°/s（旧约501°/s）、左上臂约673°/s（旧约869°/s）。接触回归通过但肘部褶皱、快速回收动作与自然度需正式逐帧复核，不能只凭腕部指标认定全手臂通过。
5. 旧椅固定支撑仍沿用前轮。新凳/旧椅切换、静坐整壳到动态角色的形状跳变依旧存在，本轮未重写显示合同。
6. 原有掌/指分离拓扑保留，没有证明腕表面闭合或所有角度绝无穿插。近景显示针尖塌缩显著消失，但掌形、袖内交接、手/裙穿插及左右腕自然度仍待正式独立游戏验收。

本提交是可供后续独立游戏验收的**腕鞋局部候选**，不应覆盖已通过版本或作为最终手机通过版本发布。完整commit和源码/资源hash由交接响应与 `output/character-repair/manifest.json` 提供。
