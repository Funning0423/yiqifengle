# r3-diag

在 r3（f3d3614）后面只叠了 Voice Bot 的诊断打印 a47c8fe，叠上后的提交是 385a934。shader 修复 803b59c 没有叠进来。

- HEAD：385a9340d04e55e1e27063ea65f6d4240456667c
- 套件：70/75，只有已知的 5 项失败；lakeside-diag 等湖畔测试全部通过。
- 正式包：不会运行，cc DEBUG 为 false。包体只多几十字节代码。
- 用法：在 Mac 的调试构建里打开湖畔棋盘，URL 带 ?lakediag=1。控制台会打印一次 [QF_LAKE_DIAG]，内容是 isHDR、toneMappingType、渲染管线、是否开启后处理、曝光、主光照度和 skyIllum，请原样回报。
- 如果 r3 的 Mac 构建已经开始了，不要打断，诊断用调试构建单独跑一次。
