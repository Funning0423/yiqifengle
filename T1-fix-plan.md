# T1 灯塔点击回屋：修复方案

- 任务 ID：T1（灯塔点击回屋）。负责人：GGbot。牵头：Grok Bot。拍板：Funning。
- 日期：2026-10-11 05:45 CDT。今天只交方案和原型，没有安装到任何工程，也没有原生构建。
- 基线：`repo` 分支 `baseline` = **1ef9f1d1f784293209eff158c15479e04327deaf**（Mac original-project，原 HEAD 1ee4a7f）。工作分支 `work/GGbot`，worktree 在 `/workspace/yiqifengle/work/GGbot`。
- 候选来源：冻结包 `island-lighthouse-return.zip`（52a35faa…），包内声明 commit `ab25b99`（`git-clones/cloud-continuation` 分支 `cloud/island-lighthouse-return`）。QA 结论是 HOLD（`qa-supplement/oi-frozen-qa-supplement-20261011/lighthouse-return-audit/READONLY-REVIEW.md`）。
- 说明：交接说明里提到的 `20261011-Oi-Grokbot-00-READ-FIRST-TRANSFER.txt` 在共享电脑上**没有找到**（解出的目录和 zip/tar 清单都搜过）。我用的是 `evidence-cloud/README-GROKBOT.md` 和 `qa-supplement/.../READ_THIS_FIRST.md`。

标记说明：**[实测]** 是在共享电脑上实际跑过的；**[推断]** 是读代码或文档得出的，还没跑过。

---

## 0. 基线和候选的关系 [实测]

| 文件 | baseline 1ef9f1d SHA256 | 候选需要的前置 | 结论 |
|---|---|---|---|
| WorldIntegrationBoot.ts | 4b4be7ab… | near-hud 变体要 c4a2b3a9…，room-hud 要 d52b939b… | 不等。和 near-hud 前置只差 HUD 补丁里的 1 行（:164 的 `status.active` 条件）。 |
| world-r1/WorldFlowComponent.ts | 2aba051b… | near-hud 要 2aba051b… | **相同** |
| world-r2/IslandJourneyOverlay.ts | aae6157c… | aae6157c… | **相同** |
| world-r1/WorldFlowCore.ts / FirstsliceRoutes.ts（依赖） | 0d6a4d40… / a3c4c1e2… | c5cd721f… / 8272f925…（近镜） | 不等 |
| 其余依赖：RegionCameraData、CameraPose、WorldNativeComposition、GameAudio | 02e07f07 / 13da387a / ea951b0e / d067086f | 相同 | 相同 |

- 两个冻结变体的 `--check` 在 baseline 上都**过不了**，因为哈希门禁要求的是近镜和 HUD 之后的树。
- `git apply --check` 用 near-hud 的 `lighthouse-return.patch` 打 baseline，只有 Boot 的 @@-164 hunk 因上下文不同失败，其余 4 个文件都能应用。
- 所以 T1 在 baseline 上要出一个**新变体 `baseline`**：Boot 4b4be7ab → 新哈希，Component 2aba → 新哈希，Overlay aae6 → 新哈希，再加新类和 meta。依赖里去掉 c5cd/8272，改钉 baseline 的 0d6a/a3c4。
- 灯塔命中只依赖 `FIRSTSLICE.renderers` 里的 `env_lighthouse_ext / env_lighthouse_door / env_interior_shell`。baseline 的 FirstsliceFacts 里这三项都在。我没在代码里看到对近镜 Core 的逻辑依赖 [推断]。
- 需要 lead 确认：是否以 baseline 变体作为 T1 交付主线，room-hud/near-hud 等近镜、RoomLook、HUD 落地后再重新派生？见第 9 节问题 1。

---

## 1. 问题一：回退后软链接丢失

### 1.1 根因（file:line）[实测]
文件：`variants/{room-hud,near-hud}/apply.py`。两份字节相同，SHA256 `268789cb…3535`。

