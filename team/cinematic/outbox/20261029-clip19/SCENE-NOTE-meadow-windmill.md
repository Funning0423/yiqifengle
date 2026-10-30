# 场景设计部 note (draft, via 运镜bot): meadow windmill vs the walk to the balloon (m 407–431)

**Evidence:** 19bd812a Mac m camTrace, writer BalloonTransit:prewalk (B1 pre-walk to the yard gate), t 255–272 s.
- Replayed on env_meadow.glb in the bridge frame (journey-scene mOff [-1.3135,-1.1635,52.4814], yaw 180). collision-gate.cjs flags the same span independently: 82 violations, 47 enclosed.

**Objects involved (region_meadow/env_meadow.glb):**
- `windmill_static_merged`:
  - world AABB (journey frame) x −8.7..2.0, y 5.3..17.6, z 78.3..85.8;
  - meadow-local x −3.3..7.4, y 6.5..18.8, z −33.3..−25.8.
- `windmill_sails` (rotating):
  - sweep disc world x −7.5..4.9, y 6.3..18.7, z ≈79.5;
  - local x −6.2..6.2, y 7.5..19.9, z ≈−27.0.
- `meadow_trees_merged` sits on the other side of the path. The lens is in both AABBs from t 265.0.

**Two parts:**
1. **Camera (mine):** the follow lens is inside `windmill_static_merged` from t 266.8 to 271.2 s.
   - Mac frames 428–431: the grey band and grey fill.
   - The meadow voxel grid (MeadowLensVoxels) does flag these points as <1.1 m from solid, but lensClearStep does not get the lens out while she walks between the windmill and the trees.
   - BalloonTransit is GGbot's file, so the fix comes as a separate diff once the scene answer is known.
2. **Scene:** the B1 pre-walk passes directly under the sail disc.
   - The lowest sail tip is about 2.0 m above her walk floor, so it clears her head by only ~0.3 m.
   - From any follow lens behind her, the sails sweep across her body; the windmill body fills the top ~40 % (frames 414–425).

**Proposal (pick one):**
- (a) raise the hub/sails so the lowest tip is ≥ 1.5 m above head height (tip ≥ 3.2 m above the path floor), or
- (b) move the path / yard-gate approach ≥ 2 m clear of the windmill wall and the sail disc (local z −27 ± 2, x −6..6).

Either makes a lens corridor ≥ 1.1 m possible. Not relayed to 场景设计部: returned to 运镜bot for review.
