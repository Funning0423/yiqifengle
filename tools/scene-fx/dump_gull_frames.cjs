'use strict';
/** QA preview helper (not shipped): runs the REAL GullFlockCore (+ IslandAtmosphereFxCore for smoke/beam) and writes per-frame
 * poses for blender_fx_preview.py (frames[].gulls). Calls come from the AmbienceAudio stub (gull_sim.cjs, Voice bot contract).
 *   island <out.json> <daySec> <nightSec> <fps> [seed]   fixed island camera (camera-track islandIdlePose): day segment then a night
 *          segment (each after 40 s warm-up so the flock is in its steady state); a near island call is placed in the day segment
 *   exit   <out.json> [seed] [leadS] [night]                   outbound camera track, near call at apron lift (14.87 s) + 0.43 s (Voice bot 4a8c474); writes the frames
 *          around the gull's closest in-frame moment (camera per frame) */
const fs=require('fs'),path=require('path');const S=require('./gull_sim.cjs'),{C,F}=S.load(),root=S.root;
const T=JSON.parse(fs.readFileSync(process.env.CAMERA_TRACK||path.resolve(root,'../../previews/运镜bot/camera-track.json'),'utf8'));
const [mode,out]=process.argv.slice(2,4),X=F.ISLAND_FX,geo=g=>({positions:g.positions,colors:g.colors,indices:g.indices});
const gpose=P=>P.map(p=>({vis:p.visible,pos:p.pos,rot:p.rot,size:p.size,wl:p.wingL,wr:p.wingR,ws:p.wingScaleX,mode:p.mode}));
function fx(t,cam,w){const light=F.lightFromNight(w),b=F.beamState(t,cam,light),p=F.smokePuffs(t,.25,w,1,cam);
  return {t,night:w,wind:.25,beam:{rot:b.rotation,alpha:b.alpha,flash:b.flash},glow:{pos:b.glowPos,rot:b.glowRotation,scale:b.glowScale,alpha:b.glowAlpha},glint:{rot:b.glintRotation,alpha:b.glintAlpha},
    puffs:p.map(q=>({pos:q.position,rot:q.rotation,scale:q.scale,color:q.color,alpha:q.alpha,mesh:0}))};}
const frames=[];let camera,info={};
if(mode==='island'){const [day,night,fps,seed]=process.argv.slice(4).map(Number),c0=S.camOf(T.islandIdlePose,T.aspect),hero=(T.frames.find(f=>f.phase==='islandIdle')||T.frames[0]).root;
  camera={pos:c0.pos,target:c0.pos.map((v,i)=>v+c0.fwd[i]*20),fov:T.islandIdlePose.fovVerticalDeg};
  for(const [seg,secs,w] of [['day',day,0],['night',night,1]]){const fl=new C.GullFlock((seed||21)+(w?7:0));fl.setView(true);const A=S.ambience(C.rng(77+w));A.onGullCall(e=>fl.onCall(e,A.gameTime()));
    const warm=40,tot=warm+secs;let nearDone=false,next=3;
    for(let i=0;i<tot*fps;i++){const t=i/fps,c=Object.assign({},c0);delete c.vel;A.tick(1/fps,c);
      if(t>next){A.schedule('random',Math.random()<.3?'near':'far',2.5);next+=w?18:9;}
      if(!w&&!nearDone&&t>=warm+secs*.45-2.5){nearDone=!!A.schedule('random','near',2.5,(S.camYaw(c)-25+360)%360);}
      const P=fl.advance(1/fps,c,w,hero);if(t>=warm){const fr=fx(t,c.pos,w);fr.gulls=gpose(P);fr.seg=seg;fr.tint=C.GullFlock.tint(w);if(C.wingTint)fr.wingTint=C.wingTint(w);
        fr.inFrame=P.filter(p=>p.visible&&C.project(c,p.pos).inFrame).length;frames.push(fr);}}
    info[seg]={nearLog:fl.nearLog.map(n=>({start:+(n.start-warm).toFixed(2),passAt:+(n.passAt-warm).toFixed(2),ok:n.ok}))};}
  var fpsOut=fps;}
else if(mode==='exit'){const seed=+(process.argv[4]||3),lead=+(process.argv[5]||.4),nw=+(process.argv[6]||0),fr=T.frames.filter(f=>f.phase==='outbound');const fl=new C.GullFlock(seed);fl.setView(true);
  const A=S.ambience(C.rng(seed*7+1));A.onGullCall(e=>fl.onCall(e,A.gameTime()));let call=null;const all=[];
  for(let i=1;i<fr.length;i++){const f=fr[i],dt=f.t-fr[i-1].t,c=S.camOf(f,T.aspect);A.tick(dt,c);if(!call&&f.t>=14.87+.43-lead)call=A.schedule('near','near',lead);
    const P=fl.advance(dt,c,nw,f.root),L=call&&fl.nearLog.find(x=>x.id===call.id);let score=-1;
    if(L&&L.gull>=0){const p=P[L.gull],pr=C.project(c,p.pos);if(p.visible&&pr.inFrame&&Math.abs(pr.sx)<.8&&Math.abs(pr.sy)<.85)score=1/Math.hypot(p.pos[0]-c.pos[0],p.pos[1]-c.pos[1],p.pos[2]-c.pos[2]);}
    const x=fx(f.t,c.pos,nw);x.gulls=gpose(P);x.camera={pos:c.pos,target:c.pos.map((v,k)=>v+c.fwd[k]*10),fov:f.fovVerticalDeg};x.score=score;x.callStart=call&&call.startAt!==undefined?+(call.startAt+fr[0].t).toFixed(3):null;x.tint=C.GullFlock.tint(nw);if(C.wingTint)x.wingTint=C.wingTint(nw);all.push(x);}
  const best=all.reduce((b,x,i)=>x.score>all[b].score?i:b,0);for(let i=Math.max(0,best-12);i<=Math.min(all.length-1,best+12);i++)frames.push(all[i]);
  camera=frames[0].camera;info={best:all[best].t,callStart:all[best].callStart,dist:+(1/all[best].score).toFixed(2)};var fpsOut=60;}
fs.writeFileSync(out,JSON.stringify({camera,fps:fpsOut,lamp:X.lamp,seaY:X.seaY,colors:{beam:X.beam.color,glow:X.glow.color,glint:X.glint.color},
  geometry:{beam:geo(F.beamGeometry()),glow:geo(F.discGeometry(18,.32,.55,0,0,900)),glint:geo(F.glintGeometry()),puff0:geo(F.discGeometry(14,.5,.8,.26,.22,11)),puff1:geo(F.discGeometry(14,.5,.8,.3,.22,37)),...(C.wingGeometry?{wingL:geo(C.wingGeometry(-1)),wingR:geo(C.wingGeometry(1))}:{})},frames,info}));
console.log('frames',frames.length,JSON.stringify(info));
