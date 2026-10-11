# 来源和第三方声明

runtime/vendor/engine.js 从用户现有 R4 COMPAT import-only 包逐字节复制。原游戏源代码权利归原权利人；来源未提供独立商业分发 LICENSE，本包不构成对商业授权的法律确认。

兼容引擎内可能包含 Babel 生成的辅助代码，随包保留 BABEL-HELPERS-LICENSE.txt。

本轮未安装依赖、下载新的第三方运行库、引入付费服务或外部美术。runtime 中所有 require 都是包内相对引用。Node.js 自带模块仅用于包外测试/作者工具，不应导入 Cocos assets。
