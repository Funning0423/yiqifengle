// Test-harness audio tap (injected before any game script; NOT game code).
// Every AudioNode.connect(ctx.destination) is mirrored into a per-context ScriptProcessor that stores PCM with its
// AudioContext time (e.playbackTime); getOutputTimestamp() maps context time -> performance.now() (audible moment).
// HTMLMediaElement.play() is recorded too (element.captureStream() into a tap context) in case Cocos uses DOM audio.
(()=>{const T=window.__qfTap={ctxs:[],media:[],recording:false,events:[]};
 const oc=AudioNode.prototype.connect,od=AudioNode.prototype.disconnect;
 function tap(ctx){if(ctx.__qf)return ctx.__qf;const ch=2,sp=ctx.createScriptProcessor(4096,ch,ch),mix=ctx.createGain();oc.call(mix,sp);oc.call(sp,ctx.destination);
  const rec={ctx,mix,sp,chunks:[],maps:[],sr:ctx.sampleRate,kind:'webaudio'};
  sp.onaudioprocess=e=>{const o=e.outputBuffer;for(let c=0;c<o.numberOfChannels;c++)o.getChannelData(c).fill(0);if(!T.recording)return;
   const i=e.inputBuffer,L=i.getChannelData(0),R=i.numberOfChannels>1?i.getChannelData(1):L,n=L.length,pcm=new Int16Array(n*2);
   for(let k=0;k<n;k++){const a=Math.max(-1,Math.min(1,L[k])),b=Math.max(-1,Math.min(1,R[k]));pcm[2*k]=a*32767;pcm[2*k+1]=b*32767;}
   rec.chunks.push({t:e.playbackTime,pcm});};
  // AudioWorklet tap (audio thread: gapless, exact currentFrame per 4096-frame block; main-thread stalls only queue messages)
  rec.wl={blocks:[],ready:false,err:null};try{const src="class QfTap extends AudioWorkletProcessor{constructor(){super();this.on=false;this.n=0;this.f0=0;this.L=new Float32Array(4096);this.R=new Float32Array(4096);this.port.onmessage=e=>{this.on=e.data;this.n=0;};}process(i){const x=i[0];if(this.on&&x&&x.length){const L=x[0],R=x[1]||x[0];for(let k=0;k<L.length;k++){if(this.n===0)this.f0=currentFrame+k;this.L[this.n]=L[k];this.R[this.n]=R[k];if(++this.n===4096){const p=new Int16Array(8192);for(let j=0;j<4096;j++){p[2*j]=Math.max(-1,Math.min(1,this.L[j]))*32767;p[2*j+1]=Math.max(-1,Math.min(1,this.R[j]))*32767;}this.port.postMessage({f0:this.f0,p},[p.buffer]);this.n=0;}}}return true;}}registerProcessor('qf-tap',QfTap);";
   const url=URL.createObjectURL(new Blob([src],{type:'application/javascript'}));ctx.audioWorklet.addModule(url).then(()=>{const n=new AudioWorkletNode(ctx,'qf-tap',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit'});n.port.onmessage=e=>rec.wl.blocks.push(e.data);oc.call(mix,n);oc.call(n,ctx.destination);rec.wl.node=n;rec.wl.ready=true;if(T.recording)n.port.postMessage(true);}).catch(e=>{rec.wl.err=String(e);});}catch(e){rec.wl.err=String(e);}
  ctx.__qf=rec;T.ctxs.push(rec);return rec;}
 T.tap=tap;
 AudioNode.prototype.connect=function(d,...a){const r=oc.call(this,d,...a);try{if(typeof AudioDestinationNode!=='undefined'&&d instanceof AudioDestinationNode&&this!==this.context.__qf?.sp)oc.call(this,tap(this.context).mix);}catch(e){}return r;};
 AudioNode.prototype.disconnect=function(...a){try{if(a.length&&typeof AudioDestinationNode!=='undefined'&&a[0] instanceof AudioDestinationNode&&this.context.__qf)od.call(this,this.context.__qf.mix);}catch(e){}return od.apply(this,a);};
 const play=HTMLMediaElement.prototype.play;
 HTMLMediaElement.prototype.play=function(){try{if(!this.__qf){this.__qf=1;T.media.push({src:String(this.currentSrc||this.src).slice(-80),at:performance.now()});
   const el=this,hook=()=>{try{if(!T.mctx)T.mctx=new (window.AudioContext||window.webkitAudioContext)();const s=el.captureStream?el.captureStream():(el.mozCaptureStream?el.mozCaptureStream():null);
    if(s&&s.getAudioTracks().length){const src=T.mctx.createMediaStreamSource(s);const r=tap(T.mctx);r.kind='media';oc.call(src,r.mix);T.events.push('media-tap ok '+String(el.currentSrc).slice(-40));}else T.events.push('media-tap no-track');}catch(e){T.events.push('media-tap '+e);}};
   if(!this.paused&&this.readyState>2)hook();else this.addEventListener('playing',hook,{once:true});}}catch(e){T.events.push('media-tap '+e);}return play.apply(this,arguments);};
 // sample context→performance mappings while recording (drift check)
 setInterval(()=>{if(!T.recording)return;for(const r of T.ctxs){try{const o=r.ctx.getOutputTimestamp();if(o&&o.performanceTime>0)r.maps.push([o.contextTime,o.performanceTime]);}catch(e){}}},250);
 T.start=()=>{T.recording=true;T.startPerf=performance.now();for(const r of T.ctxs){r.chunks.length=0;if(r.wl){r.wl.blocks.length=0;r.wl.node?.port.postMessage(true);}}};
 T.stop=()=>{T.recording=false;T.stopPerf=performance.now();for(const r of T.ctxs)r.wl?.node?.port.postMessage(false);};
 // export one context: int16 interleaved PCM + its first chunk's ctx time + mappings (perf ms) + perf->epoch
 T.meta=()=>T.ctxs.map((r,i)=>({i,kind:r.kind,wlBlocks:r.wl?r.wl.blocks.length:0,wlReady:r.wl?.ready,wlErr:r.wl?.err,sr:r.sr,state:r.ctx.state,chunks:r.chunks.length,t0:r.chunks[0]?.t,maps:r.maps,baseLatency:r.ctx.baseLatency,outputLatency:r.ctx.outputLatency}));
 T.pcm=(i,from,count)=>{const r=T.ctxs[i],parts=r.chunks.slice(from,from+count);let n=0;for(const p of parts)n+=p.pcm.length;const all=new Int16Array(n);let o=0;for(const p of parts){all.set(p.pcm,o);o+=p.pcm.length;}
  let s='';const u=new Uint8Array(all.buffer);for(let k=0;k<u.length;k+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(k,k+0x8000));return {b64:btoa(s),times:parts.map(p=>p.t)};};
 T.wlpcm=(i,from,count)=>{const r=T.ctxs[i],parts=r.wl.blocks.slice(from,from+count);const all=new Int16Array(parts.length*8192);parts.forEach((p,k)=>all.set(p.p,k*8192));let s='';const u=new Uint8Array(all.buffer);for(let k=0;k<u.length;k+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(k,k+0x8000));return {b64:btoa(s),f0:parts.map(p=>p.f0)};};
 // A/V marker: beep through the game's own (tapped) graph + white full-screen flash at the same audible instant
 T.marker=(ms=120)=>{const r=T.ctxs.find(x=>x.kind==='webaudio');if(!r)return null;const ctx=r.ctx,o=ctx.getOutputTimestamp(),lead=.25,at=ctx.currentTime+lead,
   perfAt=o.performanceTime+(at-o.contextTime)*1000;const osc=ctx.createOscillator(),g=ctx.createGain();osc.frequency.value=1000;g.gain.value=.6;oc.call(osc,g);g.connect(ctx.destination);osc.start(at);osc.stop(at+ms/1000);
  const div=document.createElement('div');div.style.cssText='position:fixed;inset:0;background:#fff;z-index:99999;display:none';document.body.appendChild(div);
  const tick=()=>{const now=performance.now();if(now>=perfAt-4){div.style.display='block';T.events.push('flash '+now.toFixed(1)+' beep '+perfAt.toFixed(1));setTimeout(()=>div.remove(),ms);}else requestAnimationFrame(tick);};requestAnimationFrame(tick);
  return {beepPerf:perfAt,ctxTime:at};};
})();
