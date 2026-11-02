# HANDOFF · b20 integrate landing visual (RT + 黑面 + 穿模)

- 分支：`gbt/r5-b20-integrate-landing-visual`
- 合并 tip：`f9269a9193fc0d7df68b79a469a2a82b43d73b01`（handoff 提交前 tip；见下一次 commit）
- 未上传微信包 / 未 `cli upload`

## 三源

| 源 | 分支 | tip |
|---|---|---|
| RT（基） | `ggbot/b20-meadow-c-skycity-rt` | `4804822fabdc59f04ca27fd5f0e544fa776d5d35`（功能 `6c11ebd0`） |
| 运镜 | `cine/skycity-sea-landing-fix` | `f20755039608518e07ce0530f5146df0ce573876` |
| 场景 | `fx/r5-black-landing-fix` | `6f95dd71c0772cca7be80157c011e4e97282b4fa` |

相对上一轮 FAIL tip `606f434e`：RT 续修 view 池 + resize；cine B5 站 spawn_girl；fx 草甸顶点色 + 岛面提前亮。

## 合并

- 无冲突（`--no-ff` 两次 merge）
- 未触碰冻结合约：WorldIntegrationBoot / ScreenCover / WorldFlowCore / RegionJourneyCore / CharacterMotion / loadHomeSeated / StaticSeatedPreview / WNC·WFC

## 代码触达（相对 4804822f）

- `BalloonFlight.ts` / `BalloonTransit.ts` / `TransitionStaging.ts`（cine）
- `RegionJourneyAdapter.ts` / `SailPreload.ts` / `BalloonTransit.ts`（fx）
- 对应 handoff + 测试门

## Mac 复测门（通过前不上传）

见 `docs/r5/b20-hotfix/INTEGRATE.md`：landing-board from2 cre/des 中位 ≤2/s；uploads ≤1/s；board-bg zero ≥0.98。
