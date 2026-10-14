'use strict';
// Test-only state export. Persistence stays in the unmodified business ports.
const bootId=Date.now();
let previous='';
setInterval(function(){
  const host=globalThis.__worldIntegration;
  if(!host || !GameGlobal.__task19Isolation) return;
  try {
    const boundary=GameGlobal.__task19Isolation;
    const data={early:GameGlobal.__task20Early,nativeProbe:wx.getStorageSync('__test_persistence_probe'),nativeActive:wx.getStorageSync('dot-mainline-r1-isolated-20261009:forest-mainline-cocos-r1-active'),bootId,prefix:boundary.prefix,covered:boundary.covered,rejected:boundary.rejected,
      audit:boundary.snapshot().filter(x=>x.key!==boundary.prefix+'__test_observation'),
      world:host.snapshot(),board:host.board(),mainline:host.mainline(),storage:host.mainlineStorage(),layout:host.layout()};
    const fingerprint=JSON.stringify([data.world,data.board&&data.board.checkpoint,data.board&&data.board.snapshot&&data.board.snapshot.state,data.nativeActive,data.nativeProbe]);
    if(fingerprint!==previous){wx.setStorageSync('__test_observation',JSON.stringify(data));previous=fingerprint;}
  } catch(e) { console.error('TASK19_OBSERVER_FAILURE',e); }
},1000);
