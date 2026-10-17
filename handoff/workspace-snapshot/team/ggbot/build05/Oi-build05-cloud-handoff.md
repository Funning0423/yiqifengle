# task21 地区整合：本地停止与云端交接

整体 **OPEN / NOT FROZEN**。用户要求本地当前轮安全结束后转云；本轮已停止，不再续开本地任务、构建或修复。主线程负责云端接续；此交接不代表云任务已创建。

最终源码提交：`3bda6a93ed9381bc6eddb6bf4ee236f00af47060`。分支 `task21/three-region-ambient-color-20261015`。源码目录 `../source-build05/`。完整补丁基线为原 task21 冻结源码 `751905c985e4e0c898f395456c3b2a41ff7a1376`，原输入未改。若云端没有该基线，直接使用本目录完整源码压缩包，勿将补丁套到不匹配的旧提交。

## 交付身份

| 项目 | SHA256 |
|---|---|
| 完整二进制补丁 task21-regions-build05-complete.patch | f67d6652872a97267491c5d1182b1ab34a67875126d0cbafd4032e12f19c2a06 |
| 完整源码 task21-regions-build05-source.tar.gz | e99059f72b0147bb902991bbb4feccf516d4ab9e140e1bba50d6fc4d08990bdc |
| 完整 Web 包 task21-regions-build05-web.zip | 623ac8287156bf5ff021948f3e7857b6f59e05532db2e275db9e3f47d7f3a554 |
| Web 产物逐文件清单文件 | 9387d099660c5b776ac8536ebfa0cdd35ccddfdcc611d419e651a5dc4a66fb05 |
| Web 产物 canonical | 2b3d367bcc38004242a6d0ec0a9055cc571bc3d774c95685d88e93d127a910f9 |
| 完整源码逐文件清单文件 | bb9c847e358d2c40f4c6edba2b6339671635e1669cd9567c76764528f882eddb |
| 完整源码 canonical | 8196e039286b63f8d1b033bf005a746be0a6441ebd6394832b4c9508def35d5d |
| Creator 620 项输入 canonical | c0c3ec90597a25bafbf4106200893ea0dac8cccc4f5aa14dfd252c98de6b45f1 |
| 原冻结输入2244项清单文件，收尾零差异 | 9183915105c982a82389633ceca4ea30cf4cfefc0f8369e694002814af74484c |

完整源码压缩包128662370字节，2759文件；Web ZIP14391680字节，497成员（489产物及8份来源证明），均逐成员SHA核验。补丁1837500字节，`git apply --check` 在原输入只读通过。清单和封装收据见 `complete-source-manifest.json`、`final-integrity.json`、`package-receipt.json`。输入/输出完整逐文件清单也在Web ZIP的 `provenance/`。

官方 Cocos Creator3.8.8 构建退出36，包装器退出0。实际源码和编译脚本的 **BUILD_SHA仍为`dev`**；不能把最终Git提交写成运行时BUILD_SHA。包身份以清单、provenance和实际实例读回为准。

## 本轮完成的实质修复

1. **天空城08→09的`null.wrapMode`异常**：inactive prefab仅预载动画，首次激活时再创建并播放状态。保留资源/片段校验、暂停和销毁合同。build03实际走通并验证环境循环及机器人待机均推进。
2. **桥材质和包围盒**：管线状态在Material.initialize设置；createMesh计算包围盒，避免无效override警告。七条桥材质warning由7变0。没有通过隐藏几何验收。
3. **桥错位24米**：Z插值错误从终点起算，造成无桥连接与末端折返。只改为起点起算。build04实际04→05从75.8584米恢复到32.3660米，脚下桥面已亲看。
4. **区域道具备用图标/拖拽图标缺失**：同节点Sprite和Graphics冲突，改为独立子节点，并给无贴图拖拽图标同样的备用绘制。离线6/6渲染、24/24输入回归通过；真实区域工具画面未运行。
5. **户外黑影的环境色导入丢失**：build04实际户外HDR天空/地面RGB均0，官方编译场景也是零Vec4。原scene把Vec4字段存为Color，导入器忽略r/g/b。build05只改两处格式为归一Vec4。编译天空色已为(0.2,128/255,0.8,1)，地面恢复引擎默认(0.2,0.2,0.2,1)，亮度20000及其他scene字段不变。**户外画面改善尚未实测，不能关闭黑影项。**

没有改角色/椅子、动画采样、形变、骨骼、区域模型几何、旅途镜头、昼夜设定或主光参数。build05相对build04唯一产品改动为两处环境色编码；其他是隔离路径重绑定和说明。

## 已完成、失败与未运行

