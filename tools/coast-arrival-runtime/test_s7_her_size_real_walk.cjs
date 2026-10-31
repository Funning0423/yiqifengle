'use strict';
// coast-s7-her-size-real-walk (运镜bot): her REAL S7 walk (real FlowReferenceStandin + CharacterMotion via adapter.perform, her_walk_replay.cjs)
// skinned with the real GLB and projected through the decoded runtime lens (her_size_walk.py) at 60 fps, 30 fps and uneven dt (LCG [1/90,1/45]).
// Rule (Grok Bot final (a)): t <= 38.867 s her height >= 0.06 of the screen and >= 40 px (390x520 >= 38.5 px), 7 screens, every clock.
// Also: CharacterMotion keeps walk_start + walk_stop_* (no linear fallback) on every clock.
// Negative self-test: the authored window 35.5747-39.8247 (1.2 m/s, walk_loop-only fallback) must FAIL this gate.
const cp=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const H=__dirname,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'yj-hsrw-'));let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL '+m);}return c;};
function run(tag,extra){const rp=path.join(tmp,tag+'.json'),out=path.join(tmp,tag+'-size.json');
 const r=cp.spawnSync(process.execPath,[path.join(H,'her_walk_replay.cjs'),rp],{env:{...process.env,...extra},encoding:'utf8',maxBuffer:64<<20});
 if(r.status!==0)throw Error(tag+' replay failed: '+r.stderr);
 const s=cp.spawnSync('python3',[path.join(H,'her_size_walk.py'),rp,out],{encoding:'utf8',maxBuffer:64<<20});if(s.status!==0)throw Error(tag+' size failed: '+s.stderr);
 return {log:r.stdout,res:JSON.parse(fs.readFileSync(out,'utf8'))};}
try{
 const a=run('runtime',{});const env={...process.env};delete env.QF_S7;
 for(const clock of ['60fps','30fps','uneven']){const R=a.res[clock];ok(R,'missing clock '+clock);if(!R)continue;
  const row=[];for(const [s,v] of Object.entries(R)){ok(v.n_bad===0,`${clock} ${s}: ${v.n_bad} samples below (min ${v.px_min} px @ ${v.px_t}, frac ${v.frac_min}, line ${v.line})`);row.push(`${s} ${v.px_min}px/${v.frac_min}`);}
  const cl=Object.values(R)[0].clips;ok(cl.includes('walk_start')&&cl.some(c=>/^walk_stop_body[LR]$/.test(c)),clock+' clips '+cl.join('>')+' (planWalk fallback)');
  console.log(`ok   ${clock}: ${row.join(' | ')} | clips ${cl.join('>')}`);}
 const plans=(a.log.match(/plan (\{.*\})/g)||[]).map(x=>JSON.parse(x.slice(5)));ok(plans.length===3&&plans.every(p=>p.start&&p.stop&&p.notes.length===0&&p.cruiseMps/0.7>=0.75&&p.cruiseMps/0.7<=1.3),'planWalk not clean: '+JSON.stringify(plans.map(p=>[p.cruiseMps,p.notes])));
 if(plans.length)console.log(`ok   planWalk: start + ${plans[0].stop}, cruise ${plans.map(p=>p.cruiseMps).join('/')} m/s (${(plans[0].cruiseMps/0.7).toFixed(3)} x native 0.7), no fallback notes`);
 const n=run('negative',{QF_S7:'35.5747,39.8247'});const bad=Object.values(n.res).some(R=>Object.values(R).some(v=>v.n_bad>0));ok(bad,'NEGATIVE: authored 4.25 s window passed (gate blind)');
 if(bad)console.log(`ok   negative: authored 35.575-39.825 window FAILS (390x520 ${n.res['60fps']['390x520'].px_min} px)`);
}catch(e){fails++;console.log('FAIL',e.stack||e);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
if(fails){console.log(fails+' FAIL');process.exit(1);}console.log('PASS coast-s7-her-size-real-walk');
