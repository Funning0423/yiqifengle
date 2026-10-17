// Minimal stand-in for a Creator wechatgame game.js (dry-run fixture only).
if (__FAKE_SCENARIO__ !== 'no-loadscene') console.log('LoadScene db://assets/scenes/WorldR5Integration.scene: 85.5 ms');
if (__FAKE_SCENARIO__ === 'game-error') console.error('TypeError: fake boot error before automation connects');
if (__FAKE_SCENARIO__ === 'late-error') setTimeout(function () { console.error('TypeError: fake late error after connect'); }, 1500);
