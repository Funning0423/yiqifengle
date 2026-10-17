# integration/build05-a3b：A3b 合入 build05（不含湖畔）

- **分支** `integration/build05-a3b-20261017T063646Z`
- **HEAD** `a995c4158ff447ec1fb82f26b198db2265a0c36a`
- **tree** `f359fb23533427d2360cf8edd2a952a49a010ae4`
- **基线** `09a1b8e456fd38dadf632f627189883808307cbe`（build05 milestone）
- 提交顺序（cherry-pick，内容与原 A3/A3b 一致）：
  1. `3b7e6e17eae58bc6c60a1f436a949342ebc2af93` ← A3（原 c49801b）
  2. `a995c4158ff447ec1fb82f26b198db2265a0c36a` ← A3b（原 a17395c）
- **不含湖畔**。界面验收部已确认 A3b 在 f60c8ec 上 Mac 通过；按 Grok Bot 指示先把 A3b 单独合进 build05 线。
- 只在本地：没有 push，没有 force，没有动主线。

## 音频文件与 f60c8ec 对照
| 文件 | 与 f60c8ec blob |
|---|---|
| `audio/AmbienceAudio.ts` | 一致 |
| `audio/GameAudio.ts` | 一致 |
| `tools/test_home_sea_fadein.cjs` | 一致 |
| `tools/voice-bot/wind/test_wind_audio.cjs` | 一致 |
| `WorldIntegrationBoot.ts` | 仅差湖畔按钮一行（本分支故意不含） |

## 拿代码
前置需要 `09a1b8e`：
```bash
git fetch qfl-build05-a3b-a995c4158ff4.bundle HEAD:integration/build05-a3b-20261017T063646Z
# 或在 09a1b8e 上：
git am 0001-*.patch 0002-*.patch
```

## 测试
`QF_TYPESCRIPT_MODULE=/tmp/ts5/node_modules/typescript node tools/journey-integration/run-suite.cjs`
- **54 项，49 通过**；没过的只有已知 5 项：production-integrity、legacy-board-ui-pure、reward-background-return、cloud-web-contract、navigation-guard（BLOCKED_BROWSER）。
- `home-sea-fadein`、`wind-audio`、`exit-restart-quiet` 均 PASS。见 suite.txt。

## 包体估算
- 09a1b8e Mac 实测：19,125,680 B。
- f60c8ec（A3b + 湖畔）Mac 实测：19,154,482 B（+28,802），其中大部分是湖畔。
- A3b 源码相对 09a1b8e：AmbienceAudio +1,062 B、GameAudio +1,034 B、WorldIntegrationBoot +64 B；c49801b 单独实测包体曾 +69 B。
- **A3b-only 包体估算约 +300–500 B → 约 19,126,000–19,126,180 B**，远低于安全线 24,641,536 B。需 Mac 对本分支实测确认。

## Mac 验收要点（若再验）
开 `__worldFlowLog`：回家出现 `home-duck`；海浪起播 `waves-start` 的 `from:"zero"`；0–200 ms 峰值不满幅；点击声约 −2.5 dB。