- `apply.py:6`：`digest()` 用 `p.is_file()` 判断，**会跟随链接**。悬空链接被当成"不存在"（None），指向文件的链接被当成那个文件。
- `apply.py:15`：`path.exists() and not path.is_file()` 也跟随链接。悬空链接时 `exists()` 是 False，非普通文件的检查被**整段跳过**。
- `apply.py:16`：新文件的 `before_sha256` 是 null，悬空链接的 digest 也是 None，所以"哈希一致"，预检 PASS。
- `apply.py:24-25`：备份时 `path.exists()` 为 False，记成 `existed:false`，**不保存链接本身**（readlink 目标没记）。
- `apply.py:36`：`os.replace(staged, path)` 用普通文件替换了链接。
- `--rollback`：清单里新文件的 before 是 null，于是 `apply.py:35` 直接 `path.unlink()`。原来的链接再也回不来。
- `apply.py:45`（失败恢复分支）的 `elif path.exists()` 有同样问题。
- 同类问题：
  - `apply.py:20` 的备份根 `.cloud-patch-backups` 不检查是不是链接。指向 `assets/scripts` 时，备份、STATE、SUCCESS 和旧源码会被写进生产 assets。
  - `apply.py:14` 只检查 `resolve()` 后是否还在仓库内，**不要求父目录是真实目录**。仓库内部的父目录链接会被跟随，写到别名的目的地去。

### 1.2 复现 [实测]
在 `/tmp/ggbot-t1` 一次性副本里跑，冻结目录没动：
- QA 原脚本 `reproduce-dangling-link-loss.py` 原样跑：.ts 和 .ts.meta 两例都是 check/apply/rollback 退出码 0，最后链接丢失。和 QA 结论一致。
- 我写的 `tools/t1/test_installer_paths.py` 对冻结安装器和 v2 原型各跑 7 个场景，再加 1 个回退场景。结果在 `tools/t1/results/installer-paths.json`：

| 场景 | 冻结 apply.py | v2 原型 |
|---|---|---|
| 干净往返 | 通过，差异 [] | 通过，差异 [] |
| 新 .ts 位置有悬空链接 | **check 0、apply 0、rollback 0，链接丢失** | check 1 拒绝，零写入，apply 也拒绝 |
| 新 .meta 位置有悬空链接 | **同上，丢失** | 拒绝，零写入 |
| 新 .ts 位置有指向文件的活链接 | 拒绝（哈希不符，侥幸） | 拒绝（类型=symlink） |
| `.cloud-patch-backups` 指向 assets/scripts | **check/apply/rollback 都是 0，往 assets 写了两套备份目录** | 拒绝，零写入 |
| world-r2 父目录是仓库内链接 | check 0 并经别名写入（往返后恢复，但中途写到了别名目的地） | 拒绝 |
| world-r2 父目录指向仓库外 | 拒绝 | 拒绝 |
| apply 后把新文件换成链接再 rollback | （未测） | rollback 1 拒绝 unlink，零写入 |

### 1.3 修复方案
原型文件：`tools/t1/prototype/apply_v2.py`（SHA256 43a6bf90…）。

```diff
- def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
+ def kind(p):  # 用 os.lstat，绝不跟随链接 → 'absent'|'file'|'symlink'|'dir'|'other'
+ def digest(p): return sha256(p.read_bytes()) if kind(p)=='file' else None
+ def chain_errors(root, rel):  # 根到叶子父目录的每一级：要么真实目录，要么尚不存在
- if path.exists() and not path.is_file(): errors.append(...)
+ if f[expect] is None and kind(path)!='absent': errors.append('Target must be truly absent but is '+kind)
+ if f[expect] is not None and kind(path)!='file': errors.append('Target not a regular file')
+ 依赖文件同样要求 kind=='file'，并检查父链
+ 备份根 .cloud-patch-backups 必须是真实目录或不存在；逐级 os.mkdir 后再用 lstat 复核
- if f[target] is None: path.unlink()
+ if f[target] is None: (kind(path)=='file' or raise) ; path.unlink()
- elif path.exists(): path.unlink()        # 失败恢复
+ elif kind(path)=='file': path.unlink()
+ STATE.json 增加每个路径的 'kind'；并发复核（原 :30）同时比较类型、哈希和父链
```

