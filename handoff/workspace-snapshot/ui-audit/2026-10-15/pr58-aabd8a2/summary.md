# PR #58 @aabd8a2 验收
## 进度
- 22:39 Mac 上临时 clone ~/qf-aabd-tmp（push=DISABLED），检出中
- 23:15 共享电脑上检查了 git 里的 .meta：只有 env_skycity.glb.meta 用了自定义预设，共 18 个内嵌图（5 个 wx_astc4x4 法线、13 个 wx_astc6x6），一个都没用 wx_astc6_etc2；env_meadow.glb.meta 没有 presetId。Mac 往回拷文件一直失败（传 5MB 也报 unreachable），改成在 Mac 上用 --depth 1 拉取
- 23:40 在 Mac 上 --depth 1 拉取成功（w=aabd8a2，u=6754233，base=int/v2-slim）；小文件试传成功

## 第 1 步：重新导入和 .meta 压缩预设（不通过）
- 新 clone 没有 library，两个 GLB 都整份重新导入了（library 里已重新生成 bb978abb…=env_meadow，0694320f…=env_skycity）。
- 预设**没有被改成 wx_astc6_etc2**（两个 .meta 都搜不到）。但重新导入后，env_skycity.glb.meta 里的 `compressSettings` **从 18 条只剩 2 条**：tex_sky_palette_256、tex_sky_foliage_512 还是 wx_astc6x6；另外 16 张图（robot_metal、grass_tint、rock_strata、laputa_stone、bark 的 albedo/normal/orm，以及 rock_strata_512）的预设都丢了，变成不压缩。说明 git 里 .meta 的子资源和新 GLB 对不上，导入时被重建了。证据：evidence/sky-meta.diff、evidence/skymeta.after.json，git 里原来的版本是 frames/env_skycity.glb.meta.git。
- 任务里说的是 17 张图，git 的 .meta 里实际有 18 条（5 条 wx_astc4x4 法线贴图，13 条 wx_astc6x6）。

## 第 2 步：微信 release 构建（不通过）
构建配置：wechat-region-flow-test-build-options.json，debug=false，exit 36。
| 包 | 字节 | MiB |
|---|---|---|
| 主包 | 1,861,856 | 1.78 ✅ |
| **总包** | **27,179,085** | **25.92 ❌（上限 24；上一版 25.97，只少了 51,009 B）** |
| region_skycity | 8,748,430 | 8.34（和上一版完全一样） |
| region_meadow | 4,236,632 | 4.04 |
| static_seat_preview | 3,874,587 | 3.70 |
| region_island | 3,453,229 | 3.29 |
| board_art | 2,675,272 | 2.55 |
| main（分包） | 1,096,089 | 1.05 |
| audio_bgm_island | 502,421 | 0.48 |
| resources | 433,034 | 0.41 |
| internal | 297,535 | 0.28 |

- **skycity 分包里一个 .astc 都没有**：native 目录有 16 个 jpg、2 个 png、53 个 bin、1 个 mp3。
- 构建日志（evidence/b-w-wx.log）：剩下那 2 张有预设的图在压缩时也失败了，astcenc 报 `Search quality/preset '-undefined' is invalid`（asset 0694320f…@a9fef、@d2a4d，astc_6x6 failed）。builder.json 里 userPreset 写的是 `"astc_6x6": "medium"`，Creator 3.8.8 读不到对应的质量参数。所以就算预设没丢，按现在的配置也压不出 ASTC。

## 第 5 步：test_island_props（已知问题，只记录）
`node tools/t9-island-props/test_island_props.cjs` 退出码 1，第 299 行断言失败：`the unfixed prop really does balloon, width 108`。这是行囊宽度那条断言，按要求只记录、不修。完整输出在 evidence/test_island_props.txt（在共享电脑上用 typescript 5 跑的）。
- 00:00 草甸（白天、夜间）和天空之城（改前 int/v2-slim、改后，白天、夜间）录屏已传回，sha1 已校验

## 第 3 步：草甸完整流程（录屏 raw/20_pr58_{day,night}_p750.webm）
时区：白天 Etc/GMT-9（当地 12 点），夜间 Etc/GMT+4（当地 23 点）。游戏 props.night：白天 false，夜间 true。进场 26.3s，停留到 46.4s（20s），暂停 46.6s，继续 50.6s（夜间各晚约 0.26s）。对比对象是上一轮 0b1181d 的录屏：sbs/meadow_{day,night}_0b1181d_vs_aabd8a2.mp4（左边上一轮，右边这一轮）。

| 检查项 | 白天 | 夜间 | 依据 |
|---|---|---|---|
| v7.6 地面：草地不缺，没有黑带 | 通过 | 通过 | 整片绿草地都在，地平线上的黑带没了（frames/meadow40s_0b1181d_vs_aabd8a2_day_night.png）。下半屏亮度：上一轮白天 171（露底）→ 137，夜间 160 → 66 |
| 旗子循环动 | 通过 | 通过 | 帧差：动 1.23 → 暂停 0.04 → 继续 1.04（夜间 1.57 / 0.05 / 1.05）。旗子现在是红色 |
| 风车循环动（附带测） | 通过 | 通过 | 2.0 / 0.05 / 2.1（夜间 2.8 / 0.09 / 3.0） |
| 蝴蝶循环飞 | 通过 | 通过 | 下半屏 1.66 / 0.05 / 1.59（夜间 2.26 / 0.11 / 2.13），棋盘下方能看到蝴蝶 |
| 鸟循环飞 | **没录到** | **没录到** | 天空露出来的部分（右上）帧差只有 0.09，大部分天空被棋盘和标题挡住，看不到鸟。没法判定通过，需要在没有棋盘的草甸视角或真机上看 |
| 夜空变暗 | 通过 | 通过 | 天空顶部亮度：白天 125，夜间 23（上一轮夜间 171）。注意：夜间风车、房子和草地还是偏亮 |
| 暂停时一起停下 | 通过 | 通过 | 暂停那 3.2s 里各区域帧差 ≤ 0.11 |
| 没有测试横幅 | 通过 | 通过 | 顶部是关卡名“08 溪谷之心”，原来的“独立测试进度”横幅没了 |
| 不闪烁 | 通过 | 通过 | A-B-A 检测结果为 0 |
| 另外发现 | 注意 | — | 白天右上角那朵大云是深灰到黑色的阴影色，看着像乌云，和晴天不搭（frames/meadow_top_day_night.png） |

## 第 4 步：天空之城改前（int/v2-slim）和改后（aabd8a2）全屏对比
frames/skycity_{day,night}_before_vs_aabd8a2.png（左边改前，右边改后），sbs/skycity_*_v2slim_vs_aabd8a2.mp4。
- 前后画面基本一样，只是改后没有测试横幅。**改前、改后在网页预览里都有大片纯黑的模型**（机器人和石台都是黑剪影），不是这次改动造成的。
- **限制**：开发者工具和网页预览不会采样 ASTC 纹理，而且这次 release 包里根本没生成 .astc（见第 2 步），所以压缩后的画质和黑模型问题都只能在真机上看，这份截图不能代表画质。
- 00:01 结论已写完；Mac 清理完毕，剩余 10.37 GiB（10,871,896 KiB）
