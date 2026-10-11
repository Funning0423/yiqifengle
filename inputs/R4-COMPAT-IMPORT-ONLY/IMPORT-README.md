# R4 COMPAT — IMPORT ONLY

本包不含负例、测试夹具、编译器或旧版原始代码。

唯一导入根目录：compat-runtime/

将 compat-runtime/ 的内容放入一个独立 Cocos 脚本候选目录，并保持 runtime/ 与 adapter/ 两个子目录的相对位置。入口：runtime/challenge-controller.js。这里所有静态 require 都是包内相对路径，依赖已逐项检查存在。不要将本文档目录整体当成 Cocos 工程。

这是已通过 Node 语义验证的兼容候选，不是 Cocos 已验收版本。它已修复 Set/Map 展开可能被编成 [].concat(collection) 后造成的 snapshot 递归与 checkpoint [{}] 错误。源修补只有两个文件六处表达式，预编译使用严格 Babel 配置去除相关语法；没有更改规则、关卡、种子、存档 key、版本、奖励策略或美术。

ADAPTER-CONTRACT.md 描述原 R4 的接线边界。包内 adapter/cocos-port.js 是原 R4 示例的兼容编译版，不包含 Mac 离线前独立编辑的薄适配器。实际导入引用、Cocos CommonJS/TypeScript 互操作、场景绑定与 Mac 编译脚本需整合者逐项核对，不要整包覆盖已有工程或 .meta。

完整 QA 包与本导入包分开；本包没有“original-loose-unsafe”或任何故意失败代码。完整 QA 报告确认四种源/编译条件均通过六套原测试、103 固定种子/803 动作及双向各 309 次正确 checkpoint 恢复。尚未运行本候选在实际 Cocos 生成页面、手机或实际存储上的验收。

正确原生 R4 存档不需迁移。若旧错误编译已产生 moss:[{}] / roots:[{}]，控制器会继续只读保留原字节，不能静默清空或重写。先备份并诊断是否为可丢弃开发数据。

必须保留 BABEL-HELPERS-LICENSE.txt。运行时不依赖外部 npm 包，但需要原 R4 已使用的 ES2015+ 内建功能，例如 Set、Map、WeakMap、Promise、Array.from、Object.entries/values 和 Math.imul。ES5 语法输出不是 IE11 支持承诺。
