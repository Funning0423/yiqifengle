# 包体诊断与无损修复 · 未冻结候选

**总包门禁现已通过。没有删原资产、改门禁、降低网格/贴图质量或上传GitHub/微信。角色三项视觉仍FAIL/OPEN。**

## 增量与重复/未引用排查

最初完整组合包37,403,163B，比已测角色包30,324,857B增加7,078,306B。草原分包由437,610B增至7,501,725B，增量7,064,115B；主线/UI代码约增加19,862B，另有测试入口/配置封装差异。主体是草原网格：23个独立UUID的native网格共5,932,092B。1150草/花实例按task8交接合并展开，保留布置与风数据；并非同一Prefab被意外复制两遍。

全包严格字节重复去重的理论上限仅21,948B，不能填平约5.95MB门禁缺口。重复主要是小mesh或72B ImageAsset描述；其UUID/引用/原生纹理可能不同，未擅自合并引用。大型约563KB的builtin effect序列化块分布于不同包，当前完整块不相同；跨包共有依赖可以继续评估，但不当作已经安全去重。

发现两个可能未引用的legacy JSON：combined_anchors_m 24,840B、combined_collision_proxies 110,492B。全资产源码/scene的字面路径与UUID搜索没有引用，但动态加载及完整序列化依赖图尚不足以证明可删；保留原资产和构建条目。没有拿未经证实的删除来过门禁。

## 已实际应用的安全修复

代码提交`86a57ad1ea4b26657c441fbad619812606712ad4`仅在草原与房间GLB的导入meta启用：`meshCompress={enable:true,compress:true,encode:false,quantize:false}`。不减面、不量化、不改材质/贴图/原GLB/动画/角色代码。现有Cocos3.8.8引擎已包含zlib Inflate；未新增meshopt模块或改网络/权限。

官方Creator实际构建exit36/8秒。72个mesh存储二进制减少7,249,772B；全部用zlib解压后逐字节与保留的原完整包比较，SHA256完全相同。JSON标志等增加2,297B，因此总包净减7,247,475B。全部PNG/JPG/MP3以及region_island原生载荷逐字节未变。

| 包体 | 原完整候选 | 无损候选 |
| --- | ---: | ---: |
| 草原分包 | 7,501,725 | 3,397,723 |
| 房间分包 | 7,196,731 | 4,053,258 |
| 主包（未加隔离入口） | 3,045,174 | 3,045,174 |
| 全包（未加隔离入口） | 37,403,163 | 30,155,688 |
| 当前实际隔离运行副本 | — | 30,161,359 |

30MiB门禁31,457,280B保持，实际运行副本余量1,295,921B。原combined-package及其完整SHA清单仍保留：canonical SHA `66be95f966f8ed8faed40175263b894a0a50bf2ff4e4d5a74c201afd4003f0ca`。无损构建包canonical SHA `883c69af4621680a1923ef3a170d4c0685b21c2a2d5e10676716c73709d9a20b`；当前隔离运行包 `c28ab4c52482c90037e417732af39a685252867b9376f32b7683aef8b21801cf`。逐文件完整SHA见对应post-lossless-manifest。

## 实际运行边界

在原s8窗口刷新到完整组合包，路径和随机隔离存储前缀保持，未开第二窗口。home正常ready，已亲看combined-home-lossless.jpg。新UI代码已实际显示，角色原资源仍在；没有重新执行坐起走停的角色验收。

实际房间49个mesh、草原23个mesh均成功引擎initialize/decode，compressed/encoded/quantized标志均已关闭；其实际解压缓冲长度与CRC32全部对上原始网格。独立离线逐字节+SHA256核验提供强校验。草原仅加载/初始化资源，没有挂新场景、操作奖励或改变游戏流程，所以**不能宣布草原相机/草浪/风车/GPU视觉、04→05、UI比例全部验收通过**。手机解压时间、峰值内存与发热仍未测；无损压缩不降低解压后的网格量，原6,409,332B派生GLB及≤2MB来源目标也未改变。

正式80存储文件与479正式包文件按字节长度/SHA在本阶段结束仍与task20基线一致，未解析正式存档语义。无新上传微信/GitHub、可见性或凭证更改。

## 角色有效失败图与原生附件

失败版本均为`aa164cbed2a5cc4f79eacf3a3fe942bf955446a9`，已实际看过，按本轮明确授权保存到Library。它们是此前实际失败图的原字节交付，**不是新修好的效果或新动作测试**：

- [脚部508帧 · FAIL/OPEN](https://chatgpt.com/api/library/files/libfile_c8707a187e408191b4b88996f01e01df/download)：悬空鞋近水平，前踝折块/后跟轮廓异常。源frame508刚性底最低约4.02cm、toe/heel角约-1.38°，小腿约34.98°。不满足放松落地前脚掌的要求。
- [起身中段0.601s · FAIL/OPEN](https://chatgpt.com/api/library/files/libfile_79a95fbdc1808191b9df74ce0212b5b0/download)：躯干/颈部姿态问题。真实触摸起身首帧连续子项数值成立，不推翻中段视觉失败。
- [腕袖0.603s · FAIL/OPEN](https://chatgpt.com/api/library/files/libfile_97711748d9208191927465cf4d97f947/download)：袖口与手腕断裂感。骨骼父子/权重结构有效，不等于视觉正常，未先断言根因。

另有[新组合包home候选预览 · OPEN](https://chatgpt.com/api/library/files/libfile_2733935a7730819184e626a553f79a63/download)，版本86a57ad，仅证明启动/资源解码与当前画面可展示，不能称人物已修好或四项关闭。四个native file_id及版本0在Library receipt JSON中。

采样修复前的旧stand-continuity-*及旧shortstop*受控暂停图失效，不能用于连续性/视觉通过；修复后的current-*仍是有效失败证据。坐稳118袖口/围裙、30腿/裙失败也保持。四项UI-SCALE、REGION-MEADOW、CHARACTER-FEET、CHARACTER-SITTING均OPEN；foot36尚未收到。没有跨线程主动报送来绕过此前拒绝，交由平台read/最终结果回报。
