'use strict';
// Advisory boot timing (Grok Bot 2026-10-29): engine boot + subpackage loading run in parallel with the advisory (start()
// never waits for it); only end() can wait. Fake clock + 60 Hz rAF; game.js-like driver: start() → engine ready at E ms →
// end() → first game frame. Compares against the advisory-less path (no 2D canvas → advisory off) and prints [QF_BOOT].
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const FILE=process.env.QF_FIRST_SCREEN||path.resolve(__dirname,'../../creator-build-project/build-templates/wechatgame/first-screen.js'),SRC=fs.readFileSync(FILE,'utf8');
function run(engineMs,withAdvisory){
  let clock=0;const raf=[],logs=[],touch=[];
  const gl=new Proxy({},{get:(t,k)=>k in t?t[k]:(typeof k==='string'&&/^[A-Z_0-9]+$/.test(k)?1:(k==='getShaderParameter'||k==='getProgramParameter'?()=>true:()=>({})))});
  const ctx2d=new Proxy({},{get:(t,k)=>k==='measureText'?(()=>({width:10})):k in t?t[k]:(()=>({addColorStop(){}})),set:(t,k,v)=>{t[k]=v;return true;}});
  const canvas={width:780,height:1688,getContext:()=>gl};
  const wx=withAdvisory?{createCanvas:()=>({width:0,height:0,getContext:()=>ctx2d}),onTouchStart:f=>touch.push(f),offTouchStart(){},getStorageSync:()=>''}:{};
  class Image{set src(v){setTimeout0(()=>{this.width=750;this.height=1624;this.onload&&this.onload();});}}
  const timers=[];const setTimeout0=f=>timers.push(f);
  const sb={module:{exports:{}},window:{},canvas,Image,wx,console:{log:m=>logs.push(String(m))},Promise,Math,Date,Float32Array,
    performance:{now:()=>clock},requestAnimationFrame:f=>{raf.push(f);return raf.length;},cancelAnimationFrame(){}};
  sb.exports=sb.module.exports;sb.GameGlobal=sb;sb.window.canvas=canvas;vm.createContext(sb);vm.runInContext(SRC,sb);const FS=sb.module.exports;
  let startResolved=-1,released=-1;const st=sb.__firstScreen;
  FS.start('false','true','false').then(()=>{startResolved=clock;});
  const flush=async()=>{for(let i=0;i<5;i++){while(timers.length)timers.shift()();await null;}};
  let ended=false;
  return (async()=>{
    for(let f=0;f<1200&&released<0;f++){
      await flush();
      if(!ended&&clock>=engineMs){ended=true;FS.end().then(()=>{released=clock;});}
      clock+=1000/60;const q=raf.splice(0);for(const cb of q)cb();await flush();
    }
    clock+=1000/60;for(const cb of raf.splice(0))cb();await flush();
    return {startResolved,released,engineMs,t:st.t,log:logs.find(l=>l.startsWith('[QF_BOOT]')),adv:sb.__qfAdvisory};
  })();
}
(async()=>{
  const rows=[];
  for(const E of [300,1000,2000,2700,3000,4000,6000]){
    const a=await run(E,true),b=await run(E,false);
    assert.ok(a.startResolved>=0&&a.startResolved<100,'start() resolves at once (engine boot not gated by the advisory): '+a.startResolved);
    assert.ok(a.adv&&a.adv.done&&!a.adv.error,'advisory ran');assert.ok(!b.adv||b.adv.error,'baseline without advisory');
    const added=Math.round(a.released-b.released);
    assert.ok(/^\[QF_BOOT\] start=\d+ advisoryEnd=\d+ engineReady=\d+ released=\d+ firstGameFrame=\d+ addedMs=\d+$/.test(a.log),a.log);
    // engine ready before 2.7 s: added = rest of the 3.0 s; later: the full frame was held, so only its 300 ms fade-out is added
    const bound=(E<=2700?3000-E:300)+34;assert.ok(added<=bound,'E='+E+' added='+added+' bound='+bound);
    rows.push({engineReadyMs:E,releasedWithAdvisory:Math.round(a.released),releasedWithout:Math.round(b.released),addedMs:added,log:a.log});
  }
  // no loading look: the advisory paints no progress bar and no loading text
  const s=fs.readFileSync(path.resolve(__dirname,'src/first-screen.js'),'utf8'),pa=s.slice(s.indexOf('function paintAdvisory'),s.indexOf('function spaced'));
  assert.ok(!/加载|loading|progress|setProgress|bar_fill|%/i.test(pa),'advisory paint has no progress bar / loading text');
  for(const r of rows)console.log('engine ready '+String(r.engineReadyMs).padStart(4)+' ms → released '+r.releasedWithAdvisory+' vs '+r.releasedWithout+' without advisory, added '+r.addedMs+' ms');
  console.log('PASS advisory boot timing (parallel start, added = 3.0 s − engine, or the 300 ms fade when the engine is slower)');
})().catch(e=>{console.error(e);process.exit(1);});
