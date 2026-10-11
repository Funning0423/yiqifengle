# 全局首次触摸解锁声音（GGbot，2026-10-11）

**问题**：Mac 第二轮测试 `f0f3a13` 发现，在屋里滑动或点门都不会调用 `GameAudio.notifyUserGesture()`，所以屋里一直没有声音，要到岛上第一次点击才响。
**原因**：`RoomExploreOverlay` 是整屏的 UI 触摸面。Cocos 3.8 的 UI 节点会先把触摸吃掉，GameAudio 自己挂在 `input.on(TOUCH_END)` 上的全局监听收不到。

## 做法
`audio/AudioUnlock.ts` 由 `RoomExploreOverlay` import，模块加载时就自安装，`WorldIntegrationBoot` 不用改。四层入口全部**同步**调用 `GameAudio.notifyUserGesture()`：

| source | 入口 | 说明 |
|---|---|---|
| `wx` | `wx.onTouchStart` + `wx.onTouchEnd` | 平台层，跟 T1 L3 一样，在 UI 吃掉触摸之前就能看到。真机上第一次解锁都走这里。 |
| `canvas` | 没有 wx 时（Web 预览），在 `window` 的 capture 阶段监听 touchstart / touchend / mousedown / mouseup / pointerup | 浏览器不认 touchstart 是用户手势，所以 END 也要调。 |
| `cocos` | `input.on(TOUCH_START / TOUCH_END / MOUSE_UP)` | 只收得到没被 UI 吃掉的触摸。 |
| `room-swipe` / `door-tap` | `RoomExploreOverlay` 的 down/up 处理器，以及 `leave` 回调 | 屋里的备用入口。T0 直接调这些处理器时也会走到。 |

- 监听一直保留，不注销。GameAudio 还没建好时调用会被忽略；起播 10 秒没确认时，后面的触摸会重试。`wx.offTouch*` 一律不调：低版本基础库调不带参数的 off，会把引擎自己的触摸监听一起删掉。
- 只读接口：`AudioUnlock.snapshot()`、`AudioUnlock.onUnlock(cb)`、`globalThis.__audioUnlock`。T0 用它们打 `GB_MARK audio:unlock`。
- 解锁后在屋里能听到的只有 BGM（`audio_bgm/bgm_main`，音量 0.4）。海浪和海鸥跟着室外权重走，屋里是 0；风声跟着风力走，屋里也是 0。所以这几样在屋里保持无声，出门后才进来。

## 测试
`node tools/audio-unlock/test_audio_unlock.cjs`（需要 Node 22）。跑的是真实的 AudioUnlock、GameAudio、RoomExploreOverlay、AmbienceAudio 和 WindAudio，触摸路由按 Cocos 的规则模拟：平台层先收到，UI 节点命中就吞掉，只有没吞掉的才进全局 input。
最后一项是 ES5 安全检查，和 `test_es5_safety.cjs` 用同一套 TS 规则，但单独放在这个测试里，这样就不用改那个文件的 FILES 列表，免得和 work/GGbot-walk 冲突。
