'use strict';
/** Voice Bot: footstep alignment on the real exit (+ return) flow. Runs exit_sim (real WorldFlow + frozen standin +
 *  CharacterMotion + shipped GLB), feeds the REAL FootstepCore tracker the motion clock every frame exactly like
 *  GameAudio.lateUpdate does, and compares each fired step with the foot plants measured on the posed GLB soles.
 *  In-flow plant: sole height above the controller root drops to <= ON_M after a >= LIFT_M lift (time interpolated
 *  between frames). ok = |step - plant| <= 40 ms (step = the frame GameAudio calls play). untrimmed = the same + 25 ms LAME
 *  priming, for a decoder that does not honour the mp3 gapless header (reported, not required). Usage: node footstep_align.cjs [--fps 60] [--return] [--jitter 0.3] [--json out.json] [--csv out.csv] */
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..'),AUD=path.join(ROOT,'creator-build-project/assets/scripts/audio');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const {simulateExit}=require('./exit_sim.cjs');
const ON_M=0.004,LIFT_M=0.010,TOL_S=0.040,MP3_PRIMING_S=1105/44100;
function loadCore(){const mods={};const tx=f=>ts.transpileModule(fs.readFileSync(path.join(AUD,f),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const req=n=>{if(n==='./FootstepData')return mods.data;throw Error('unexpected import '+n);};
  mods.data={};vm.runInNewContext(tx('FootstepData.ts'),{exports:mods.data,require:req});
  const core={};vm.runInNewContext(tx('FootstepCore.ts'),{exports:core,require:req,Math,Object,Array,RegExp,parseInt});return core;}
function plantsFromFrames(frames){const out=[];
  for(const b of ['foot.L','foot.R']){let armed=false,prev=null;
    for(const f of frames){const h=f.sole[b][1]-f.pos[1];
      if(h>=LIFT_M)armed=true;
      if(armed&&h<=ON_M&&prev){const u=prev.h>ON_M?(prev.h-ON_M)/(prev.h-h):1;const t=prev.t+(f.t-prev.t)*u;
        out.push({t,bone:b,state:f.state,clip:f.clip,x:f.sole[b][0],z:f.sole[b][2]});armed=false;}
      prev={t:f.t,h};}}
  return out.sort((a,b)=>a.t-b.t);}
async function align(opts={}){const C=loadCore(),tracker=new C.FootstepTracker(),ground=new C.StepGround(),steps=[];
  const r=await simulateExit({fps:opts.fps||60,returnHome:!!opts.returnHome,jitter:opts.jitter||0,onFrame:(f,s,dt)=>{
    if(C.STEP_STATES.indexOf(f.state)<0){tracker.reset();return;}
    for(const h of tracker.observe(s.clock,dt)){const [x,z]=C.footPoint(f.pos[0],f.pos[2],f.yaw,h);steps.push({t:f.t,bone:h.bone,clip:h.clip,plantAbs:h.plantAbs,state:f.state,surface:ground.surfaceAt(x,z),x,z});}}});
  const plants=plantsFromFrames(r.frames).filter(p=>C.STEP_STATES.indexOf(p.state)>=0);
  const used=new Set(),rows=[];
  for(const p of plants){let best=-1,be=1e9;steps.forEach((s,i)=>{if(used.has(i)||s.bone!==p.bone)return;const e=s.t-p.t;if(Math.abs(e)<Math.abs(be)){be=e;best=i;}});
    const ok=best>=0&&Math.abs(be)<=TOL_S;if(best>=0&&Math.abs(be)<=0.2)used.add(best);
    const s=best>=0&&Math.abs(be)<=0.2?steps[best]:null;const truth=ground.surfaceAt(p.x,p.z);
    rows.push({plantT:p.t,bone:p.bone,state:p.state,clip:p.clip,truthSurface:truth,stepT:s?s.t:null,stepClip:s?s.clip:null,surface:s?s.surface:null,errMs:s?be*1000:null,errUntrimmedMs:s?(be+MP3_PRIMING_S)*1000:null,ok:!!s&&ok,untrimmedOk:!!s&&Math.abs(be+MP3_PRIMING_S)<=TOL_S,surfaceOk:!!s&&s.surface===truth,x:p.x,z:p.z});}
  const extra=steps.filter((s,i)=>!used.has(i));
  const errs=rows.filter(x=>x.errMs!==null).map(x=>x.errMs);
  const stats={fps:opts.fps||60,plants:plants.length,steps:steps.length,matched:rows.filter(x=>x.ok).length,missing:rows.filter(x=>!x.stepT&&x.stepT!==0).length,extra:extra.length,surfaceMismatch:rows.filter(x=>x.stepT!==null&&!x.surfaceOk).length,
    errMinMs:Math.min(...errs),errMaxMs:Math.max(...errs),errMeanMs:errs.reduce((a,b)=>a+b,0)/errs.length,untrimmedWithin40:rows.filter(x=>x.untrimmedOk).length,errMaxAbsUntrimmedMs:Math.max(...rows.filter(x=>x.errUntrimmedMs!==null).map(x=>Math.abs(x.errUntrimmedMs)))};
  return {stats,rows,extra,steps,frames:r.frames,changes:r.changes};}
module.exports={align,loadCore,plantsFromFrames,TOL_S,MP3_PRIMING_S};
if(require.main===module){const a=process.argv,arg=k=>{const i=a.indexOf(k);return i>0?a[i+1]:null;};
  align({fps:+(arg('--fps')||60),returnHome:a.includes('--return'),jitter:+(arg('--jitter')||0)}).then(res=>{
    console.log(JSON.stringify(res.stats));
    for(const x of res.rows)console.log([x.plantT.toFixed(3),x.bone,x.state,x.clip,x.truthSurface,x.stepT===null?'-':x.stepT.toFixed(3),x.stepClip||'-',x.surface||'-',x.errMs===null?'-':x.errMs.toFixed(1),x.ok?'ok':'FAIL',x.surfaceOk?'':'SURF'].join('\t'));
    for(const e of res.extra)console.log('EXTRA',e.t.toFixed(3),e.bone,e.state,e.clip,e.plantAbs.toFixed(3));
    if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify({stats:res.stats,gains:loadCore().STEP_GAIN,levels:(c=>({indoor:c.STEP_INDOOR,jitterIn:c.STEP_JITTER_DB,jitterOut:c.STEP_JITTER_OUT_DB,trim:c.STEP_VARIANT_TRIM_DB,windLift:c.STEP_WIND_LIFT}))(loadCore()),rows:res.rows,extra:res.extra,changes:res.changes,frames:res.frames.map(f=>({t:f.t,state:f.state,wind:f.wind,roomLight:f.roomLight,pos:f.pos}))}));
  }).catch(e=>{console.error(e);process.exit(1);});}
