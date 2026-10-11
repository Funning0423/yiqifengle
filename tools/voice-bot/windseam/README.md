# windseam：风声循环接缝测试（Voice bot，测试专用）

目的：在真机 / 微信开发者工具上确认 `AudioSource.loop=true` 播 mp3 时，循环处有没有 ~50 ms 的空档。
两条素材 `resources/audio_amb/amb_wind_soft_loop.mp3`、`amb_wind_strong_loop.mp3`：22.05 kHz 单声道，
PCM 实长 2.900 s（63936 样本）；mp3 帧对齐后 2.952 s，含编码器前后填充约 52 ms（LAME/Info 头里记了无缝信息）。

## 开关（正常流程完全不动）
`VbWindSeamTest.ts` 在场景启动后只读一次参数；不是 `voiceScenario=windseam` 就直接返回：不建节点、不加载、不出声。
三种触发方式，任选一种（后者优先）：
1. 构建产物宏：`bash tools/voice-bot/windseam/inject_windseam.sh <OUT> [--query 'vbWindSec=30']`，收尾 `--remove`。
2. 开发者工具「自定义编译条件」的启动参数：`voiceScenario=windseam`。
3. web 预览：`?voiceScenario=windseam`。

可选参数：`vbWindSec=3..300`（每条时长，默认 30）、`vbWindDelay=0..10000`（手势后多久开始，默认 1000 ms）、`vbBgm=keep`（默认会暂停 BGM，结束后恢复）。
不依赖 T0：不需要 GGbot 注册场景。和 T0 一起用时用 `autoplay=observe` 或 `autoplay=off`（别用 out-and-back，会走出门，海浪会混进来）。
两个注入脚本都用时：先 GGbot 的 inject_prelude.sh，再 inject_windseam.sh；收尾反过来。

## 流程
等 `GameAudio.canPlayAmbience()`（有过手势、未静音、未挂起）→ 1 s → 暂停 BGM → soft 循环 30 s → strong 循环 30 s → 恢复 BGM → 节点自毁。
人留在屋里（海浪在屋里是静音的），点一下屏幕给手势即可。

## 日志（console + `wx.env.USER_DATA_PATH/VB_WINDSEAM.log`）
```
[VB_WINDSEAM] armed / loaded clip=soft dur=… / waiting …(每 5 s) / gesture-ok / bgm-paused
[VB_WINDSEAM] start clip=soft dur=2.952s loop=1
[VB_WINDSEAM] loop clip=soft n=1 periodMs=… prevCt=2.9xx ct=0.0xx frameMs=16 playing=1   (每次 currentTime 回绕)
[VB_WINDSEAM] end clip=soft wraps=10 measured=9 meanPeriodMs=… minMs=… maxMs=… clipDurMs=…
[VB_WINDSEAM] start clip=strong … / loop … / end clip=strong …
[VB_WINDSEAM] done scenario=windseam / bgm-restored
```
判读：`meanPeriodMs`（第 2 次起的回绕间隔均值）≈ 2900 → 无缝信息被尊重；≈ 2950 → 填充被当成静音播放（有空档）；
明显更大或抖动大 → 播放器在循环处重启。`currentTime` 在微信上更新粒度较粗，数值只作参考，以耳朵为准：
30 s 里听每 2.9 s 一次的“噗/断一下”。soft 声小，空档更容易听出来；strong 用来确认响度下也一样。

## 盒子测试
`node tools/voice-bot/windseam/test_windseam.cjs`（模拟 cc；无参数时零节点零加载；完整跑一遍 soft→strong→done，BGM 暂停后恢复）。

## 有空档时的备选（不在本分支实现）
- 代码修：在素材里去掉填充后改用 OGG 不可行（微信 iOS 不支持 ogg），所以优先：用两个 AudioSource 交叉衔接（在 ~2.85 s 起播下一条、短淡入淡出）。
- WebAudio：`wx.createWebAudioContext()` + `decodeAudioData` + `AudioBufferSourceNode.loop=true`，设 `loopStart/loopEnd` 跳过填充，可以做到采样级无缝；需要自己读 mp3 文件，Cocos AudioSource 不走这条路，所以不算“顺手”，先不做。