- 原则：**写前拒绝，不做覆盖后补救**。这也是 QA 的要求。
- 我没有选"把链接备份下来、回退时再 os.symlink 恢复"：这会扩大安装器能写的类型，还要额外处理链接目标是否安全。现在的项目里新类和 meta 本来就不存在（QA 也确认了），直接拒绝成本最低。
- 正式版：用 v2 生成新变体（baseline、room-hud、near-hud）。三个变体共用一份安装器，旧安装器 268789cb 标为 SUPERSEDED。

---

## 2. 问题二：多指时第一根手指抬起误触回屋

### 2.1 根因（file:line）[实测]
文件：候选 `world-r2/IslandHomeInteraction.ts`（SHA256 8e9f4156…）。

- `:7`：判断第二根手指只靠 `input.on(Input.EventType.TOUCH_START, observeTouch)`，这是**全局层**。
  - Cocos 3.8.8 的 `input._emitEvent` 按 dispatcher 优先级先派发 UI（PointerEventDispatcher），某个 dispatcher 返回 false 就 `break`。
  - 第二根手指落在 WarmButton 等 UI 上时被 UI 认领，GLOBAL 层**收不到**这个 START。
  - 证据：我在 `cc-3.8.8.js` 里搜到 `_emitEvent=function(t){…if(!n.dispatchEvent(t))break…}`。QA 也引用了 `cocos/input/input.ts:340-351`。
- `:12`：`blocked` 只在 `observeTouch` 里置位，所以一直是 false。
- `:15`：抬起时的条件是 `e.getAllTouches().length<=1`。这里**语义用错了**：
  - 3.8.8 小游戏输入源在 touch-end/cancel 时**先 `releaseTouch` 再构造 EventTouch**（`…"touch-end"!==t&&"touch-cancel"!==t||tP.releaseTouch(h)…new sy(n,!1,t,tP.getAllTouches())`）。
  - 所以 END 时 allTouches 已经**不含本指**。单指点击时长度是 0，另一根手指还按着时长度是 1，`<=1` 正好把这种情况放行了。
  - 作者的事件夹具（`tools/fixture.cjs` 的 `event(type,x,y,id,ids=[id])`）在 END 时也把本指放进 allTouches，和真实引擎不一致，所以没测出来。
- `tools/test_events.cjs:3` 的 second-finger-on-UI 直接调用 `observeTouch`，绕过了真实派发链。

### 2.2 复现 [实测]
我写了 `tools/t1/test_multitouch_dispatch.cjs`，比 QA 的 `dispatch-edge.cjs` 更贴近真实：
- 输入从 `input._touchInput._createCallback(type)` 开始，也就是**真实 3.8.8 小游戏输入源**，经过 touchManager 的建点和释放，再到 input、PointerEventDispatcher、Node.dispatchEvent。
- QA 是直接构造 allTouches 交给 `_emitEvent`。
- 仍然是桩的部分：UITransform.hitTest 矩形、节点激活、UI 相机 priority，灯塔命中用注入谓词。

| 场景 | 期望回屋次数 | 原候选 8e9f | 原型（L1+L2） | 原型 + wx 原始监听（L3，wx 为模拟） |
|---|---|---|---|---|
| 单指点灯塔 | 1 | 1 | 1 | 1 |
| B 按住 WarmButton，A 先抬起 | 0 | **1 ✗** | 0 | 0 |
| 同上，中间没有帧 | 0 | **1 ✗** | 0 | 0 |
| B 在 UI 上点完松开（中间有帧），A 再抬起 | 0 | **1 ✗** | 0 | 0 |
| B 在 UI 上点完松开，**全在同一帧内**，A 再抬起 | 0 | **1 ✗** | **1 ✗** | 0 |
| B 按在海面（落在本透明层上） | 0 | 0 | 0 | 0 |
| B 先按 UI，A 再点灯塔 | 0 | 0 | 0 | 0 |
| 多指手势结束后再单指点击 | 1 | 1 | 1 | 1 |
| 只点海面 | 0 | 0 | 0 | 0 |

