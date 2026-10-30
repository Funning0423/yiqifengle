'use strict';
// 运镜bot b20: T6 registry gate. She must be in frame (LensSmooth.herMargin >= 0 on that screen) on EVERY frame of every played skycity walk
// (sky-rail-model: board join in -> rails / skip joins / stand -> board join out; 7 screens; S4>S6 also from S6), at ANY distance, except inside a
// window registered in t6-offframe-registry.json (board join head 'i' / tail 'o', each <= 0.4 s). FAIL if (a) an off-frame frame is outside every
// registered window, (b) an off-frame run touching a window is longer than 0.4 s, (c) a registered window is longer than 0.4 s (or unknown walk/join).
// Every run also runs the self-test cases (must-FAIL synthetic frames / a 0.5 s window); --self-test runs only those. Reported (not gated): the old T6 metric, % in frame of the > 12 m frames. --self-test: synthetic cases that must FAIL / PASS.
const fs=require('fs'),path=require('path'),REG=JSON.parse(fs.readFileSync(path.join(__dirname,'t6-offframe-registry.json'),'utf8')),LIM=0.4,HZ=60;
const JK={i:'in',o:'out'};
// frames: [{join, out:boolean}], returns violations. Window = first maxS of the 'in' join (head) / last maxS of the 'out' join (tail).
function judge(w,frames,reg=REG){const v=[],win=new Array(frames.length).fill(false);
 for(const r of reg.windows){if(!(r.maxS>0&&r.maxS<=LIM&&r.maxS<=reg.maxWindowS&&reg.maxWindowS<=LIM&&JK[r.join]&&(r.end==='head'||r.end==='tail')))v.push({rule:'c',win:r});if(r.walk!==w)continue;
  const idx=frames.map((f,i)=>f.join===JK[r.join]?i:-1).filter(i=>i>=0);if(!idx.length)continue;const n=Math.round(Math.min(r.maxS,LIM)*HZ);(r.end==='head'?idx.slice(0,n):idx.slice(-n)).forEach(i=>win[i]=true);}
 let run=0,touch=false;frames.forEach((f,i)=>{if(f.out){if(!win[i])v.push({rule:'a',i,join:f.join||'rail'});run++;touch=touch||win[i];if(touch&&run/HZ>LIM+1e-9&&(i+1===frames.length||!frames[i+1].out))v.push({rule:'b',endI:i,runS:+(run/HZ).toFixed(3)});}else{run=0;touch=false;}});
 return v;}
function selfTest(){const mk=(nIn,nRail,nOut)=>[...Array(nIn).fill(0).map(()=>({join:'in',out:false})),...Array(nRail).fill(0).map(()=>({out:false})),...Array(nOut).fill(0).map(()=>({join:'out',out:false}))];
 const cases=[];
 {const f=mk(600,600,600);for(let i=0;i<20;i++)f[i].out=true;for(let i=0;i<20;i++)f[1799-i].out=true;cases.push(['registered head+tail 0.33 s each','S3>S4',f,REG,true]);}
 {const f=mk(600,600,600);f[900].out=true;cases.push(['one synthetic off-frame rail frame (within/any distance)','S3>S4',f,REG,false]);}
 {const f=mk(600,600,600);for(let i=0;i<30;i++)f[i].out=true;cases.push(['0.5 s off-frame run from the head window','S3>S4',f,REG,false]);}
 {const f=mk(600,600,600);for(let i=0;i<20;i++)f[i].out=true;cases.push(['head off-frame on an unregistered walk (S1>S2)','S1>S2',f,REG,false]);}
 {const f=mk(600,600,600);for(let i=0;i<20;i++)f[i].out=true;cases.push(['0.5 s registered window','S3>S4',f,{...REG,windows:[{walk:'S3>S4',join:'i',end:'head',maxS:0.5}]},false]);}
 {const f=mk(600,600,600);for(let i=0;i<20;i++)f[1799-i].out=true;cases.push(['tail off-frame but only head registered','S3>S4',f,{...REG,windows:[{walk:'S3>S4',join:'i',end:'head',maxS:0.4}]},false]);}
 let bad=0;for(const [n,w,f,r,exp] of cases){const ok=judge(w,f,r).length===0;if(ok!==exp)bad++;console.log((ok===exp?'ok  ':'BAD ')+(exp?'PASS':'FAIL')+' expected: '+n);}
 console.log(JSON.stringify({test:'sky-t6-registry --self-test',cases:cases.length,status:bad?'FAIL':'PASS'}));return bad;}
if(process.argv.includes('--self-test'))process.exit(selfTest()?1:0);
else{const st=selfTest()/* the must-FAIL cases run on every gate run */;const M=require('./sky-rail-model.cjs'),LS=M.H.load('region/LensSmooth.ts');let fails=0,far=0,farIn=0,offAll=0;const rows=[];
 for(const w of M.WALKS)for(const sc of M.SCREENS)for(const [lab,o] of [['board entry → exit',{}],...(w==='S4>S6'?[['from S6 (planSkip)',{fromS6:true}]]:[])]){
  const fr=M.samples(w,sc,o).map(s=>{const P=s.p.position,h=s.h,m=LS.herMargin(P,s.p.target,s.p.fovVerticalDeg,h,[sc]),d=Math.hypot(P[0]-h[0],P[1]-h[1]-1.3,P[2]-h[2]);if(s.join&&d>12){far++;if(m>=0)farIn++;}return {join:s.join,out:m<0};});
  const v=judge(w,fr),off=fr.filter(f=>f.out).length;offAll+=off;let mr=0,r=0;fr.forEach(f=>{r=f.out?r+1:0;mr=Math.max(mr,r);});if(v.length)fails++;
  rows.push({walk:w,screen:sc.join('x'),case:lab,frames:fr.length,offFrames:off,maxOffRunS:+(mr/HZ).toFixed(3),violations:v.length,first:v[0]?JSON.stringify(v[0]):'',ok:!v.length});}
 if(st)fails++;const sv=judge('',[]).filter(x=>x.rule==='c');if(sv.length){fails++;console.log('FAIL registry',JSON.stringify(sv));}
 console.table(rows);console.log(JSON.stringify({test:'sky-t6-registry',rows:rows.length,offFrames:offAll,registryWindows:REG.windows.length,t6Far12InFramePct:+(farIn/far*100).toFixed(2),t6Far12:`${farIn}/${far}`,status:fails?'FAIL':'PASS'}));process.exit(fails?1:0);}
