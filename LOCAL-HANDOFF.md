# Task21 — 我的电脑本地接续

用户明确要求从标题带“云端”的旧会话改由“我的电脑”执行。本文件交接同一工程，不新建候选或重复审计。

## 安全接续前提

先确认新会话实际主机为 local/界面“我的电脑”；否则只报告，不编码或测试。旧任务已停止全部审计、测试、构建和打包进程；官方 `evidence/199-final-close.json` 确认当前测试窗口 s17 已关闭，IDE 保持运行。只允许一个执行者、一个测试窗口。不要自行向父聊天发送消息。

工程根 `/Users/shineanl/Documents/Codex/2026-10-15/task-21`；已有 Git 副本 `integrated-source`，完整包 `native-package`。先读取 STATUS.md、CHECKPOINT.md、deliverables/task21-report.md、deliverables/receipt.json 及相关 .agents/skills、官方 wechatide-skill。不要使用 obsolete 的 native-package-startup-rejected 或 rejected-deliverables。

## 已完成，不要重复

最终源提交 `751905c985e4e0c898f395456c3b2a41ff7a1376`，分支 `task21/cloth-clearance`。人物修复提交 `6fbf61f0cf314e75437d4d2e13554c9bdd63cf1a`；后续提交只补 task21 随机隔离前缀允许项及模拟验证。工作区干净。

已完成并保存2213个 task20 真实动态帧的离线精确配对审计：失败1760→1602，新增0、消失61180，类别计数增加姿态0；回坐14/66→0，起身14/72→8。读 `evidence/final-offline-pairs-summary.json` 和 rows；原审计已完成，不重启、不重新求解。不将离线结果冒充新包原生验收。

GLB SHA256 `42ca2486ad1ecdfb5070d6e2991042b60476b90b609859f39398fbcbacebafec`；meta `cefb3e4261592da20be40c9ada49a8f51354fc93f5557da7f178c79b40ea60e6`；CharacterMotion `3ef288ff12a8f8512e07a3ea2f94819e984cc70a9d9d4a38b5a9c69e1523b657`。完整Cocos构建Finished，BUILD_SHA751905c；509文件包 canonical `e1816aec5f822efa9829fef78e6b880d1696b00301870ed3f2e5e039c7b322c9`。完整补丁及包清单哈希见receipt。不要无依据重建已验证包。

## 未完成，继续执行

新包短查询已读回匹配的 BUILD/GLB/meta、动态Prefab `dce9f061-7913-4893-9eb9-35e039adda3c@6af54` 和四个动态网格，静态坐姿未实例化。但完整自然路线未完成，GPU morph目标绑定尚未独立确认。

官方自动化桥曾超时；起身四个驱动读回姿态（0.100/0.200/0.216667/0.733333秒）精确复算3→1失败、新增0/消失87，只有部分读回。前侧背截图哈希相同、仍是旧坐姿，与相机和姿态不符，均已排除验收。只渲染刷新虽验证骨骼/权重/时间不变，画面仍未同步；桌面工具随后超时。不要沿用这些无效图或把CPU图当实拍。详见 image-sha256.json、stale-runtime-attempt、119-render-proof、122-active-camera-diagnostic、123-live-console。截取时要先证明显示与当前姿态/相机同步。

先在本地恢复官方桥及真实帧显示同步，再用同一完整包、一个窗口，通过官方CLI自然坐稳→起身→转身→行走→短停→返回回坐。读取相关脚本，但不要盲跑 run_native_route.py：先短只读探测 bridge/globalThis.__gameContextWindow，避免等待函数长超时。核实际 BUILD_SHA、GLB/meta、动态Prefab、实际渲染器 morph绑定；用真实 post-solver TRS、交叉淡化计划及实际形变权重逐帧比较七类严格三角形配对身份/SHA和新增消失索引，不仅比较计数。

亲看无遮拦前侧背及正常游戏画面，记录真实改善和未改善项。目标约walk_loop0.673秒围裙两处露黄及起坐裙腿；保留掌根后段、早起身回归修复、508靴口、腰部白块、UI/草原。不隐藏/删除几何，不放宽阈值。后跟整片接地和双腕全角度仍OPEN，未验不得关闭。全部原生验收完成后才能冻结。

正式存储只做前后字节SHA256，不语义读取/写入/删除。已有 hash_protection.py 基线80正式存储文件、479正式包文件；task20原输入源码2236/包509及旧交付保持不变。测试继续严格随机task21隔离前缀，不改凭证权限，不微信上传/发布、不GitHub推送、不Drive写入、不装软件。结束只关本轮窗口，不退出IDE。

通过当前正常Library技能保存少量合格亲看实拍；失败最多一次正常重试，不绕过拒绝，无确认ID不算交付。当前合格修复实拍0、Library确认ID为空，未提交保存。收尾交付最终提交、完整补丁和包清单SHA256、失败/精确配对结果、截图哈希、Library确认ID及后续入口；仍有阻塞则明确OPEN。
