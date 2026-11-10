# 峡湾极光栈道（r10）接线

地区 id：`fjord`。关卡 `r10-fjord-01` … `r10-fjord-08`。分包 `region_fjord`，场景 `env_fjord.glb`。棋盘坐在 `FJ_platform` 顶面，y = **1.25**（float32 可精确表示），间隙 0。

解锁：温泉谷八关全部有存档之后。离开棋盘回到进入点，不走气球（`onShelf` 与雪山、铁路、云海、温泉谷同一条）。已有地区和关卡只追加，没有删减。

## Mac 上第一次用 Creator 导入

`env_fjord.glb` 是程序生成的，`.meta` 里 `imported: false`，没有填 prefab 子资源 UUID。需要在 Mac 上用 **Cocos Creator 3.8.8** 打开工程，让编辑器第一次导入这个 GLB，生成子资源和 prefab UUID。导入完成前不要手写 UUID，也不要改 `imported`。

导入时请确认：

- 扩展 `KHR_mesh_quantization` 被接受。栈道平台 `FJ_platform` 仍是 float32，顶面 y 必须仍是 1.25。其余网格是 uint16 位置（节点缩放还原）、int8 法线、uint16 UV。
- 不要让 Creator 重写气球的几何、画面或 `region_transit_balloon` 的 meta。这次没有改气球。
- 导入后如果要开运行时 mesh 压缩，只动 `env_fjord.glb.meta` 的 `meshCompress`，并先在 Mac 上看过画面。量化会把位置收成半精度，平台顶面要再对一下 y。

## 灯标

地区对局的 `RegionalSession.snapshot` 现在带上引擎的 `beaconTarget` 和 `beaconRoute`，`BoardSessionProvider` 原样交给界面。没有灯标的关卡仍是 `beaconTarget: null`、`beaconRoute: []`。快照字段不进存档的 `_export()`，所以已有关卡的胜率不变。

用在两关：`r10-fjord-03` 极光灯标（17 → 31），`r10-fjord-07` 灯塔余光（16 → 18，开局炸弹）。

## 炸弹次数为什么是 0（没有改）

主线引擎构造时 `this.bombs = 2`（本地 3×3，两次）。地区会话在 `new Engine` 之后立刻写 `this.engine.bombs = 0`，所以地区对局里引擎根本没有炸弹次数。界面读的又是 `BoardSessionProvider.snapshot` 里写死的 `bombs: 0`（类型也是字面量 `0`）。两处都是地区对局不发放主线那两次炸弹，不是某次存档把次数弄丢了。