- 原候选错了 4 项，QA 只报了第 1 项。原型 L1+L2 剩 1 项，三层叠加后全部通过。结果在 `tools/t1/results/mt-*.json`。
- 回归：作者原来的 13 项事件套件（test_events.cjs）对原型重跑，**13/13 PASS**（`results/ev-proto.json`）。

### 2.3 修复方案（三层叠加）
原型文件：`tools/t1/prototype/IslandHomeInteraction.proposed.ts`（SHA256 ad32ffed…，含中文注释，6160 B）。正式版去掉注释后预计比原候选多 0.9 到 1.2 KB [推断]。

```diff
+ private othersDown(e){return e.getAllTouches().some(t=>t.getID()!==this.pointer);}   // 两种 END 语义都适用
+ private pollTouchCount(){if(this.pointer!==null&&input.getTouchCount()>1)this.blocked=true;}
  sync(w,h,enabled){ …; if(!this.root.active){this.cancel();return;} this.pollTouchCount(); }   // L2：每帧
  down(e){ if(this.pointer!==null||e.getAllTouches().length>1||input.getTouchCount()>1){blocked=true;return;} … }
  move(e){ … if(this.othersDown(e))this.blocked=true; this.pollTouchCount(); … }
- up(e){ … e.getAllTouches().length<=1 … }
+ up(e){ const others=this.othersDown(e)||input.getTouchCount()>(本指仍在列表?1:0);     // L1
+        fire = … && !blocked && !others && … }
+ // L3：微信平台层原始监听，在 Cocos UI 认领之前就能看到每根手指
+ constructor: if(wx?.onTouchStart&&wx?.offTouchStart){this.rawStart=e=>this.observeRaw(e);wx.onTouchStart(this.rawStart);}
+ observeRaw(e){ if(pointer!==null && [...touches,...changedTouches].some(t=>t.identifier!==pointer)) blocked=true; }
+ dispose: wx.offTouchStart(this.rawStart)
```

- **L1（抬起时）**：除本指外不能还有手指按着。用 `input.getTouchCount()` 读 touchManager，它在派发前更新，不受 UI 认领影响。修掉"B 还按着"这一类。
- **L2（每帧轮询）**：Boot 的 `update → paintNavigation` 每帧都调用 `islandHome.sync()`，按住期间看到计数大于 1 就作废。修掉"B 已经松开但中间有帧"这一类。
- **L3（微信原始 onTouchStart）**：补上"B 在同一帧内按下又松开"的空档。原型用的是 `wx.onTouchStart/offTouchStart`，这是公开 API，多个监听能否共存要在真机确认。
- 保留原来的全局 `observeTouch`，作为没被 UI 认领时的冗余。
- 我**不采用**的方案：
  - `input._registerEventDispatcher` 注册高优先级 dispatcher：私有 API，也没有注销接口。
  - 在 Canvas 上注册 capture 监听：这会让 Canvas 本身变成 pointer 目标（`_hasTouchListeners` 也会统计 capture），可能吞掉原本落到全局层的触点，影响面太大 [推断]。
- 夹具同步修正：`fixture.cjs` 的 `event()` 在 END/CANCEL 时 allTouches 必须不含本指。以后多指类断言一律走 `_touchInput._createCallback`，不再直接调用 `observeTouch`。

---

## 3. 几何解码夹具

