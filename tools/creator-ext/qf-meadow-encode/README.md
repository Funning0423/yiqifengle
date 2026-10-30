# qf-meadow-encode（Creator 3.8.8 一次性项目扩展）

用途：不需要点 UI，就把 `db://assets/bundles/region_meadow/env_meadow.glb` 的 `userData.meshCompress.encode` 设为 true（Compress 保持开、Quantize 保持关、其他字段一律不动）。设置完由 Creator 重新导入并自己生成 .meta，然后写日志、写标记文件、退出 Creator。

## 流程（main.js）
1. 写入 LOADED，之后每秒轮询一次 `asset-db` 的 `query-ready`，直到返回 true，最多等 30 分钟。
2. 调 `query-uuid(DB_URL)`，结果必须等于 `bb978abb-d907-5dba-be5a-14cc64f5e596`。然后调 `query-asset-meta(uuid)` 读出 meta。
3. 用 `transform.js` 的 `transformMeta` 做纯函数改写：只把 encode 改成 true。如果 meshCompress 不是预期的状态，直接报错，不保存。改写后依次调用：
   - `save-asset-meta(uuid, JSON.stringify(meta))`
   - `reimport-asset(uuid)`
   - `query-asset-meta(uuid)`，读出改后的 meta
4. 写日志 `<项目>/meadow-encode-ext.log.json`，内容包括：
   - before/after 的 meta 对象，以及磁盘上 .meta 文件的原文
   - 每步的耗时、错误
   - status：DONE / DONE_WITH_ERRORS / FAILED

   重新导入后如果 `subMetas["0e588"]` 还在，只记一条 `SUBMETA_0E588_REMAINS`，**不会手动删除**。
5. 在扩展自己的目录里写标记文件 `.qf-meadow-encode.done`。标记文件存在时，扩展再被加载也不会重复执行。
6. Console 打印 `[qf-meadow-encode] DONE`，5 秒后调用 `Editor.App.quit()`。设了环境变量 `QF_MEADOW_EXT_NO_QUIT=1` 时不退出，由测试部按 PID 关闭 Creator。

## API 出处（全部按 @cocos/creator-types 3.8.8 核对，npm 包 `@cocos/creator-types@3.8.8`）
- `editor/packages/asset-db/@types/message.d.ts`：
  - `'query-ready'` 无参数，返回 boolean
  - `'query-uuid'` 参数是 string（url），返回 `string | null`
  - `'query-asset-meta'` 参数是 string，返回 `IAssetMeta | null`
  - `'save-asset-meta'` 参数是 `[string, string]`（uuid，meta 的 JSON 文本），返回 `AssetInfo | null`
  - `'reimport-asset'` 参数是 `[string]`，返回 void
- `editor/packages/asset-db/@types/public.d.ts`：`IAssetMeta { ver, importer, imported, uuid, files, subMetas, userData, displayName }`
- `editor/editor.d.ts`：
  - `Editor.Message.request(name, message, ...args): Promise`（第 393 行附近）
  - `Editor.Project.path`（第 739 行附近）
  - `Editor.App.quit(): void`，注释为「退出程序 / Exit the program」（第 71 行附近）
  - `Editor.Package.enable(path)` / `disable(path)`（第 515 和 521 行）
- 扩展结构（`package_version: 2`、`main`、`editor`）、`exports.load` / `exports.methods`、项目扩展目录 `${项目}/extensions`：
  - https://docs.cocos.com/creator/3.8/manual/en/editor/extension/first.html
  - https://docs.cocos.com/creator/3.8/manual/en/editor/extension/install.html
- Mesh Compress 选项（Encode/Compress/Quantize）：https://docs.cocos.com/creator/3.8/manual/en/asset/model/mesh.html

## 已知风险（未能在 box 上实测，box 没有 Creator）
- **启用状态**：文档（first.html / install.html）写明，新放进 `extensions/` 的扩展**默认不启用**，要在扩展管理器里点「启用」。启用状态存在哪个文件，官方文档和类型定义里都没写；Creator 内部的包管理器是加密的 .ccc，看不到。所以不提供手改 profile 的做法。MAC-STEPS 里用 LOADED 日志判断扩展有没有启动；没启动就停下回报。
- **无头构建**：3.8.8 的 `launch/dist/launch.js`（Mac 上的 app.asar 和 box 上的源码一致）显示，`--build` 模式会先执行 `scanPackage()`，扫描范围包括项目的 `extensions/`，再执行 `startPackage(...)`，然后马上开始构建。所以无头模式下项目扩展会被扫描、加载（同样受启用状态限制）。但我们的异步改写会和构建同时进行，存在竞态，所以**不推荐**用无头构建来跑这个扩展。推荐的做法是用 `CocosCreator.app` 的二进制加 `--project` 启动窗口，全程不点任何东西。
