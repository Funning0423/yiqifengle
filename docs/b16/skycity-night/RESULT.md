# 天空之城夜间亮度（scene/b16-skycity-night，基于 integration/build16 e57b92ce）
## 原因
1. **棋盘的天空之城有一盏自己的钥匙光，没接全局夜间。** 这盏光是 SkycityBackgroundKey（暖色 SphereLight，luminance ×12）。r4.2 的 SkycityBoardLive 在夜间只把背景清屏色换成夜空，钥匙光和城里的模型都保持白天亮度。
2. **M_sky_cloud 是自发光材质。** 它用自己的颜色贴图做 emissiveTexture，emissiveFactor 为 1，所以 env_sky_cloud_small、cumulus、瀑布雾不管光照怎么调都是白天的亮度。气球旅程里的 dimCityNight 会把带自发光的材质跳过；落地后 cloud_small 重新打开，还是白天亮度。
3. **M_sky_palette_emissive 白天夜里都按强度 3 发光。** 用在 ruins 和 state_*_after 的点缀上。
（主光：气球旅程在落地时把主光恢复到挂载时记下的值。夜间挂载时这个值本来就是 ×0.35，所以主光不是这次的原因。云海 soft GLB 用的是受光照的 M_sky_palette，会跟着光变暗。）
## 改法（按岛 / 草甸 / 湖畔共用的全局夜间参数 DayNightContract.resolveDayNight('night')：主光 ×0.35，月光色 180/198/232）
- 新增 region/SkycityNightGrade.ts（纯函数）：钥匙光 ×0.35 并换成月光色；自发光云的 emissive ×0.35×月光色（亮度约 0.272，和城里其他受光表面一样暗）；暖色点缀保留，×0.45（实际强度 3→1.35，留下少量暖灯）；白天 w=0 时所有系数都是 1，白天画面完全不变。
- 新增 region/SkycityNightApply.ts：在活的城上实际执行，只改两种自发光材质和钥匙光。先重新绑定贴图，避免出现洋红。结果有缓存，只在昼夜切换时遍历一次。
- SkycityBoardLive：在 syncNight 里同时调整钥匙光和城里的材质，跟随 skyNightBlend 渐变，白天恢复原值。diagnostics 多了 keyLuminance。
- BalloonTransit：城可见时（cityOn，包括落地之后）调用 gradeSkycityNight(model,night?1:0)。
- SkycityBoardBackground.ts（Build05 原文件）没有改，逐字节一致。
## 亮度（tools/skycity/test_skycity_night_grade.cjs 锁住的数字：夜/昼）
- 钥匙光照亮的城：0.270（锁在 0.15–0.40）；修前是 1.0，只有天空变暗。
- 自发光云：0.272（同一区间，和城里其他部分相差 <0.02）；修前是 1.0。
- 暖色点缀：有效强度 1.35，白天是 3；仍然是画面里最亮的东西。
- 草甸旅程夜间的参考值是 0.197，两者在 2 倍以内。
- 渲染画面的线性平均亮度（Blender 引擎等效渲染）：
  - 棋盘机位：白天 0.744，修前夜间 0.487（白天的 65%），修后夜间 0.152（20%）。
  - 抵达机位：白天 0.512，修前夜间 0.152，修后夜间 0.046。
## 对比图
skycity_night_before_after_sheet.jpg：从左到右是修前夜间、修后夜间、白天；上排是气球抵达机位（近似：系泊点后上方，看向星庭），下排是棋盘机位（skycityVisitPose 390x844）。这是 **Blender 5.2.2 EEVEE 引擎等效渲染**，不是引擎截图，脚本在 tools/scene-design/skycity-night/night_render.py。需要在 Mac 或真机上按同样机位再确认一次。

## r2（Grok Bot 看了对比图后：棋盘前景的草地和星庭仍是白天绿）
- **原因：** 草地、星庭地面、草丛卡片、岩层都是受光的 M_sky_palette、foliage 和 rock_strata 材质，主要靠场景**环境光**照亮。岛上室外的夜间设置只把主光 ×0.35，**环境光（天光强度和颜色）在室外不随夜间变化**：WorldFlow.applyDayNight 不改环境光，RoomLightingRig 只在室内镜头时改。所以 r1 把钥匙光压暗后，前景几乎没变。草甸当年遇到的是同一个问题（MeadowBoardBackground N2b 的注释写明“lit mostly by ambient”），解决办法是把地面的 albedo 压暗。棋盘用的是同一个 env_skycity 模型，不是另一份模型。云海 soft GLB 共用受光的 M_sky_palette，环境光不变，所以抵达机位下方的云海接近白色。
- **改法：** 沿用草甸的夜间参数，不改全局环境光，避免影响岛上。
  - 地面、草、卡片、岩层：albedo × MEADOW_NIGHT_LINEAR (0.16, 0.20, 0.28)（线性），偏月光蓝，和草甸夜间一样；
  - 机器人等角色和道具：按草甸道具标准 ×0.6 sRGB（线性 0.325），保持清楚；
  - 云海 soft：月光蓝灰 (0.22, 0.26, 0.36)；
  - 暖色灯点保留原来的 albedo。
  - 全部随夜间权重 w 渐变，白天系数为 1。
  - 棋盘（SkycityBoardLive）和气球旅程（BalloonTransit，包括落地后）都会处理城和它旁边的云海节点。
- **测试：** test_skycity_night_grade 增加到 38 项。地面系数和草甸常量逐值相等；环境光照亮的地面夜间亮度为白天的 0.197（锁在 0.12–0.30），偏蓝；云海 0.259（比地面亮，≤ 0.35）；角色比地面亮；白天全部恢复。
- **渲染亮度（线性平均）：** 这次的等效渲染按引擎的实际情况，环境光保持白天值，所以修前夜间比 r1 更亮，更接近真机。
  - 棋盘机位：白天整幅 0.744，前景（画面下 45%）0.815；修前夜间整幅 0.585，前景 0.789（前景是白天的 97%）；修后夜间整幅 0.082，前景 0.091（11%）。
  - 抵达机位：白天整幅 0.513；修前夜间整幅 0.257，前景 0.407；修后夜间整幅 0.042，前景 0.066。
- **对比图：** skycity_night_before_after_sheet_r2.jpg（Blender 5.2.2 EEVEE 引擎等效渲染）。
