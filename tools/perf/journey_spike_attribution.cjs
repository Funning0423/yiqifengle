'use strict';
/** r5 G1: attribute every slow frame of a Mac lk4 journey sample run (harness/lk4.cjs window.__smp, one row per AFTER_DRAW:
 *  [perfNow, DC, tris, distance, total, phase, state, usedJSHeap, textureSize, bufferSize, cams, sun, skyW]) to a cause.
 *  Causes (first match wins):
 *   harness-shot  the frame is ≤300 ms after the journey distance crossed a lk4 screenshot trigger (journey_ui at 10, j08/j16/j24/j30/j36;
 *                 the poll loop sleeps 80 ms, then page.screenshot stalls the page) → not game work, does not happen on a phone;
 *   first-show    first 3 frames of the 'approach' phase (region model shown for the first time: model creation + first-draw compiles);
 *   swap          the frame the board camera (…BackgroundCamera) first appears, and the next one;
 *   level-loading frames in state 'level-loading' (board build, guest, host prewarm);
 *   gc-major      JS heap fell by >40 MB on this frame;
 *   other.
 *  Separately every frame gets cap=1 when lk4's per-frame canvas capture was running (startSampler(cap): drawImage + JPEG toDataURL on
 *  EVERY AFTER_DRAW once total-distance < 2.5 m, in level-loading / level (first 25 level frames) / phase 'arrived'; capN in the
 *  marks says it ran). Those frames carry harness cost too (Mac r4 lakeside: swap 29.1 ms without capture, 36.7-36.9 ms with it).
 *  walkingGameOnly = region-travel frames that are neither harness-shot nor cap nor first-show.
 *  Frame time = perfNow delta between consecutive AFTER_DRAW samples (≈ rAF interval; includes vsync waiting, so a 60 Hz display shows
 *  16.7 ± ~1 ms jitter even when idle: p99 ≤ 16.7 is not resolvable this way, the harness counts >17.5 ms as "over 16.7").
 *  Usage: node tools/perf/journey_spike_attribution.cjs <samples.json>… [--csv outDir] [--json out.json] [--slow 17.5] */
