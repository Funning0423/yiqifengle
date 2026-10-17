# Oi，Funning 的助手：首次启动最小对照诊断

Creator 3.8.8；微信开发者工具 Stable 2.02.2608080；实际基础库 3.17.3。源提交 8523f92。本轮没有修改 finalizer、游戏逻辑或正式存档，没有合入 0008、0005b、0007。

| 对照 | 配置 | 首次打开 | 仅该窗口重新打开 |
|---|---|---|---|
| E：纯 wx canvas，无 Cocos | condition 删除，enhance=false | 实际 marker + 同一 app.json 红错 | 有效完整日志有 marker，未见该红错；稳定后再次采集一致 |
| F：同 E 的 game.js/game.json | 完整恢复官方空 condition，enhance=false | 面板空白，剪贴板为陈旧文本，不能判通过 | 有效日志有 marker，未见该红错 |
| G：当前 R6 Cocos/音频构建 | 完整恢复官方空 condition，enhance=false | 面板空白，陈旧复制不能判通过 | 实际 LoadScene、首页显示，仍有同一红错 |

完整错误：`[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 (env: macOS,mg,2.02.2608080; lib: 3.17.3)`。

E/F 的重新打开日志没有该红错，不能当成首次打开通过，也不能据此证明恢复 condition 修复。G 恢复官方条件后仍报错，否定该字段单独修复的结论。G 与现构建非配置文件 SHA 完全一致，见 summary.json；G 只改项目名与 condition。没有清控制台，未关闭其他项目；CLI open 成功也不当作运行通过。截图、原始日志和错误保留，NOT-CONSOLE 文件明确无效。

官方安装模板及原实际构建 condition.game 均包含 currentL:-1、current:-1、list:[]。原 finalizer 的 enhance=false 修复及 SHA 保持不变。原件和短诊断已交到 to_grokbot，见 source-and-handoff-receipt.json。

只读安装包源码追踪发现 JSON_CUSTOM_COMPILE_PATH_NOT_EXISTS 由通用启动页检查 realNotFound 分支显示；isGameApp 读取 attr.gameApp，启动流程中读取 getAppConfig 和更新运行属性的顺序值得进一步核对。这只是定位线索，尚未验证为根因。未修改供应商二进制或读取其他业务记忆。

存档补充已经交接；实际接线位于 creator-build-project/assets/scripts/world-r2/PersistentMainlinePort.ts，使用 Cocos sys.localStorage、dot-mainline-r1-isolated-20261009: 命名空间。原 forest-v33-journey v3 和历史键没有覆盖；不能把隔离测试进度当作用户正式进度。本轮没有重复运行玩法测试。

结论：首次启动红错仍未关闭，无已验证配置修复。手机性能、发热、实际听到声音均未验收。