### 3.1 现状 [实测]
- 作者的 `tools/extract_pick_geometry.py` 读的是 `lighthouse-island-astra-ultra/cloud-rounded-delivery/evidence/after-decoded.glb`（79d096ea…）。这个文件**不在交接包里**，`pick-geometry.json` 也没附。所以 4125 射线、137 空气拒绝的结论没法独立复跑。这也是 QA 列的缺口。
- 共享电脑上能找到的 `character-core/.../environment-decoded-for-review.glb`（98f7a5b5…）是**另一个版本**：ext 22827 索引、shell 15567，baseline 是 23388 和 18756。不能拿它冒充。
- baseline 生产 GLB `creator-build-project/assets/bundles/region_island/combined_visual_m.glb` 的 SHA256 是 `231e2987…4de5b`（5,020,780 B），三个目标节点用 **KHR_draco_mesh_compression**。near 分支的 GLB 是 77bff8b3…，不一样。

### 3.2 设计和原型 [实测]
- `tools/t1/decode_pick_geometry.cjs`：用官方 `draco3d@1.5.7`（npm 装在 /tmp，Apache-2.0，只是开发工具，不进包）直接解码**生产 GLB**，输出 schema `t1-lighthouse-pick-geometry/v1`。身份字段如下：
  - 输入：GLB 文件名、sha256、字节数
  - 解码器名称和版本
  - 每个节点：索引、名称、TRS
  - 每个 primitive：顶点数、索引数、解码 min/max 和 accessor min/max、positions/indices 的 sha256
- 内置自检：解码出的点数和索引数必须等于 accessor 的 count，min/max 和 accessor 的偏差不超过 1e-3，否则直接失败。
- baseline 结果（`results/pick-geometry-baseline.identity.json`）：

| 节点 | 索引 | 顶点 | 索引数 | pos sha | idx sha |
|---|---|---|---|---|---|
| env_interior_shell | 90 | 8358 | 18756 | 96a2e979… | 61f470c2… |
| env_lighthouse_door | 97 | 1712 | 2532 | b86104e2… | 4684a87b… |
| env_lighthouse_ext | 98 | 13034 | 23388 | 79b5b691… | b7c96e57… |

- 完整夹具 1,560,066 B，sha256 `1b6b6a8d…8565e93`。两次生成字节完全一致（确定性）。完整数据**不提交**，只提交身份清单，需要时重建。
- `tools/t1/to_author_pick_format.py` 把它转成作者 `test_geometry.cjs` 的输入格式。用 baseline 解码几何加上候选 hitLighthouse（near-hud Component d7be489e），在 5 个视口上重跑：**4125 次射线、137 次 AABB 内空气拒绝，全部断言 PASS**。和作者报告的数字一致（`results/geometry-tests-baseline-decoded.json`）。
- 正式落地：
  - 夹具测试要先断言"当前工程 GLB 的 sha256 等于夹具里记录的 input.sha256"，不一致就报 `FIXTURE STALE`，不能静默通过。
  - near、matte 这类 GLB 不同的分支，要各自生成一份夹具身份。
  - 工具放 `tools/`，不进 `assets/`，包体 0 增量。

---

## 4. 交付文件清单（正式实现时，基于 baseline 1ef9f1d）

