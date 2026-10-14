# 《咦，起风了》坐姿105 + 脚部35统一测试候选

这是已经合成同一模型、同一配套控制器的测试交接，仍未修完、未验收。不能称为“人物已修好”。用户脚部和坐姿问题独立保持开放；后续测试报告不得覆盖这些问题。

## 统一加载入口
`candidate/candidate.glb`是唯一合成模型；`candidate/anim_meta.json`是对应合并元数据。实际姿势/动作控制器位于`source/character-fix/creator-build-project/assets/scripts/CharacterMotion.ts`。角色适配器位于`source/runtime-excerpts/WorldIntegrationBoot-character.ts.txt`。
具体工程落点、每项SHA见`LOAD-MANIFEST.json`。所有冻结文件SHA见`SHA256SUMS.txt`。

## 在完整项目合包后测试
1. 在新的测试分支/隔离目录工作；保留当前工程文件供回退。根据LOAD-MANIFEST将统一GLB和metadata放到同一character资源目录，保留当前工程的资源.meta/UUID和依赖引用，勿另建未被使用的备用模型。
2. 合入配套CharacterMotion.ts：`integration/CharacterMotion.ts.patch`有原始基线；若当前文件SHA不等于manifest中的基线，不可盲目整文件覆盖，需按上下文合入且保留工程新逻辑。
3. WorldIntegrationBoot文件仅为角色摘录，绝不可覆盖整个Boot。参照`integration/WorldIntegrationBoot-character.txt.patch`和摘录在当前完整文件中合并FlowReferenceStandin/AnimRig的对应改动。
4. 从当前真实角色加载点确认GLB、metadata的路径/UUID引用到本候选；清理/刷新对应导入产物。记录加载资源名、候选SHA、资源导入和实例化日志；若导入格式改变，记录原GLB SHA与其对应的派生产物/UUID关联，不要直接比较不同格式字节哈希。
5. 在同一实例测试坐下→坐稳→起身→走路→短停→转身→返回坐下。复现2.8m/4s短停第508帧附近脚踝前折，检查座椅穿裙、袖口压入围裙和坐姿自然度；分别记录仍失败项目，不以碰撞零值代替视觉验收。
6. Cocos原生/手机加载验证尚未完成；需要当前完整项目执行上述步骤。本包本身是最小离线复现，不是可直接启动的完整游戏。

## 已实际完成的统一包测试
- 合包结构：非鞋几何和坐姿morph逐值保持105；鞋原型来自35；逆绑定矩阵相同；14动作各9个采样的所选来源语义最大误差0（candidate.structural-check.json）。
- 本包run-replay.sh实际执行配套TS适配器+控制器，已完成397帧坐稳→起身→站稳→坐下→坐稳。verify_loaded.py核对实际加载GLB、metadata、CharacterMotion和适配器四项SHA，检查身体/裙/围裙morph绑定。
- 此离线适配器不是原生Cocos；GLB通道helper使用归一化线性四元数插值，控制器交叉淡化使用真实球面插值。结构/可复现通过不代表穿模或自然度通过。

## 复现命令
需要Node24、Python3；渲染另需Blender及numpy。在包根目录运行：`bash run-replay.sh`。
随后：`cd source && blender -b -t 2 -P ../candidate/render-review.py`。
输出在`candidate/seat-renders/`。摄影机为诊断视角；蓝板是固定世界坐标椅面包围体，非游戏完整座椅。seat-calibration.json禁止逐帧移动来掩盖碰撞。

## 明确未解决
- 脚35：用户原截图对应短停兜底仍使悬空鞋近水平、小腿倾斜，导致脚踝前侧深折；四条已测试路线零交叉没有覆盖/修复此问题。新foot36还在隔离检查，没有混入此包。
- 坐姿105：肩部隆起、裙侧长轮廓/后侧折叠、坐稳袖口与围裙穿插；起身第73帧裙与椅面穿插。105旧报告的手皮肤通过不等于袖口通过。
- 当前合包局部测试结果另见candidate/combined-keyframes-check.json（若附），其范围仅四个关键帧，不是完整397帧几何验收。
- 原105历史局部计数仅作为复现线索：第12帧手/围裙28、腿/裙69；37腿/裙18、60腿/裙67、73腿/裙53、97腿/裙20。合包下肢已变化，不能把这些历史计数当合包实测值。
- 未验证手机性能、任意转角/所有停止相位；当前风动画名默认路由也有历史缺口，脚35范围说明见integration/shape-domain-contract.json。

## 合并边界
105身体/裙摆 + 35鞋与下肢轨道 + 35代码 + 105元数据七处脚部合同修改。没有纳入111失败椅投影、112未完成袖口试验、foot36尚未完成补丁，也没有将原坐姿模型替换为旧动态模型。原始输入来源Funning0423/yiqifengle交接commit528a8bee0fb6df77b38924cced1e28445f69af47；云端合成是新测试候选，不能称为原交接分支中已有内容。

关键帧几何复测：先运行run-replay.sh，再运行`OPENBLAS_NUM_THREADS=1 python3 check-keyframes.py`（需numpy）。输出recomputed-keyframes.json。包内较旧的原始GLB只供袖口环索引定义依赖，真正回放与渲染入口始终读取candidate/candidate.glb，verify_loaded.py会核对。
