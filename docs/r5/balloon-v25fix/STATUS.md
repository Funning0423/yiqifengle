# r5-balloon-v25fix

| 2026-10-18 16:37 | 开工 HEAD=c7d023b47cb01c47aaff07ab2c00163ce8b9ecc5 磁盘 Avail 7.1Gi | 修球囊/云海/06岛体 | — | c7d023b4 |
| 2026-10-18 17:05 | 代码 dd5789b8：白天 unlit×1.12、云明暗拉伸、地平线云到 21.5s、降落保留岛体、天空抖动、树冠 alpha test | 构建锁 + build-guard | suite 98/99；frame-bg seamLeak=0 | dd5789b8 |
| 2026-10-18 17:20 | 着色器去掉无 uniform 的 mainColor 后 wechat+web 通过。wechat 19960670 B | 锁内构建 | 包体低于上限 | 37ab9b36 |
| 2026-10-18 20:05 | 01–07、handoff_*、light_* 已拍。04 红 (223,72,60) 黄 (230,213,75)。05 dcWorst=42。洋红 0。磁盘 Avail 4.3Gi | 对比图已生成 | 截图提交 385dab1 | 385dab1 |
| 2026-10-18 20:10 | 最终 HEAD 385dab1 build-guard 通过。wechat 19960670 B，web 20753299 B，dirty=0。build/library/temp 已删，锁已放。磁盘 Avail 4.3Gi | 交付 | 包体与 37ab9b36 相同 | 385dab1 |
交付完成
