# tools/vendor-node：开发 / QA 专用锁定工具链

**不进游戏。** 本目录位于 `creator-build-project/` 之外，Cocos 不导入、不构建，也不进微信包。`node_modules/` 和 `node-runtime/` 由本目录的 `.gitignore` 排除，不提交。

## 锁定版本
| 组件 | 版本 | 锁定方式 | 用途 |
|---|---|---|---|
| Node.js | **23.11.0** | `node-version.json`：官方 URL 和各平台 sha256，`fetch-node.sh` 下载后校验 | 所有测试的运行时；作者的 wiring 测试需要 `module.stripTypeScriptTypes`（Node 23.2 起才有） |
| typescript | 5.8.3 | `package.json` 精确版本 + `package-lock.json`（sha512 integrity） | 转译和全工程类型检查 |
| @cocos/creator-types | 3.8.8 | 同上 | 官方 `engine/cc.d.ts`，和工程的 Creator 3.8.8 一致 |
| @napi-rs/canvas | 0.1.65 | 同上（各平台 optional 二进制都在 lockfile 里） | 作者 cloud-ui harness，也就是 wiring 测试需要 |
| draco3d | 1.5.7 | 同上 | T1 几何解码夹具 |
| terser | 5.36.0 | 同上 | 包体增量估算 |

Node 各平台的 sha256 来自 https://nodejs.org/dist/v23.11.0/SHASUMS256.txt：
- linux-x64：`fa9ae28d…54e7cf5`
- darwin-arm64：`635990b4…621bb0`
- darwin-x64：`a5782655…1c9dab8`
- linux-arm64：`85915f88…1a883c6`

## 干净检出后的步骤
```sh
tools/vendor-node/setup.sh          # 下载并校验 Node 23.11.0 → node-runtime/；然后用它执行 npm ci（严格按 lockfile）
tools/t1/run_box_tests.sh           # T1 全量测试；结果写到 $SCRATCH（默认 /tmp/ggbot-t1-run/results）
```

`run_box_tests.sh` 只用本目录的锁定工具，缺任何一项会直接退出码 2，不会悄悄跳过。它覆盖这些内容：
- 候选包能否从 baseline 逐字节重建
- 安装器 23 个场景
- 多指派发、L3 生命周期、作者原 13 项事件测试、作者原 wiring 测试
- 几何夹具和"夹具过期"负控
- tsc 和包体估算
- 排除检查：工程目录没有任何变化

测试输入不属于工具链，来自交接资料，默认 `YQ=/workspace/yiqifengle`：
- `character-core/.../cocos_exotic_cpu.cjs`：Cocos 3.8.8 的 CPU 引擎 loader 和 `cc-3.8.8.js`
- `qa-supplement/.../lighthouse-return-audit`：冻结候选和 QA 夹具

## 单独做类型检查
```sh
VN=tools/vendor-node; NODE=$(ls $VN/node-runtime/node-v*/bin/node)
cd <某个已应用候选的工程副本>/creator-build-project
cat > tsconfig.t1check.json <<'J'
{"compilerOptions":{"target":"ES2020","module":"ES2015","moduleResolution":"node","lib":["ES2020","DOM"],"experimentalDecorators":true,"strict":false,"noEmit":true,"skipLibCheck":true,"types":[],"allowSyntheticDefaultImports":true},
 "files":["<ABS>/tools/vendor-node/node_modules/@cocos/creator-types/engine/cc.d.ts"],"include":["assets/**/*.ts"]}
J
$NODE <ABS>/tools/vendor-node/node_modules/typescript/bin/tsc -p tsconfig.t1check.json; rm tsconfig.t1check.json
```
- 判定标准：和 baseline 1ef9f1d 相比，新增错误为 0。baseline 本身有 11 个既有错误，`run_box_tests.sh` 会自动对比。
- 不要在真实工程里留下 `tsconfig.t1check.json`。
