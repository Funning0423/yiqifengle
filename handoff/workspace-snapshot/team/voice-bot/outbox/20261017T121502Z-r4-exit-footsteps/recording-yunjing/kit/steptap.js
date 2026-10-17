// Test harness only (no game code): records every AudioBufferSourceNode.start (buffer id, ctx time, perf) and the
// PCM of short buffers (templates for matched-filter onset detection); timestamps [QF_AUDIO] console lines with perf.
(()=>{const S=window.__qfSrc={starts:[],pcm:[],len:[]};const ids=new Map();
 const st=AudioBufferSourceNode.prototype.start;
 AudioBufferSourceNode.prototype.start=function(when,off,dur){try{const b=this.buffer;if(b){let id=ids.get(b);if(id===undefined){id=S.pcm.length;ids.set(b,id);S.pcm.push(b.duration<1.2?Array.from(b.getChannelData(0),v=>Math.round(v*32767)):null);S.len.push([b.length,b.sampleRate,b.duration]);}
   S.starts.push({id,perf:performance.now(),ct:this.context.currentTime,when:when||0,dur:b.duration});}}catch(e){}return st.apply(this,arguments);};
 window.__qfLogs=[];const wrap=k=>{const o=console[k];console[k]=function(...a){try{const t=String(a[0]);if(t.indexOf('[QF_AUDIO]')===0||t.indexOf('[QF_LAKE')===0)window.__qfLogs.push([performance.now(),t]);}catch(e){}return o.apply(this,a);};};wrap('info');wrap('log');wrap('warn');
 // simulated background: what a hidden tab reports (document.hidden / visibilityState) + the events Cocos web listens to
 window.__qfVis=h=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>h});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>h?'hidden':'visible'});
   document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event(h?'pagehide':'pageshow'));window.__qfMarks.push([performance.now(),h?'hide':'show']);return h;};
 window.__qfMarks=[];window.__qfMark=s=>{window.__qfMarks.push([performance.now(),s]);return s;};
 window.__qfStates=[];let last='';setInterval(()=>{try{const s=__worldIntegration.snapshot().state;if(s!==last){last=s;window.__qfStates.push([performance.now(),s]);}}catch(e){}},10);
})();
