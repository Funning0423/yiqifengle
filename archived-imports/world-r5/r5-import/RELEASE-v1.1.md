# R5 v1.1 候选：接入与兼容闭环

基于已交付 v1，12 个关卡、36 个发布 seed、r5.1 内容版本与规则不变。已上传 v1 的 ZIP、manifest 和 SHA 均保留；v1.1 另行命名、另行打包。

本候选新增：
- 已知 Babel 7.28.5 链的五种输出验收与逐项确定性对照，覆盖原 Set/Map loose 展开故障。
- provider 补 cancelPreview(token)，统一过期返回码 stale-token，补 snapshot.storageKey；复用真实 R4 COMPAT binder 的模拟测试。
- Cocos 3.8.8 的逐项实际接入检查单，明确预览、动画、固定格棋子和终局状态差异。
- 尚不接线的 attemptId / completion receipt 契约原型与九组故障测试。它不随导入包进入 assets，也不发奖励。

入口与发布边界：
- R5-IMPORT-ONLY-v1.1.zip：仅运行时和接入文档。
- R5-DEVELOPMENT-v1.1.zip：源码、报告、离线编译工具、契约原型。
- V1-FROZEN-PROVENANCE.json：已交付 v1 的 archive SHA 与原 delta manifest SHA。
- DELTA-MANIFEST-v1.1.json / ARCHIVES-v1.1.json：本候选文件边界和 SHA。

实际 Creator 导入、TypeScript 声明编译、手机与高手体验仍待验收。通关账本仍未接入，completionRecorded=false 不变。

复跑：

    npm test
    npm run compat
    npm run test:completion-contract

compat 仅使用已有编译器，不自动安装依赖。如果自动发现不到，设置 R5_COMPILER_ROOT 指向已有 pinned Babel compiler 目录；R5_ORIGINALS_ROOT 可指向原 gameplay 目录以验证 85 个来源原件。缺少原件时普通测试只检查固定兼容引擎哈希，不伪报整个外部边界已检查。
