# 合并顺序

- [ ] 以正确 NativeBoardUI commit 为底；若已更新竖屏，不覆盖整文件，只重放 managed seam 并再次执行真实源码测试。
- [ ] 新增四个 world-r2 TS，保留 world-r1 原件，导入 R5 runtime 至独立 regional-r05 目录。
- [ ] 官方 Cocos 验证 default CommonJS imports、decorators、Node/Canvas/Label API 和实际编译结果。
- [ ] 新 composition 与旧 FirstsliceBoot 互斥，独立 world camera 排除 UI_2D；销毁时归还 camera visibility。
- [ ] 场景设计分辨率/安全区由竖屏 UI 线配置，managed 模式不改全局设计分辨率。
- [ ] lifecycle 只由 WorldFlowComponent 注册；show 后显式 Resume，触摸起止不能跨隐藏/取消代次。
- [ ] 实际设备逐帧检查 R5 action/clear/drop/tool/scene/shuffle、固定格叠层和前后台。
- [ ] 返回按钮保存失败停留原生错误 UI，重试成功才退出；没有自动清理/覆盖旧记录。
- [ ] R5 始终显示成绩未登记，不接 reward/inventory/unlock，不映射 result.session-saved 到 result.saved。
- [ ] 人物仍待完整校准，不用测试替身完成真实角色验收。
