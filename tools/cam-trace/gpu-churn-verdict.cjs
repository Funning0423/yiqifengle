'use strict';
/** r2 (B360 481c599c: churn persec=0 was reported PASS with NO probe output). Churn verdict from a console log:
 *    node tools/cam-trace/gpu-churn-verdict.cjs <console.log> [--max-1024-per-s 1] [--warmup-s 5]
 *  INCOMPLETE (exit 3, verdict=NOPROBE) when there is no `[QF_GPU] probe installed` line OR zero `[QF_GPU] s=` per-second lines
 *  (also reports the `[QF_CAM] enabled=` startup line or its absence). FAIL (exit 1) when a steady second after warmup has more
 *  1024x1024 creates than allowed or live/liveMB rises. PASS (exit 0) otherwise. Never PASS without probe output. */
const fs=require('fs');
function verdict(text,opt={}){const max=opt.max1024PerS??1,warm=opt.warmupS??5;const L=String(text).split(/\r?\n/);
 const cam=L.find(l=>/\[QF_CAM\] enabled=/.test(l))||null,inst=L.find(l=>/\[QF_GPU\] probe installed at=/.test(l))||null,
  notInst=L.find(l=>/\[QF_GPU\] probe NOT installed/.test(l))||null,sec=L.filter(l=>/\[QF_GPU\] s=\d+/.test(l));
 const r={verdict:'PASS',camStart:cam&&cam.slice(cam.indexOf('[QF_CAM]')),installed:inst&&inst.slice(inst.indexOf('[QF_GPU]')),notInstalled:notInst&&notInst.slice(notInst.indexOf('[QF_GPU]')),persec:sec.length,bad:[]};
 if(!inst||!sec.length){r.verdict='NOPROBE';r.incomplete=true;r.reason=(!cam?'no [QF_CAM] startup line (old build or camTrace module not loaded); ':'')+(!inst?'no "probe installed" line; ':'')+(!sec.length?'0 [QF_GPU] per-second lines':'');return r;}
 // per-second create counts of 1024 RTs: TEX op=create 1024x1024 lines grouped by the following s= line
 let cnt=0,i0=null,liveBase=null,liveMBBase=null;const per=[];
 for(const l of L){if(/\[QF_GPU\] TEX op=create 1024x1024/.test(l))cnt++;const m=/\[QF_GPU\] s=(\d+)/.exec(l);if(m){const s=+m[1];if(i0===null)i0=s;per.push({s,c1024:cnt,live:+((/ live=(\d+)/.exec(l)||[])[1]??NaN),liveMB:+((/ liveMB=([\d.]+)/.exec(l)||[])[1]??NaN)});cnt=0;}}
 for(const p of per){if(p.s-i0<warm)continue;if(liveBase===null&&!isNaN(p.live)){liveBase=p.live;liveMBBase=p.liveMB;}
  if(p.c1024>max)r.bad.push('s='+p.s+' 1024 creates='+p.c1024+'>'+max);}
 const steady=per.filter(p=>p.s-i0>=warm&&!isNaN(p.live));if(steady.length>1){const a=steady[0],b=steady[steady.length-1];if(b.liveMB-a.liveMB>8)r.bad.push('liveMB '+a.liveMB+'->'+b.liveMB);}
 r.steadySeconds=steady.length;if(r.bad.length)r.verdict='FAIL';return r;}
module.exports={verdict};
if(require.main===module){const a=process.argv.slice(2);if(!a[0]){console.error('usage: gpu-churn-verdict.cjs <console.log> [--max-1024-per-s N] [--warmup-s S]');process.exit(2);}
 const o={};const i=a.indexOf('--max-1024-per-s');if(i>0)o.max1024PerS=+a[i+1];const j=a.indexOf('--warmup-s');if(j>0)o.warmupS=+a[j+1];
 const r=verdict(fs.readFileSync(a[0],'utf8'),o);console.log('CHURN '+r.verdict+(r.incomplete?' = INCOMPLETE':'')+' '+JSON.stringify(r));process.exit(r.verdict==='PASS'?0:r.verdict==='NOPROBE'?3:1);}