| 构建 | 检查 | 结果 |
|---|---|---|
| build02 | 04→05 | 实际走通；首次旅行因本地服务结束失败，恢复服务后正常Next成功，记录保留 |
| build02 | 08→09 | 实际失败：loadProgress0.72，TypeError: Cannot set properties of null (setting 'wrapMode')；3609帧，网络/console/pageerror均0，错误在world state |
| build03 | 两次fresh启动 | 489个HTTP文件SHA全部匹配，启动/动态角色门槛通过 |
| build03 | 08→09 | 4414帧，errors0；进入09，60RAF内sky_ambient_loop和robot_idle均前进0.9999秒 |
| build03 | 04→05 | 3916帧，errors0；进入05；测试脚本先遇暂停面板呈现竞争，失败记录保留，正常Resume后成功 |
| build04 | 启动+04→05 | 启动489文件核验通过；1745帧，errors0；32.3660米自然完成；户外零环境色证据闭环 |
| build05 | 官方构建及离线身份 | PASS：620输入前后字节一致，489产物核验；原输入2244文件零差异；原角色等8文件保持 |
| build05 | fresh启动判定 | **INCONCLUSIVE**：先有home-startup.png，但收尾重复触发覆盖cli-result.txt，第二次因页面已加载不满足about:blank前置条件。不能据截图/HTTP日志补报完整启动通过 |
| build05 | 停止现场只读 | 唯一页，home、characterReady=true、loading.ready、error=null，动态角色UUID/GLB/meta读回正确；页面已关闭 |
| build05 | 04→05、08→09、户外RGB与黑影改善 | **NOT_RUN**，按用户停止本地要求交云 |
| build05 | tideAnchor/prismShift实际显示与拖拽取消 | **NOT_RUN**；离线已通过，测试适配器已保存但有入口限制，见下文 |
| 本地区整合轮 | 人物2213帧精确配对、完整自然起坐行走、后跟/双腕 | **NOT_RUN / OPEN**，未借用地区状态帧数冒充几何审计 |

build03正常05、09棋盘已亲看；过桥前景遮挡也已亲看，不能用于视觉通过。build04桥脚下可见但人物仍黑。build05只有原角色原椅子的居家现场，未证明户外或起坐/裙腿通过。状态帧计数是world/journey真实RAF轨迹，不是骨骼三角形配对计数。

## 原角色与审计边界

原配套GLB `42ca2486ad1ecdfb5070d6e2991042b60476b90b609859f39398fbcbacebafec`；anim_meta `cefb3e4261592da20be40c9ada49a8f51354fc93f5557da7f178c79b40ea60e6`；CharacterMotion `3ef288ff12a8f8512e07a3ea2f94819e984cc70a9d9d4a38b5a9c69e1523b657`。原椅子GLB `d156b7a05017713e88ec965254c1b832ffe4f10ee75fc554f8cc7ab19ff5bf2a`。

动态Prefab `dce9f061-7913-4893-9eb9-35e039adda3c@6af54`，四动态网格APRON/BODY/BOW/DRESS；停止现场staticHomeInstantiated=false。八份受保护文件（角色/anim_meta/运动脚本/椅子及meta）逐字节等于原输入。

历史task21原人物报告仍在 `/Users/<mac-user>/Documents/Codex/2026-10-15/task-21/deliverables/task21-report.md`：2213历史帧离线失败1760→1602，精确新增0/消失61180；4个原生新帧失败3→1、新增0/消失87。这些是历史结果，**未在当前地区包重跑或重新验收**。起身8帧、行走围裙可见露黄、裙腿、后跟和双腕全角度仍OPEN。后续新角色/动画/椅高/mesh/root需使用主线程的配套冻结清单，勿单独替换。

## 截图及Library

`screenshots-manifest.json`列出8张已亲看本地截图、逐图SHA、构建和验收状态。主线程要求的两张build03图：

- `../source-build03/output/playwright/route08/skycity-09-entry.png`，SHA `48481e62e1e977830aad6146c71341fdd36da2372951de95552e95b6973ee17d`；实际进入09，正常棋盘可见。
- `../source-build03/output/playwright/route08/meadow-skycity-midjourney.png`，SHA `ef46259a26c980884d698b52fd584a498088d20197b63e47900765b063a4930b`；遮挡FAIL/OPEN。

两图正常Library prepare成功，但未改动的官方传输helper因缺azcopy返回0个已传文件，未调用finalize。**确认文件ID为空、版本为空、交付状态NOT_DELIVERED**。不把临时upload_session/file_id当Library交付ID；没有继续重试、改helper或绕过失败。`requested-library-delivery.json`保存确切失败。此前build02居家图曾独立成功：`libfile_14441a7af03481918de99fdbcbf2e98a` v0；不能替代本次两张build03图。

## 云端后续入口

先核本目录源码/补丁/Web包SHA，再检查云环境实际具备的官方CLI、WebGL和截图能力。可以运行已构建Web包；若要重建，需官方Creator3.8.8，重绑定builder中本地splash绝对路径并作为新输入记录。没有该能力的项目保留NOT_RUN，勿冒充验证。

本轮测试适配器和原始结果都在证据包中 `build03/`、`build04/`、`build05/`。build05 `route04/`、`route08/`脚本已准备但未执行。先重建完整fresh-startup证据，再按一个窗口/一次一项执行04和08自然最后交换→result.saved→Next→过桥→下一关。记录实际包身份、每帧state以及无遮拦正常画面，检查编译环境色的户外实际值。

R5备用图标适配器 `build05/regional-tools/adapter-freshHomeTide.js`、`adapter-after09Sky.js` **未执行**。已知门禁：useTestFixture只接受home/island；正常退出09会恢复skycity；仅R5 synthetic主线记录也不能满足世界mainline journey解锁。因此after09Sky应如实报告门禁，不能强改计数或假装跑通。云端应设计可合法达成的隔离测试入口，必要时作为单独代码修复审查。

所有测试使用隔离临时浏览器和明确synthetic命名空间，未语义访问正式存储。Web段未改正式存档；历史原生80文件前后字节哈希证据保留。未进行新GitHub推送、Drive写入、微信发布或凭证/权限变更。

本轮03/04/05测试窗口均已关，三个本轮静态服务也按精确PID/命令匹配停止；IDE、无关8781及先前冻结8792未动。`local-stop-receipt.json`和原始close文本可核。**不再新开本地任务；剩余工作只由主线程在云端接续。**
