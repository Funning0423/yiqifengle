# build05 DevTools check (379e137 test package), 2026-10-16
Free space: start 8,369,272 KiB; before cleanup 8,846,868; after cleanup 8,888,728.
- Console now: 0 errors / 3 warnings (devtools_home_0err_3warn.png). The earlier 1 error did not come back. The warning text could not be read: it needs clicks in the console panel (GUI), which was not done.
- Game spams console.log: every tick it prints a full world snapshot (11.7 kB per entry).
- miniprogram-automator 0.12: Tool.getInfo answers (2.02.2608080 / SDK 3.17.4). Every App.* call (evaluate, callWxMethod, screenshot) times out with "timeout waiting for automator response" (tried 3 times: launch, cli auto, cli auto --trust-project). So the level could not be played in DevTools without the mouse.
- IDE log: "[SimulatorService] updateSimulatorCompileOptions: simulator not found s0" (WARN, each time it started).
- Desktop package sha1 identical before and after (995 files).
