# 围巾拆包挂载说明（基于 anim/scarf-lantern 3b49c4b4）

## 产物
| 文件 | 字节 | sha256 |
|---|---|---|
| 主包 `planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb` | 3,176,532 | 3132274bd4edaf53a7d0dde6d25f511ce01635ba995aa646021ea3e231d510e1 |
| 雪山子包 `scarf_snow_subpkg.glb` | 26,012（gzip 13,032） | 1269a2c4d2f76873e9fdbdf6075df945ac5a3c3ebc0a6db8ccde3b2a72c2716f |
| meta `planB_cand3b_ribbonwind4b_stepdown_scarfbones_anim_meta.json` | — | 46ce8a1a… |

主包相对生产版 31ebfa53（3,165,656 B）：**+10,876 B，gzip 后 +5,044 B**。

## 选的挂载方式：做法一（同一套 30 关节 skin + skinningRoot）
- 子包 GLB 只含 LOD0_G2_SCARF 网格、M_G2_SCARF 材质和贴图，以及和主包**完全一致**的 skin（关节名、顺序、inverseBindMatrices 逐字节相同）和关节节点树，无动画。
- 围巾顶点权重落在 chest / neck / scarf.tail 三根骨上，是多骨混合蒙皮。做法二（刚性或单骨挂在 scarf.tail 下）会丢掉 chest/neck 的混合，围巾根部在胸口、脖子处的形变会变，所以不选。
- 现有角色走实时蒙皮（WorldIntegrationBoot 的 blend 模式设 `useBakedAnimation=false`），这是 Cocos 官方文档和社区"换装"方案的前提：新 SkinnedMeshRenderer 的 `skinningRoot` 指到带 SkeletalAnimation 的节点，骨骼按路径从 skinningRoot 解析。

## 接口（TS 示例，Cocos 3.8.8）
```ts
import { Node, Prefab, instantiate, SkinnedMeshRenderer, SkeletalAnimation, assetManager, isValid } from 'cc';

let scarfNode: Node | null = null;

/** 进雪山时调用。visual = 角色实例根节点（WorldIntegrationBoot.bindVisual 的那个）。 */
export async function attachScarf(visual: Node, bundleName = 'region-snow'): Promise<void> {
  if (scarfNode && isValid(scarfNode)) return;                       // 幂等
  const anim = visual.getComponent(SkeletalAnimation) || visual.getComponentInChildren(SkeletalAnimation)!;
  const bundle = await new Promise<any>((ok, ng) => assetManager.loadBundle(bundleName, (e, b) => e ? ng(e) : ok(b)));
  const prefab = await new Promise<Prefab>((ok, ng) => bundle.load('character/scarf_snow_subpkg', Prefab, (e: any, p: Prefab) => e ? ng(e) : ok(p)));
  const inst = instantiate(prefab);
  const src = inst.getComponentInChildren(SkinnedMeshRenderer)!;      // LOD0_G2_SCARF
  const body = anim.node.getComponentsInChildren(SkinnedMeshRenderer).find(r => r.node.name === 'LOD0_G2_BODY')!;
  const node = src.node;
  node.removeFromParent();
  body.node.parent!.addChild(node);                                   // 和 BODY 同级（原 GLB 中的位置），本地变换保持 identity
  node.setPosition(0, 0, 0); node.setRotationFromEuler(0, 0, 0); node.setScale(1, 1, 1);
  src.skinningRoot = anim.node;                                       // 关键：驱动骨骼用角色自己的
  inst.destroy();                                                     // 子包自带的关节节点树不用，丢掉
  scarfNode = node;
}

/** 离开雪山时调用。 */
export function detachScarf(): void {
  if (scarfNode && isValid(scarfNode)) scarfNode.destroy();
  scarfNode = null;
  // 需要释放时：assetManager.getBundle('region-snow')?.release('character/scarf_snow_subpkg')
}
```
注：路径 `character/scarf_snow_subpkg` 和 bundle 名是示例，按实际子包结构改。挂载要放在 rig 初始化之后，任意帧都可以调用。

## 没加载围巾时为什么不会报错
- scarf.tail 骨骼节点本身留在主包里（skin 第 29 号关节，30 关节不变），15 个 clip 的 scarf.tail 通道都能找到目标节点，不会出现"找不到节点"。
- 这些通道只写 scarf.tail 自己的 TRS。scarf.tail 是 neck 的叶子子节点，下面没有别的骨骼，主包里也没有任何顶点权重落在它上面，所以不会影响其他骨骼或网格。
- 已核：主包 711 个通道和 3b49c4b4 逐通道（时间、数值、插值）完全一致；其中 696 个和生产版 31ebfa53 完全一致，多出的 15 个全是 scarf.tail。四个身体网格（APRON/BODY/BOW/DRESS）顶点、索引、材质、贴图和 31ebfa53 完全一致。
- 注意：31ebfa53 是 29 关节，主包是 30 关节，inverseBindMatrices 多一项。这是 3b49c4b4 就有的变化，不是这次新增的。

## 子包里放什么
- `scarf_snow_subpkg.glb`：围巾网格 + 材质 + 贴图 + 同一套 skin 和关节节点树（关节树只为让导入器生成同一个 Skeleton 资源，挂载后丢弃）。不放动画，不放身体网格。
- 雪山子包里不需要再放任何 clip，scarf.tail 的动画已在主包里。

## wind.mask
- 不变：`['skirt*','apron*','hair*','ribbon*','scarf*']`。scarf* 匹配 scarf.tail 骨骼，跟围巾网格是否加载无关；没挂围巾时，风层照样写 scarf.tail，只是看不见。
- 风层权重仍只取决于风力，不按 clip 区分。

## 风险点 / Cocos 实机要验
1. 子包导入成 prefab 后生成的 Skeleton 资源：joints 路径要和主包一致（同一棵节点树，理论上一致），bindposes 一致。实机打印 `src.skeleton.joints` 对比主包 BODY 的。
2. 只在 `useBakedAnimation=false`（blend 模式）下验证过思路。若某些路径走 baked 模式（blend=false），动态加的 renderer 可能不会被 SkeletalAnimation 收录，需要实机确认，必要时挂载后把 useBakedAnimation 重新设一次。
3. 关节上限：30 关节正好是设备下限，围巾和身体共用同一套关节，不增加 uniform。
4. WorldIntegrationBoot 初始化 rig 时会遍历 anim.node 子树收集节点名。围巾节点在初始化后才挂，不进那个列表；它不是骨骼，不受影响。但若 rig 被重建（换场景重新 bindVisual），要确认 LOD0_G2_SCARF 被当作普通节点而不是关节。
5. 包围盒/裁剪：动态挂载后围巾的 AABB 是否随骨骼更新、近景是否被误裁。
6. 释放：离开雪山后 detach 并释放 bundle 资源，确认无引用泄漏；反复进出雪山各 5 次。
7. 子包 gzip 后约 13 KB，计入雪山 region bundle（≤80 KB 预算）。

## 验证
- `verify_split.json`：通道、网格、skin、节点树逐项比对结果。
- `blender_reattach_check.json`：Blender 4.5.3 里导入主包和子包，把子包围巾的 Armature 修改器指到主包骨架（相当于 skinningRoot），和 3b49c4b4 原 GLB 的围巾逐帧对比世界坐标顶点：15 个 clip 全部帧最大误差 0 m。
- 脚本在 `src/`。