| 路径 | 动作 | 说明 |
|---|---|---|
| creator-build-project/assets/scripts/world-r2/IslandHomeInteraction.ts | 新增 | 候选 8e9f + 第 2 节修复 |
| creator-build-project/assets/scripts/world-r2/IslandHomeInteraction.ts.meta | 新增 | 沿用 uuid 177535cd-…（baseline 里无冲突，要再 grep 确认一次） |
| creator-build-project/assets/scripts/WorldIntegrationBoot.ts | 修改 | 移植 near-hud 的 4 个 hunk，:164 按 baseline 的上下文重新生成 |
| creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts | 修改 | 候选 hunk 原样（基线相同） |
| creator-build-project/assets/scripts/world-r2/IslandJourneyOverlay.ts | 修改 | 删除 ReturnHome 按钮，改成提示文字（基线相同） |
| tools/t1/apply_v2.py + manifest(baseline 变体) | 新增 | 安装器 v2 |
| tools/t1/*.cjs/py + tests | 新增 | 负控、夹具和派发测试（不进包） |

- 包体：生产只增加 TS 源码，约 +6.9 KB（原候选）再加约 1 KB（多指修复），没有新媒体 [推断，等 Mac 构建确认]。
- 现在 matte 的余量是 686,806 B，要给人物留 600,000 B；baseline 的余量要在 Mac 上实测。

## 5. 今天的提交内容（work/GGbot）
- `T1-fix-plan.md`（本文件）
- `tools/t1/decode_pick_geometry.cjs`、`to_author_pick_format.py`、`test_installer_paths.py`、`test_multitouch_dispatch.cjs`
- `tools/t1/prototype/apply_v2.py`、`IslandHomeInteraction.proposed.ts`：**原型，不在 assets 下，不会被 Cocos 导入**
- `tools/t1/results/*.json`：实测收据（里面有 /tmp 路径，属于一次性目录）

---

## 6. 测试计划
1. **安装器**：`test_installer_paths.py` 的 8 个场景是门禁。再补：dependency 本身是链接、备份根是 FIFO 或文件、STATE 写入失败注入、postwrite 失败注入后自动恢复。另外重跑作者 49 项事务测试和 QA 的 4 项回退故障测试，换成 v2 和 baseline 变体的清单。
2. **多指**：`test_multitouch_dispatch.cjs` 的 9 个场景是门禁（L3 带 `--raw-wx`）。再补：CANCEL 路径、B 在移动、三指、game hide 期间按住、弹层打开时第二指。作者 13 项事件套件要换成正确的 END 语义后重跑。
3. **几何**：baseline 夹具加 test_geometry 的 5 个视口，再加 GLB sha 不一致必须失败的负控。
4. **接线**：作者 test_wiring（3 个视口 × 1 个变体）、test_hosts，以及 QA 的 dispatch-edge 负控。
5. **Mac（由 Grok Bot 用命令行跑）**：Cocos 3.8.8 导入和构建、TS 编译、包体统计、微信开发者工具预览。不上传。
6. **Oi 原生验收**：
   - 点塔顶、墙、侧屋、门，各自自然回屋一次
   - 点海面、拖动都不回屋
   - 双指（第二指放在 UI 上，或在同一帧内快点）不回屋
   - 连点只触发一次
   - 菜单开合、hide/resume、安全区和胶囊按钮

## 7. 风险
- **L3 依赖 `wx.onTouchStart` 多监听**：如果真机上会覆盖 Cocos 适配器的监听，触摸会全部失效。原型只在模拟 wx 上测过，必须先在开发者工具和真机验证；不行就退回 L1+L2，同帧快点的空档作为已知限制写进验收说明。
- **Web 预览输入源的 END 语义没核实**：L1 用 `othersDown` 和"本指是否在列表里"的修正同时兼容两种语义，这是推断。
- **L2 依赖每帧 sync**：`paintNavigation` 在 snapshot 抛错或 home 未就绪时会提前 return，这些状态下根节点本来就不可用 [推断]。
- **Boot :164 重新生成上下文**：以后 HUD 补丁落地时会再冲突，需要按"近镜 → RoomLook → HUD → 灯塔"的顺序重新派生变体，不能放宽门禁。
- **原生 renderer CPU buffer 可用性**（`rayModel` 需要 geometricInfo）、真机 OS 事件路由：都还没验证，不能叫原生 PASS。
- **13 秒帽顶、22.8 秒照明跳变**属于 T2/T3a，不在本任务内。

## 8. 回退步骤
- **今天的提交**：只加了文档和 tools，没有动 assets。回退用 `git -C /workspace/yiqifengle/work/GGbot revert <本次提交>`，或者直接丢弃 work/GGbot 分支。baseline 不受影响。
- **正式实现后**：`python3 tools/t1/apply_v2.py <repo> --rollback`，按严格逆序回退。v2 回退前会检查每个路径都是普通文件且哈希吻合，否则零写入拒绝。如果回退被拒，从 `.cloud-patch-backups/<run>/original/` 按 STATE.json 手动恢复，或者 `git checkout 1ef9f1d -- <5 个路径>` 后删掉新类和 meta。
- 回退后验证：五个路径的 SHA 等于第 0 节的基线值，新类和 meta 用 lexists 确认不存在。

## 9. 需要 lead 确认的问题
1. T1 的主线是否按 **baseline 变体**交付（不依赖近镜、RoomLook、HUD）？还是等 T2 近镜落地后直接做 room-hud 变体？我的建议是先做 baseline 变体。
2. L3 的 `wx.onTouchStart` 需要 Mac 上的微信开发者工具和真机验证，请在阶段 0 构建跑通后安排一次。
3. 交接入口文件 `…00-READ-FIRST-TRANSFER.txt` 共享电脑上没有。如果里面有 T1 相关约束，请补发。
4. 夹具用的 draco3d 是 npm 开发依赖，只装在 /tmp。能否把它固定到 `tools/vendor-node/`（只在开发时用，不进包，约 1 MB 级 [推断]）？

---

## 10. 已测 / 失败 / 未测

### 已测（共享电脑 CPU，2026-10-11）
- 冻结安装器的悬空链接丢失：QA 原脚本原样复现，.ts 和 .meta 两例都丢失。
- 冻结安装器的备份根别名写入 assets、仓库内父链被跟随：复现。
- v2 原型：8 个路径场景全部符合预期（拒绝时零写入，干净往返差异为 []）。
- 冻结候选多指误触：QA 的 dispatch-edge 原样复现，回屋 1 次。我自己的真实输入源 harness 测出 4 个失败场景。
- 原型 L1+L2：9 个场景过 8 个；加 L3（模拟 wx）9/9 通过。作者 13 项事件套件 13/13。
- 3.8.8 小游戏输入源 END 时先 release 再给 allTouches：在 cc-3.8.8.js 源码里核对过，也实际跑过（单指 END 时 allTouches=0）。
- baseline 生产 GLB 的 draco 解码夹具：3 个节点，计数和 bounds 与 accessor 一致，两次输出相同。
- 用 baseline 解码几何跑作者的 geometry 测试：4125 / 137，PASS。
- baseline 和候选的前置对照，`git apply --check`（只有 Boot :164 失败）。

### 失败
- 冻结 `apply.py` 268789cb：悬空链接丢失 ×2、备份别名写入 assets、仓库内父链被跟随。**按设计这是待修复项，不是新问题。**
- 冻结 `IslandHomeInteraction.ts` 8e9f4156：多指 4 个场景误回屋。
- 原型只开 L1+L2 时："同一帧内 B 按下又松开"仍会误回屋 1 次，需要 L3。
- 两个冻结变体在 baseline 1ef9f1d 上过不了前置哈希，需要新出 baseline 变体。

### 未测
- 正式 baseline 变体的源码、清单和安装器：还没写。
- Cocos Creator 3.8.8 导入、构建、TS 全量类型检查：只能在 Mac 上做。
- 真机或微信开发者工具里 `wx.onTouchStart` 多监听的行为（L3）。
- Web 预览输入源的 END 语义。
- 原生 MeshRenderer 模型的 CPU geometricInfo 是否可用（rayModel 依赖它）。
- 实际 OS 多指派发、真实点击回屋的视觉和音频解锁。
- 包体实测。
- 作者 test_wiring、test_hosts、49 项事务测试在 baseline 变体上的重跑。


---
**2026-10-11 06:05 更新**：baseline 变体已实现并在共享电脑上测完，见 `T1-implementation-report.md` 与 `candidates/T1-lighthouse-return-baseline/README.md`。原型文件已由正式文件替代（`tools/t1/apply_v2.py`、`tools/t1/src/IslandHomeInteraction.L123.ts` / `.L12.ts`）。