const fs=require('fs'),path=require('path');
const SHOT_D=[8,10,16,24,30,36],SHOT_WIN=300,SLOW_DEFAULT=17.5;
const q=(a,p)=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y);return +s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(1);};
const stats=a=>({n:a.length,p50:q(a,.5),p95:q(a,.95),p99:q(a,.99),max:a.length?+Math.max.apply(null,a).toFixed(1):null,over17_5:a.filter(x=>x>17.5).length,over33:a.filter(x=>x>33).length,over50:a.filter(x=>x>50).length});
function analyse(rows,slow){
 const fr=[];let shotT=[],si=0,approachAt=-1,boardAt=-1,levelN=0;
 for(let i=1;i<rows.length;i++){const r=rows[i],p=rows[i-1],t=r[0],dt=t-p[0],d=+r[3]||0;
  while(si<SHOT_D.length&&d>=SHOT_D[si]){shotT.push(t);si++;}
  if(approachAt<0&&r[5]==='approach'&&p[5]!=='approach')approachAt=i;
  const cams=Object.keys(r[10]||{}),board=cams.some(c=>/BackgroundCamera$/.test(c)),pb=Object.keys(p[10]||{}).some(c=>/BackgroundCamera$/.test(c));
  if(boardAt<0&&board&&!pb)boardAt=i;
  if(r[6]==='level')levelN++;const tot=+r[4]||0,cap=(tot>0&&tot-d<2.5)||r[6]==='level-loading'||r[6]==='lakeside'||(r[6]==='level'&&levelN<25)||r[5]==='arrived';
  fr.push({i,t,dt,cap,dc:r[1],tris:r[2],d,phase:r[5],state:r[6],heap:r[7],tex:r[8],buf:r[9],dHeap:r[7]-p[7],dTex:r[8]-p[8],dBuf:r[9]-p[9],board});}
 for(const f of fr){let c='other';
  if(shotT.some(t=>f.t>=t&&f.t-t<=SHOT_WIN))c='harness-shot';
  else if(approachAt>0&&f.i>=approachAt&&f.i<approachAt+3)c='first-show';
  else if(boardAt>0&&(f.i===boardAt||f.i===boardAt+1))c='swap';
  else if(f.state==='level-loading')c='level-loading';
  else if(f.dHeap<-40e6)c='gc-major';
  f.cause=c;}
 const walk=fr.filter(f=>f.state==='region-travel'),slowF=fr.filter(f=>f.dt>slow);
 const by={};for(const f of slowF){(by[f.cause]=by[f.cause]||[]).push({cap:f.cap?1:0,d:+f.d.toFixed(2),ms:+f.dt.toFixed(1),phase:f.phase,state:f.state,dHeapMB:+(f.dHeap/1e6).toFixed(2),dTexMB:+(f.dTex/1e6).toFixed(2),dBufMB:+(f.dBuf/1e6).toFixed(2)});}
 for(const k in by)by[k].sort((a,b)=>b.ms-a.ms);
 const ll=fr.filter(f=>f.state==='level-loading');
 return {frames:fr.length,walking:stats(walk.map(f=>f.dt)),walkingNoHarness:stats(walk.filter(f=>f.cause!=='harness-shot').map(f=>f.dt)),
  walkingGameOnly:stats(walk.filter(f=>f.cause==='other'&&!f.cap).map(f=>f.dt)),walkingCapture:stats(walk.filter(f=>f.cap).map(f=>f.dt)),levelLoading:{...stats(ll.map(f=>f.dt)),frames:ll.length,ms:ll.length?+(ll[ll.length-1].t-ll[0].t+ll[0].dt).toFixed(1):0},
  swap:boardAt>0?fr.filter(f=>f.i===boardAt||f.i===boardAt+1).map(f=>({ms:+f.dt.toFixed(1),dBufMB:+(f.dBuf/1e6).toFixed(2),dTexMB:+(f.dTex/1e6).toFixed(2)})):[],
  slowByCause:Object.fromEntries(Object.entries(by).map(([k,v])=>[k,{count:v.length,worst:v.slice(0,6)}])),fr};}
if(require.main===module){const a=process.argv.slice(2),files=[],opt={slow:SLOW_DEFAULT};
 for(let i=0;i<a.length;i++){if(a[i]==='--csv')opt.csv=a[++i];else if(a[i]==='--json')opt.json=a[++i];else if(a[i]==='--slow')opt.slow=+a[++i];else files.push(a[i]);}
 if(!files.length){console.error('usage: journey_spike_attribution.cjs <samples.json>… [--csv dir] [--json out] [--slow ms]');process.exit(2);}
 const out={};for(const f of files){const r=analyse(JSON.parse(fs.readFileSync(f,'utf8')),opt.slow),name=path.basename(f).replace(/_journey_samples\.json$/,'');
  if(opt.csv){fs.mkdirSync(opt.csv,{recursive:true});fs.writeFileSync(path.join(opt.csv,name+'_frames.csv'),'t_ms,dt_ms,dc,tris,distance,phase,state,heap_mb,tex_mb,buf_mb,board_cam,cause,capture\n'+
   r.fr.map(x=>[x.t.toFixed(1),x.dt.toFixed(1),x.dc,x.tris,x.d.toFixed(2),x.phase,x.state,(x.heap/1e6).toFixed(1),(x.tex/1e6).toFixed(2),(x.buf/1e6).toFixed(2),x.board?1:0,x.cause,x.cap?1:0].join(',')).join('\n')+'\n');}
  delete r.fr;out[name]=r;}
 const s=JSON.stringify(out,null,1);if(opt.json)fs.writeFileSync(opt.json,s+'\n');console.log(s);}
module.exports={analyse,stats};
