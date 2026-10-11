'use strict';
/** T0 (work/GGbot-t0) camera hooks vs T2+: T0's REAL cameraSettle() (extracted from GrokbotAutoplay.ts on the T0 branch)
 * against the REAL WorldFlowComponent hook methods (extracted verbatim from this tree), fed by the REAL WorldFlow camera
 * events (tools/camera-frame-test/flow_sim.cjs). Asserts GB_MARKs resolve with source=hook, crane before settle.
 * Env: T0_REF (default work/GGbot-t0). Run with QF_TYPESCRIPT_MODULE=<vendor-node>/node_modules/typescript. */
const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process');process.exitCode=1;
const root=path.resolve(__dirname,'..','..'),ts=require('../qf-env.cjs').typescript();
const T0_REF=process.env.T0_REF||'work/GGbot-t0';
const t0=cp.execFileSync('git',['show',T0_REF+':tools/grokbot-autoplay/src/GrokbotAutoplay.ts'],{cwd:root,encoding:'utf8'});
const t0sha=cp.execFileSync('git',['rev-parse','--short',T0_REF],{cwd:root,encoding:'utf8'}).trim();
const m=t0.match(/ private cameraSettle\(\)\{[\s\S]*?\n(?= private |\})/);assert.ok(m,'T0 cameraSettle() not found');
const comp=fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts'),'utf8');
const grab=re=>{const x=comp.match(re);assert.ok(x,'WorldFlowComponent: '+re);return x[0];};
const hooks=[grab(/  private readonly settledListeners=[^\n]*\n/),grab(/  private readonly craneListeners=[^\n]*\n/),grab(/  onCameraSettled\(listener[^\n]*\n/),grab(/  onCraneStart\(listener[^\n]*\n/),grab(/  private forwardCameraEvent\(e:CameraEvent\)\{[\s\S]*?\n  \}\n/)].join('');
const src=`const G:any=globalThis;const now=()=>0;\nclass T0Camera { ctx:any;settleHookFor:any=null;settleHookAvailable=false;craneHookFor:any=null;craneReported=false;lastState:any=null;settle:any=null;reportedNoHook=false;constructor(ctx:any){this.ctx=ctx;}\n${m[0].replace(' private cameraSettle','  cameraSettle')}}\ntype CameraEvent=any;\nclass Comp { flow:any=null;\n${hooks}  emit(e:any){this.forwardCameraEvent(e);} }\nmodule.exports={T0Camera,Comp};`;
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};new Function('module','exports',js)(mod,mod.exports);const {T0Camera,Comp}=mod.exports;
(async()=>{
  const sim=require('../camera-frame-test/flow_sim.cjs');const out=await sim.run(sim.create(),{fps:60});
  const world=new Comp(),marks=[];let state='home';
  const ctx={findBoot:()=>({composition:{world}}),flow:()=>null,state:()=>state,mark:(n,d)=>marks.push(n+' '+(d||''))};
  const cam=new T0Camera(ctx);
  const byFrame=new Map(out.states.map(s=>[s.frame,s.state]));const last=Math.max(...out.frames.map(f=>f.frame));
  for(let f=0;f<=last;f++){if(byFrame.has(f))state=byFrame.get(f);for(const e of out.cameraEvents)if(e.frame===f)world.emit(e);cam.cameraSettle();}
  console.log(marks.join('\n'));
  const idx=re=>marks.findIndex(x=>re.test(x));
  assert.ok(idx(/^camera:settle-hook status=subscribed/)>=0,'settle hook subscribed');assert.ok(idx(/^camera:crane-hook status=subscribed/)>=0,'crane hook subscribed');
  const c=idx(/^crane-start source=hook segment=toIsland progress=0\.\d+/),i=idx(/^camera-settled:island source=hook/),h=idx(/^camera-settled:home source=hook/);
  assert.ok(c>=0&&i>c&&h>i,'crane-start < settled:island < settled:home, all source=hook');
  assert.ok(!marks.some(x=>/fallback-velocity|unavailable/.test(x)),'no fallback');
  assert.strictEqual(marks.filter(x=>x.startsWith('camera-settled:')).length,2,'one settle per journey');
  console.log(JSON.stringify({status:'PASS',t0:T0_REF+' '+t0sha,events:out.cameraEvents.map(e=>e.kind+(e.place?':'+e.place:'')+'@'+(e.frame/60).toFixed(2)+'s')}));process.exitCode=0;
})().catch(e=>{console.error('FAIL',e&&e.stack||e);});
