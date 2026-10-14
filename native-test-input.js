'use strict';
// Fallback for broken IDE automator. Synthetic wx callback replay is explicitly
// distinguished from an OS mouse gesture in the acceptance report.
const listeners={};
for(const type of ['Start','Move','End','Cancel']) {
  const on='onTouch'+type,off='offTouch'+type;
  if(typeof wx[on]!=='function') continue;
  const callbacks=new Set(),nativeOn=wx[on].bind(wx),nativeOff=typeof wx[off]==='function'?wx[off].bind(wx):null;
  listeners[type]=callbacks;
  wx[on]=cb=>{callbacks.add(cb);return nativeOn(cb);};
  if(nativeOff)wx[off]=cb=>{if(cb)callbacks.delete(cb);else callbacks.clear();return nativeOff(cb);};
}
function emit(type,x,y) {
  const touch={identifier:19,clientX:x,clientY:y,pageX:x,pageY:y};
  const event={touches:type==='End'?[]:[touch],changedTouches:[touch],timeStamp:Date.now()};
  for(const cb of listeners[type]||[])cb(event);
}
setInterval(()=>{
  const h=globalThis.__worldIntegration;if(!h)return;
  const raw=wx.getStorageSync('__test_control');if(!raw)return;
  wx.removeStorageSync('__test_control');
  let command;
  try {
    command=JSON.parse(raw);
    if(command.op==='stage')h.enterMainlineStage('mainline-01',1);
    else if(command.op==='pause')h.hide();
    else if(command.op==='continue'){h.show();h.resume();}
    else if(command.op==='drag'){
      if(![command.x,command.y,command.u,command.v].every(Number.isFinite))throw Error('invalid coordinates');
      emit('Start',command.x,command.y);
      setTimeout(()=>emit('Move',command.u,command.v),100);
      setTimeout(()=>emit('End',command.u,command.v),200);
    } else throw Error('unknown test command rejected');
    wx.setStorageSync('__test_control_receipt',JSON.stringify({id:command.id,op:command.op,accepted:true,syntheticTouch:command.op==='drag',listenerCounts:Object.fromEntries(Object.entries(listeners).map(([k,v])=>[k,v.size]))}));
  } catch(e) {wx.setStorageSync('__test_control_receipt',JSON.stringify({id:command&&command.id,accepted:false,error:e.message}));}
},1000);
