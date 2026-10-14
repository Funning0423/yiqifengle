'use strict';
// Test-only state export. Persistence stays in the unmodified business ports.
let previous='';
setInterval(function(){
  const host=globalThis.__worldIntegration;
  if(!host || !GameGlobal.__task19Isolation) return;
  try {
    const boundary=GameGlobal.__task19Isolation;
    const data={prefix:boundary.prefix,covered:boundary.covered,rejected:boundary.rejected,
      audit:boundary.snapshot().filter(x=>x.key!==boundary.prefix+'__test_observation'),
      world:host.snapshot(),board:host.board(),mainline:host.mainline(),storage:host.mainlineStorage(),layout:host.layout()};
    const serialized=JSON.stringify(data);
    if(serialized!==previous){wx.setStorageSync('__test_observation',serialized);previous=serialized;}
  } catch(e) { console.error('TASK19_OBSERVER_FAILURE',e); }
},1000);
