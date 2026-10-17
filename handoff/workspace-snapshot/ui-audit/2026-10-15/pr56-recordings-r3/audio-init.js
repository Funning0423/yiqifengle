(()=>{const R=window.__rec={chunks:[],startEpoch:0,err:[]};let recCtx,dest,mr;
function ensure(){if(recCtx)return;try{recCtx=new (window.__OrigAC||AudioContext)();dest=recCtx.createMediaStreamDestination();
 mr=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:128000});mr.ondataavailable=e=>{if(e.data.size)R.chunks.push(e.data)};R.startEpoch=Date.now();mr.start(500);recCtx.resume();}catch(e){R.err.push(String(e))}}
const OrigAC=window.AudioContext;window.__OrigAC=OrigAC;const taps=new WeakMap();
function tapFor(ctx){if(taps.has(ctx))return taps.get(ctx);ensure();const d=ctx.createMediaStreamDestination();try{recCtx.createMediaStreamSource(d.stream).connect(dest)}catch(e){R.err.push('src '+e)}taps.set(ctx,d);return d;}
const oc=AudioNode.prototype.connect;AudioNode.prototype.connect=function(t,...a){const r=oc.call(this,t,...a);try{if(t instanceof AudioDestinationNode&&this.context!==recCtx){oc.call(this,tapFor(this.context))}}catch(e){R.err.push('c '+e)}return r;};
const op=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){try{if(!this.__tapped){ensure();const s=this.captureStream?this.captureStream():null;if(s){this.__tapped=1;const hook=()=>{if(s.getAudioTracks().length&&!this.__src){this.__src=recCtx.createMediaStreamSource(s);this.__src.connect(dest)}};s.onaddtrack=hook;setTimeout(hook,50)}}}catch(e){R.err.push('m '+e)}return op.apply(this,arguments)};
R.stop=()=>new Promise(res=>{mr.onstop=async()=>{const b=new Blob(R.chunks,{type:'audio/webm'});const buf=new Uint8Array(await b.arrayBuffer());let s='';for(let i=0;i<buf.length;i+=32768)s+=String.fromCharCode.apply(null,buf.subarray(i,i+32768));res(btoa(s))};mr.stop()});
document.addEventListener('DOMContentLoaded',ensure);})();
