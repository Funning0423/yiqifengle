# R5 当前轮真实入口与持久化验收

基于已交付 bf8040a，仅交本轮差量。源码/schema Issue保持已解决；不依赖用户提供已通关档。没有接入新主线包、R4材质或微信发布。

## 实际入口

WorldIntegrationBoot 三地区按钮从01进入；已有同地区活动局继续当前局，已登记胜利进入合法后续关。WorldNativeComposition在读取持久化保护和完整completionRecorded确认后才允许Next，先正常退出旧lease再进入新lease；完整四关后提供显式印记按钮，重复点击不授第二次。领取写失败进入待保存，真实重试按钮恢复。NativeBoardUI原组件不动，ManagedMobileBoardUI只新增两个只读宿主访问器和清理销毁的resultBack/retry目标；棋盘、目标、脚注与手势代码其余部分不变。

## Fixture 边界

调试fixture入口仅DEBUG可用，强制dot-r5-v12-test-*前缀和fixture-kind来源标记，只接受零/一星主线schema fixture，永不读取或复制用户存档到测试档。主线fixture只是测试门槛，不当真实主线通关。R5所有前关由正式引擎验证动作清关并持久化，没有手工伪造R5前关记录。

## 真实 Cocos Web 结果

官方3.8.8构建exit36。全流程应用a84dde4，构建指纹577891ddc77c17de76e6f08db5593e7bc26a5581fe77d52452c83e2c425b5ec9。真实触摸三地区01→04全部12关、100动作，全部用01/Next/claim/retry按钮，完整checkpoint与验证结果一致，三地区一次印记、重复零授予、领取写失败重试及冷新进程保留通过。

原三条代表关30动作（8+9+13）真实触摸通过；地区前关真实清关准备；三目标语义、暂停恢复、晚手势、返回与无残留UI均通过。五处实际Storage写失败（意图、稳定、成绩账本、活动确认、领奖）及stable/pending/win三种v1迁移，在真实cc.sys.localStorage和新浏览器进程恢复通过，attemptId保留、clear/receipt只一次。

Sky脚注5状态（atlas、点击、touchcancel、横屏、竖屏返回）.66比例保持。浏览器touchcancel自身不可取消警告单独记录，未隐藏为应用错误。真实Native UI动画的180ms回调在触摸退出销毁后强制执行两次，不改存档、不复活UI；随后同一attempt继续完成一次。

已保留首次领奖重试旧目标引用失败证据，修复后全链重测通过。第一次30动作通过记录也保留。

最终应用833082b只改两句提示：印记已领取状态和空档锁关中文解释。最终官方构建exit36，指纹67dafb2d03ec1b2878f38482659eab00a739a3d8c6bae86206f48fa0b7d547eb。没有再重复整套130动作；该构建针对变化做了实际冷Native UI已拥有印记按钮/重复零授予、两种viewport实际caption/back/claim无重叠、新空档01正常锁关且六键零写的验证。其他游戏/会话/手势字节与全链构建相同，final-acceptance-summary含冻结SHA证明。

完整UUID runID、UTC时间、实际viewport及各自构建指纹见报告；不能将不同构建测试写成同一个运行。真实测试均为Mac Chromium，不是手机或真OS后台验收。B仍是流程参考占位；未证明衣裙、碰撞、手机帧率、发热。

## 交付

源码差量以bf8040a为基底，不重复已交整包。报告/截图为本轮实际证据。新主线适配包留待下一轮明确安排，当前不下载或混入。
