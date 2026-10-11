'use strict';
/** Return-entry landing follows the RUNTIME sit_down clip (角色动画bot will re-author sit_down/stand/idle).
 * WorldFlowCore.entrySpan times the sit segment of the one continuous return camera move as
 *   turn (CharacterAdapter.actionSeconds('turn')) + sit (actionSeconds('sit') = FlowReferenceStandin: the loaded
 *   AnimationClip 'sit_down'.duration, the same value perform() plays for), or + actionSettleSeconds('sit') (anim_meta
 *   clips.sit_down settle_time_s / settle_frame / fps) when exposed: the camera lands on cameraHome there and 'home' still
 *   waits for the clip end. 1.0 s is used ONLY when the adapter reports no clip.
 * Checks (sim character, 60 fps): camera first reaches cameraHome (1e-5 m) at sitting + turn + (settle | clip) +- 0.1 s, and
 * 'home' at sitting + turn + clip; for clip lengths 0.8 / 2.37 / 3.6 s, settle 1.6 s, and the no-report fallback.
 * --real-walk: also the real FlowReferenceStandin + GLB (needs the real_walk.cjs deps): its actionSeconds('sit') must equal
 * the GLB's sit_down clip length and drive the same landing. Usage: node test_sit_timing.cjs [--real-walk] */
const S=require('./flow_sim.cjs');
const args=process.argv.slice(2);let fails=0;
const ok=(name,cond,detail)=>{if(!cond)fails++;console.log((cond?'PASS ':'FAIL ')+name.padEnd(34)+JSON.stringify(detail));};
async function landing(opts,envOpts={}){const env=S.create(envOpts),run=await S.run(env,opts),F=run.frames,dt=run.dt,hp=env.cfg.cameraHome;
  const C=env.C,want=C.fromLookAt(hp,F[F.length-1].cam.fovVerticalDeg);const s0=run.states.find(s=>s.state==='sitting').frame,h=run.states.filter(s=>s.state==='home').pop().frame;
  const err=f=>Math.hypot(...f.cam.position.map((v,i)=>v-want.position[i]));
  let land=-1;for(let i=s0;i<F.length;i++){if(err(F[i])<1e-5&&F.slice(i).every(f=>err(f)<1e-5)){land=i;break;}}
  return {sittingAt:+(s0*dt).toFixed(3),landAfterSitting:+((land-s0)*dt).toFixed(3),homeAfterSitting:+((h-s0)*dt).toFixed(3),dt,env};}
(async()=>{const turn=1.5,tol=0.1; // 6 frames: the ease-out is within 1e-5 m of the pose a few frames early (job quantisation); cases differ by >= 0.7 s
  for(const clip of [0.8,2.37,3.6]){const r=await landing({sitSeconds:clip,reportActionSeconds:true});
    ok('clip '+clip+' s: lands at turn+clip',Math.abs(r.landAfterSitting-(turn+clip))<=tol&&Math.abs(r.homeAfterSitting-(turn+clip))<=tol+1e-3,{expected:turn+clip,land:r.landAfterSitting,home:r.homeAfterSitting});}
  {const r=await landing({sitSeconds:2.37,reportActionSeconds:true,sitSettleSeconds:1.6});
    ok('settle 1.6 of 2.37 s: lands at settle',Math.abs(r.landAfterSitting-(turn+1.6))<=tol&&Math.abs(r.homeAfterSitting-(turn+2.37))<=tol+1e-3,{expectedLand:turn+1.6,land:r.landAfterSitting,expectedHome:turn+2.37,home:r.homeAfterSitting});}
  {const r=await landing({sitSeconds:2.37,reportActionSeconds:true,sitSettleSeconds:9});
    ok('settle > clip ignored',Math.abs(r.landAfterSitting-(turn+2.37))<=tol,{land:r.landAfterSitting});}
  {const r=await landing({sitSeconds:1.0});ok('no report: 1.0 s fallback only then',Math.abs(r.landAfterSitting-(turn+1.0))<=tol,{land:r.landAfterSitting});}
  if(args.includes('--real-walk')){try{const r=await landing({},{realWalk:true}),L=r.env.realWalkClips.sit_down,st=r.env.realWalkStandin;
      ok('real standin: actionSeconds = GLB',Math.abs(st.actionSeconds('sit')-L)<1e-9&&st.actionSettleSeconds('sit')===undefined,{glbSitDown:L,actionSeconds:st.actionSeconds('sit'),settle:st.actionSettleSeconds('sit')??null,glb:r.env.realWalkGlb});
      ok('real standin: lands at turn+sit_down',Math.abs(r.landAfterSitting-(turn+L))<=tol,{expected:+(turn+L).toFixed(3),land:r.landAfterSitting,home:r.homeAfterSitting});
      const base=JSON.parse(require('fs').readFileSync(require('path').resolve(__dirname,'../../creator-build-project/assets/bundles/region_island/character/anim_meta.json'),'utf8'));
      st.setAnimMeta({...base,clips:{...base.clips,sit_down:{fps:30,settle_frame:30}}});const s1=st.actionSettleSeconds('sit');
      st.setAnimMeta({...base,clips:{...base.clips,sit_down:{duration_s:L*2,settle_time_s:L}}});const s2=st.actionSettleSeconds('sit');
      st.setAnimMeta(base);
      ok('real standin: settle from anim_meta',Math.abs(s1-Math.min(1,L))<1e-9&&Math.abs(s2-L/2)<1e-9,{settleFrame30at30fps:s1,rescaledHalf:s2,clip:L});}
    catch(e){ok('real standin',false,{error:String(e.stack||e).slice(0,300)});}}
  console.log(fails?'FAILED':'ALL PASS');process.exitCode=fails?1:0;})().catch(e=>{console.error(e.stack||e);process.exitCode=2;});
