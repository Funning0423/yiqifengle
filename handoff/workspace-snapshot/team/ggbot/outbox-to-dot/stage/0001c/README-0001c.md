# 0001c：把 resources 和 region_island 设成微信小游戏分包（作者 grokbot-2/ggbot）

## 基于哪个提交、怎么应用
在 E2fix 分支（0001 → 0002 → 0001b 之后）执行：`git am --directory=creator-build-project 0001-0001c-*.patch`。
我本机 0001b 之后的提交是 d4854cb，0001c 是 6ad9166。
改动只有三个文件：`assets/resources.meta`、`assets/bundles/region_island.meta`、`settings/v2/packages/builder.json`。代码和资源都没有改。

## 改了什么，依据是什么（没有用猜的字段名）
1. 两个文件夹 meta 的 userData 里写了 `isBundle: true`、`compressionType: {"wechatgame":"subpackage"}`、`isRemoteBundle: {"wechatgame":false}`。
   字段的写法和 Creator 3.8.8 安装包里自带的 meta 一致，比如 `resources/3d/engine/editor/assets/physics.meta` 的 userData 里就有 `compressionType: {}` 和 `isRemoteBundle: {}` 这两个按平台分键的对象，meta 版本同样是 1.2.0。
2. 3.8 实际起作用的是 `bundleConfigID`，它指向项目设置里的 Bundle 配置。所以两个 meta 的 `bundleConfigID` 都从 `default` 改成了 `wx_subpackage`，
   并在 `settings/v2/packages/builder.json` 的 `bundleConfig.custom.wx_subpackage` 里定义了这个配置：小游戏平台用 `preferredOptions`，值为 `{compressionType:"subpackage", isRemote:false}`；web 和原生平台保持 merge_dep。
   这个结构对照的是 3.8.8 builder 自带的类型定义（`CustomBundleConfig { displayName, configs: Record<'native'|'miniGame'|'web', {preferredOptions, fallbackOptions, ...}> }`），
   存放位置是 builder 包注册的项目设置键 `bundleConfig.custom`。
3. 构建选项照旧：`mainBundleCompressionType: "subpackage"`，`separateEngine: false`。CLI 里的 `bundleConfigs` 覆盖可以删掉，不删也行。

**没跑的部分（not_run）**：我在本机用 Creator 3.8.8 CLI 试构建，在 Build script 阶段被系统内存不足杀掉了，这台电脑上同时还开着别人的编辑器和 Blender。
所以「这套配置能让 game.json 生成两个分包」没有经过实际构建验证，要靠下面的自检来把关。

## 预计大小（用 Oi 的 0001b 实测数字推算）
- 主包：11,926,887 − 9,329,991（region_island）− 777,684（resources）= **1,819,212 字节，约 1.82 MB**。剩下的是 cocos-js 1,626,360 字节，加上 adapter 和启动文件 192,852 字节。
- 总包约 12.65 MB（12,652,813）。
- 微信规则（[官方分包文档](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/subPackage/useSubPackage.html)）：主包加全部分包不超过 30M，主包不超过 4M，**普通分包不限大小**，只有独立分包才限 4M。
  region_island 是普通分包，9.33 MB 不违反规则。
- 风险在体验上：`WorldIntegrationBoot` 启动时就会加载 region_island，首次启动大约要多下载 9.3 MB。瘦身路线（PLAN-move-combined-glb 第 4 步）：
  ① 用海岛 v2.2（GLB 6.5 MB）替换 combined_visual_m（这是下一步本来就要做的）；② 等腾讯云 COS 就绪后，把 region_island 改成远程包，只保留首屏需要的部分。
  ③ 如果真机下载太慢，再把 30 段动画和静态网格拆成两个 bundle，先显示静态部分。

## Oi 的验证步骤（不额外花额度）
1. 应用补丁以后，先确认 Creator 导入时没有把两个 meta 的 `bundleConfigID` 改回 default（git diff 应该为空，或者只有格式化差异）。
2. 正常构建以后先运行：`python3 check_wechat_build.py <构建输出目录>`
   - game.json 的 subpackages 里必须有 `resources` 和 `region_island`，缺一个就 FAIL；
   - 主包超过 4,000,000 字节就 FAIL；
   - 结果是 FAIL 就**不要打开 DevTools**，直接把输出发回来。
3. 通过以后再按 E2 的流程打开 DevTools，看启动有没有黑屏，有没有 `illegal property name`。
