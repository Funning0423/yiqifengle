'use strict';
/** Scene FX test: chimney smoke + lighthouse beam/glow/sea glint (render/IslandAtmosphereFxCore.ts). CPU only.
 * 1 maths (basis quaternions), 2 anchors vs the real GLB (lamp pivot, chimney mouth), 3 beam/glint/disc geometry profiles,
 * 4 day/night (day = no light, night smoke not white), 5 flash from the LIVE camera, 6 near-camera fades over the whole
 * home->island->home flow (flow_sim, this tree; optional CAMERA_TREE=<other worktree> to replay another camera branch),
 * 7 tap safety (lighthouseTargets unchanged, no colliders), 8 wiring + byte cost,
 * 9 moon + moonlight glitter path (fixed-view composition from camera-track islandIdlePose, day hidden, night fade, glitter geometry:
 *   centre-only alpha, far narrow/bright vs near wide/dark, island front held down, wandering envelope; 3-layer twinkle; sea bounds).
 * Usage: node tools/scene-fx/test_island_fx.cjs [--json out.json]   (QF_TYPESCRIPT_MODULE, DRACO3D as for camera-frame-test) */
const fs=require('fs'),path=require('path'),os=require('os');
const root=path.resolve(__dirname,'..','..'),scripts=path.join(root,'creator-build-project/assets/scripts');
const args=process.argv.slice(2),jsonOut=args.includes('--json')?args[args.indexOf('--json')+1]:null;
const ts=require('../qf-env.cjs').typescript();
function loadCore(target){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'island-fx-'));
  const js=ts.transpileModule(fs.readFileSync(path.join(scripts,'render/IslandAtmosphereFxCore.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target}}).outputText;
  fs.writeFileSync(path.join(tmp,'core.js'),js);return require(path.join(tmp,'core.js'));}
const qrot=(q,v)=>{const [x,y,z,w]=q,ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];};
const hashLike=i=>{const x=Math.sin(i*12.9898)*43758.5453;return x-Math.floor(x);};
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
(async()=>{
  const checks=[],check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name.padEnd(30)+' '+JSON.stringify(detail));};
  const F=loadCore(ts.ScriptTarget.ES2020),F5=loadCore(ts.ScriptTarget.ES5),X=F.ISLAND_FX;
  // 1 maths
  let worst=0;for(let i=0;i<200;i++){const a=[Math.sin(i),Math.cos(i*1.3),Math.sin(i*.7)];const c=[Math.cos(i*2.1)*3,Math.sin(i*.4)*5+2,Math.sin(i*1.9)*4];
    const q=F.billboardQuat(a,c),z=qrot(q,[0,0,1]),t=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],l=Math.hypot(...t);worst=Math.max(worst,d3(z,t.map(v=>v/l)),Math.abs(qrot(q,[1,0,0])[1]));}
  const bs=F.beamState(3.3,[-9,4,13],1),bz=qrot(bs.rotation,[0,0,1]);worst=Math.max(worst,d3(bz,bs.dir));
  check('quaternion-basis',worst<1e-6,{worst});
  // 2 anchors
  let G=null;try{G=await require('../camera-frame-test/glb_geometry.cjs').decode();}catch(e){}
  const glb=path.join(root,'creator-build-project/assets/bundles/region_island/combined_visual_m.glb'),raw=fs.readFileSync(glb),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString());
  const node=n=>doc.nodes.find(x=>x.name===n);
  check('anchor-lamp-pivot',d3(node('env_lighthouse_beam_pivot_v22').translation,X.lamp)<1e-4&&d3(node('env_lighthouse_lamp_glow_v22').translation,X.lamp)<1e-4,{lamp:X.lamp});
  if(G){const P=G.meshes.env_lighthouse_ext.flat().filter(p=>p[0]>3.6&&p[0]<4.9&&p[2]>-2.6&&p[2]<-1.3&&p[1]>3.5),top=Math.max(...P.map(p=>p[1])),ring=P.filter(p=>p[1]>top-.15);
    const c=[ring.reduce((s,p)=>s+p[0],0)/ring.length,top,ring.reduce((s,p)=>s+p[2],0)/ring.length];
    check('anchor-chimney-mouth',d3(c,X.chimney)<.01,{measured:c.map(v=>+v.toFixed(3)),used:X.chimney});
    const sea=G.meshes.env_sea_surface.flat().map(p=>p[1]);check('glint-above-sea',X.seaY>Math.max(...sea)&&X.seaY-Math.max(...sea)<.06,{seaTop:Math.max(...sea),glintY:X.seaY});
  }else check('anchor-chimney-mouth',false,{error:'draco3d not found (set DRACO3D)'});
  // 3 geometry
  const bg=F.beamGeometry(),A=[];for(let i=3;i<bg.colors.length;i+=4)A.push(bg.colors[i]);
  const rows=F.BEAM_ROWS.length,cols=F.BEAM_COLS.length,core=A.slice(0,rows*cols),centre=r=>core[r*cols+3],edgeZero=[0,cols-1].every(c=>{for(let r=0;r<rows;r++)if(A[r*cols+c]!==0||A[rows*cols+r*cols+c]!==0)return false;return true;});
  const widen=F.beamRadius(1)/F.beamRadius(0),tail=centre(rows-1),mid=centre(6);
  check('beam-cone-soft',edgeZero&&widen>10&&tail===0&&mid>.3&&centre(0)===0&&A.every(a=>a>=0&&a<=1),{vertices:bg.positions.length/3,tris:bg.indices.length/3,widen:+widen.toFixed(1),centreAlongU:F.BEAM_ROWS.map((u,r)=>+centre(r).toFixed(2)),edgesZero:edgeZero});
  const gg=F.glintGeometry(),dg=F.discGeometry(14,.5,.8,.26,.22,11),ga=[],da=[];for(let i=3;i<gg.colors.length;i+=4)ga.push(gg.colors[i]);for(let i=3;i<dg.colors.length;i+=4)da.push(dg.colors[i]);
  check('glint-and-disc-soft',ga.every(a=>a>=0&&a<=1)&&Math.max(...ga)>.3&&da[0]===1&&da.slice(15).every(a=>a===0),{glintVerts:gg.positions.length/3,discVerts:dg.positions.length/3});
  // 4 day/night
  let dayMax=0;for(let t=0;t<40;t+=.05){const s=F.beamState(t,[-9,4,13],0);dayMax=Math.max(dayMax,s.alpha,s.glowAlpha,s.glintAlpha);}
  const nightPuffs=F.smokePuffs(2,0,1,1,[-9,4,13]),dayPuffs=F.smokePuffs(2,0,0,1,[-9,4,13]);
  const nightMaxCh=Math.max(...nightPuffs.map(p=>Math.max(...p.color))),young=nightPuffs.reduce((a,b)=>a.age<b.age?a:b),old=nightPuffs.reduce((a,b)=>a.age>b.age?a:b);
  check('day-no-light',dayMax===0,{dayMax});
  check('night-smoke-not-white',nightMaxCh<210&&old.color[2]>old.color[0]&&young.color[0]>young.color[2]&&dayPuffs.every(p=>p.color[0]>=p.color[2]),{nightOld:old.color.map(Math.round),nightMouth:young.color.map(Math.round),day:dayPuffs[0].color.map(Math.round)});
  // smoke motion: rises, grows, fades, leans more in wind
  const lean=w=>{const ps=F.smokePuffs(5.1,w,0,1,[-9,4,13]);const o=ps.reduce((a,b)=>a.age>b.age?a:b);return o.position[0]-X.chimney[0];};
  const series=[];for(let t=0;t<X.smoke.lifeS;t+=.5){const p=F.smokePuffs(t,0,0,1,[-30,4,30])[0];series.push(p);}
  const rising=series.every((p,i)=>i===0||p.position[1]>=series[i-1].position[1]-1e-9),growing=series.every((p,i)=>i===0||p.age<series[i-1].age||p.scale[1]>=series[i-1].scale[1]*.85);
  check('smoke-rise-grow-fade-lean',rising&&growing&&series[series.length-1].alpha<series[3].alpha&&lean(1)>lean(0)*2,{leanCalmM:+lean(0).toFixed(2),leanWind1M:+lean(1).toFixed(2),alphaByAge:series.map(p=>+p.alpha.toFixed(2))});
  // 4b day/night switch fades (T9n mechanism: 0.5 s linear night weight, smoothstep for the light), no jump per frame
  {let w=0,n=0,seq=[];while(w<1&&n<200){w=F.approachNight(w,true,1/60);n++;seq.push(w);}
    let maxSmoke=0,maxBeam=0,prevC=null,prevB=null;for(const v of [0].concat(seq)){const p=F.smokePuffs(2,0,v,1,[-9,4,13])[3],b=F.beamState(2,[-9,4,13],F.lightFromNight(v));
      if(prevC)maxSmoke=Math.max(maxSmoke,...p.color.map((c,i)=>Math.abs(c-prevC[i])));if(prevB!==null)maxBeam=Math.max(maxBeam,Math.abs(b.alpha-prevB));prevC=p.color;prevB=b.alpha;}
    check('night-fade-no-jump',Math.abs(n/60-X.nightFadeS)<=2/60&&maxSmoke<8&&maxBeam<.03&&F.approachNight(.3,true,5)===.3+.1/X.nightFadeS,{frames60:n,maxSmokeStepRGB:+maxSmoke.toFixed(2),maxBeamAlphaStep:+maxBeam.toFixed(4)});}
  // 4c same night-weight mechanism as T9n props (world-r2/IslandPropsLayout.approachNight, engine-free)
  {const lp=path.join(scripts,'world-r2/IslandPropsLayout.ts');if(fs.existsSync(lp)){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'props-'));
    const tr=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    fs.writeFileSync(path.join(tmp,'CameraPose.js'),tr(path.join(scripts,'world-r1/CameraPose.ts')));
    fs.writeFileSync(path.join(tmp,'p.js'),tr(lp).replace(/\.\.\/world-r1\/CameraPose/g,'./CameraPose'));
    const P=require(path.join(tmp,'p.js'));let diff=0;for(let i=0;i<400;i++){const w=hashLike(i),dt=(i%7)/40,n=i%3===0;diff=Math.max(diff,Math.abs(P.approachNight(w,n,dt)-F.approachNight(w,n,dt)));}
    check('night-weight-same-as-T9n',diff<1e-12&&P.ISLAND_PROPS.nightFadeS===X.nightFadeS,{maxDiff:diff,nightFadeS:X.nightFadeS});}else console.log('SKIP night-weight-same-as-T9n');}
  // 5 flash from live camera
  const flashAt=cam=>{let best=-1,bt=0,on=0;for(let t=0;t<X.beam.periodS;t+=1/60){const f=F.beamState(t,cam,1).flash;if(f>best){best=f;bt=t;}if(f>.5)on+=1/60;}return {best:+best.toFixed(3),at:+bt.toFixed(2),secondsAbove05:+on.toFixed(2)};};
  const fa=flashAt([-9.74,4.47,13.75]),fb=flashAt([13,6.5,4]);
  check('flash-follows-camera',fa.best>.9&&fb.best>.9&&Math.abs(fa.at-fb.at)>2&&fa.secondsAbove05>.3&&fa.secondsAbove05<2.5,{islandCam:fa,otherCam:fb,periodS:X.beam.periodS,oldBar:'12 s, two ends'});
  // 6 near camera over the real flows
  const flowRuns=[['this tree',root]];if(process.env.CAMERA_TREE)flowRuns.push(['CAMERA_TREE',path.resolve(process.env.CAMERA_TREE)]);
  for(const [label,tree] of flowRuns){
    const S=require(path.join(tree,'tools/camera-frame-test/flow_sim.cjs'));const env=S.create();const res=await S.run(env,{fps:60,script:['leaveHome','returnHome']});
    let minBeamSurface=1e9,minBeamAt=null,inside=0,beamFaded=0,badBeam=0,minPuff=1e9,minPuffAt=null,badPuff=0,puffFaded=0,minGlow=1e9;
    for(const fr of res.frames){const cam=fr.cam.position;
      for(const t of [0,X.beam.periodS*.25,X.beam.periodS*.5,X.beam.periodS*.75,fr.t]){const b=F.beamState(t,cam,1),n=F.beamCameraFade(b.dir,cam);
        if(n.surfaceM<minBeamSurface){minBeamSurface=n.surfaceM;minBeamAt={t:+fr.t.toFixed(2),state:fr.state,cam:cam.map(v=>+v.toFixed(2)),beamT:+t.toFixed(2)};}
        if(n.inside)inside++;if(b.cameraFade<1)beamFaded++;if((n.inside||n.surfaceM<X.beam.nearInnerM)&&b.alpha>0)badBeam++;
        minGlow=Math.min(minGlow,d3(cam,b.glowPos));}
      for(const tt of [fr.t,fr.t+1.3,fr.t+3.1,fr.t+5.2])for(const p of F.smokePuffs(tt,1,1,1,cam)){const s=d3(cam,p.position)-p.scale[0];if(s<minPuff){minPuff=s;minPuffAt={t:+fr.t.toFixed(2),state:fr.state};}if(p.cameraFade<1)puffFaded++;if(s<X.smoke.nearInnerM&&p.alpha>0)badPuff++;}}
    check('near-camera-'+label.replace(/\s/g,'-'),badBeam===0&&badPuff===0,{frames:res.frames.length,minBeamSurfaceM:+minBeamSurface.toFixed(2),minBeamAt,framesCameraInsideCone:inside,beamFadedSamples:beamFaded,minGlowDistM:+minGlow.toFixed(2),minPuffSurfaceM:+minPuff.toFixed(2),minPuffAt,puffFadedSamples:puffFaded});
  }
  // 6b 运镜bot exported camera track (previews/运镜bot/camera-track.json or CAMERA_TRACK=...): per-frame position
  const trackFile=process.env.CAMERA_TRACK||path.resolve(root,'../../previews/运镜bot/camera-track.json');
  if(fs.existsSync(trackFile)){const T=JSON.parse(fs.readFileSync(trackFile,'utf8'));let inside=0,bad=0,minS=1e9,minAt=null,maxFlash=0,flashFrames=0,faded=0,badPuff=0,minPuff=1e9;
    const phases=[];for(let k=0;k<16;k++)phases.push(k*X.beam.periodS/16);
    for(const fr of T.frames){const cam=fr.position;
      for(const ph of phases){const t=fr.t+ph,b=F.beamState(t,cam,1),n=F.beamCameraFade(b.dir,cam);if(n.inside)inside++;if(b.cameraFade<1)faded++;
        if((n.inside||n.surfaceM<X.beam.nearInnerM)&&b.alpha>0)bad++;if(n.surfaceM<minS){minS=n.surfaceM;minAt={t:fr.t,state:fr.state,phase:fr.phase,cam};}
        maxFlash=Math.max(maxFlash,b.flash);if(b.flash>.5)flashFrames++;}
      for(const p of F.smokePuffs(fr.t,1,1,1,cam)){const s=d3(cam,p.position)-p.scale[0];minPuff=Math.min(minPuff,s);if(s<X.smoke.nearInnerM&&p.alpha>0)badPuff++;}}
    const idle=T.islandIdlePose.position,fi=flashAt(idle);
    check('camera-track-json',bad===0&&badPuff===0&&fi.best>.9,{file:path.relative(path.resolve(root,'../..'),trackFile),frames:T.frames.length,beamPhasesPerFrame:phases.length,samplesCameraInsideCone:inside,samplesFaded:faded,minBeamSurfaceM:+minS.toFixed(2),minAt,minPuffSurfaceM:+minPuff.toFixed(2),flashSamplesAbove05:flashFrames,maxFlashOnTrack:+maxFlash.toFixed(3),islandIdleFlash:fi});
  }else console.log('SKIP camera-track-json (not found: '+trackFile+')');
  // synthetic: camera inside the cone / at the lamp -> 0
  const dir=F.beamDirection(0),inCone=[X.lamp[0]+dir[0]*8,X.lamp[1]+dir[1]*8+.3,X.lamp[2]+dir[2]*8];
  check('inside-cone-zero',F.beamState(0,inCone,1).alpha===0&&F.beamState(0,[X.lamp[0]+.3,X.lamp[1],X.lamp[2]],1).alpha===0&&F.smokePuffs(1,0,0,1,F.smokePuffs(1,0,0,1,[-9,4,13])[2].position)[2].alpha===0,{});
  // ES5 output identical numbers
  const e5=F5.beamState(7.7,[-9,4,13],1),e6=F.beamState(7.7,[-9,4,13],1);check('es5-same-result',JSON.stringify(e5)===JSON.stringify(e6),{});
  // 9 moon + moonlight band
  {const trackFile9=process.env.CAMERA_TRACK||path.resolve(root,'../../previews/运镜bot/camera-track.json');
   const T9=fs.existsSync(trackFile9)?JSON.parse(fs.readFileSync(trackFile9,'utf8')):null;
   const pose=T9?T9.islandIdlePose:{position:[-12,15.5,48],rotation:[-0.1473,-0.13302,-0.02,0.9799],fovVerticalDeg:42},aspect=T9&&T9.aspect||586/1266,hero=T9?T9.frames.find(f=>f.phase==='islandIdle').root:[-2.1135,0,5.2814];
   const cam=pose.position,q=pose.rotation,tY=Math.tan(pose.fovVerticalDeg*Math.PI/360),R=qrot(q,[1,0,0]),U=qrot(q,[0,1,0]),W=qrot(q,[0,0,-1]);
   const pj=p=>{const d=[p[0]-cam[0],p[1]-cam[1],p[2]-cam[2]],z=d[0]*W[0]+d[1]*W[1]+d[2]*W[2];if(z<=0)return null;return [((d[0]*R[0]+d[1]*R[1]+d[2]*R[2])/z/(tY*aspect)+1)/2,(1-(d[0]*U[0]+d[1]*U[1]+d[2]*U[2])/z/tY)/2,z];};
   const M=X.moon,B=X.band,mc=pj(M.pos),dist=d3(M.pos,cam),rScr=M.radiusM/dist/(2*tY),haloScr=M.haloRadiusM*.5/dist/(2*tY); // halo core radius (vertex alpha > ~.25), fraction of screen height
   const S=X.seaY,SG=[-4.38,-0.02,1.25],sign=[pj([SG[0]-1.2,S,SG[2]]),pj([SG[0]+1.2,SG[1]+1.5,SG[2]])],head=pj([hero[0],1.75,hero[2]]),feet=pj(hero);
   const horizon=pj([cam[0]+W[0]*250/Math.hypot(W[0],W[2]),S,cam[2]+W[2]*250/Math.hypot(W[0],W[2])]);
   let cloudHits=0,cloudVerts=0;if(G&&G.meshes.env_cloud_layer){for(const tri of G.meshes.env_cloud_layer)for(const v of tri){const c=pj(v);if(!c)continue;cloudVerts++;const dx=(c[0]-mc[0])*aspect,dy=c[1]-mc[1];if(Math.hypot(dx,dy)<haloScr*1.4)cloudHits++;}}
   const signRect={x0:Math.min(sign[0][0],sign[1][0]),x1:Math.max(sign[0][0],sign[1][0]),y0:Math.min(sign[0][1],sign[1][1]),y1:Math.max(sign[0][1],sign[1][1])};
   const ms=F.moonState(10,cam,1),bandAt=y=>{ // screen point of the band centre line nearest to screen row y (sampled along the strip)
     const h=qrot(ms.bandRotation,[0,0,1]);let best=null;for(let z=B.startM*ms.bandScale;z<=B.endM*ms.bandScale;z+=.25){const c=pj([ms.bandPos[0]+h[0]*z,S,ms.bandPos[2]+h[2]*z]);if(c&&(!best||Math.abs(c[1]-y)<Math.abs(best[1]-y)))best=c;}return best;};
   const bSign=bandAt((signRect.y0+signRect.y1)/2),bHero=bandAt(feet[1]),bHorizon=bandAt(horizon[1]+.004),bBottom=bandAt(.999);
   const ok=mc&&mc[1]-rScr>0&&mc[1]+haloScr<horizon[1]&&Math.abs(mc[0]-head[0])>.15&&mc[0]-rScr/aspect>0&&!(mc[0]>signRect.x0-.1&&mc[0]<signRect.x1+.1)&&cloudHits===0&&dist>150&&dist<270&&Math.hypot(...M.pos)<282-20
     &&Math.abs(bHorizon[0]-mc[0])<.03&&bSign&&(bSign[0]<signRect.x0-.08)&&bBottom[1]>.99;
   check('moon-fixed-view-composition',!!ok,{track:T9?path.relative(path.resolve(root,'../..'),trackFile9):'built-in pose',moonScreen:mc&&mc.slice(0,2).map(v=>+v.toFixed(3)),moonRadiusPxOn1266:+(rScr*1266).toFixed(1),moonDistM:+dist.toFixed(1),
     horizonY:+horizon[1].toFixed(3),heroHeadScreen:head.slice(0,2).map(v=>+v.toFixed(3)),signpostRect:Object.fromEntries(Object.entries(signRect).map(([k,v])=>[k,+v.toFixed(3)])),cloudVertsNearMoon:cloudHits,cloudVertsInView:cloudVerts,
     bandScreen:{atHorizon:bHorizon.slice(0,2).map(v=>+v.toFixed(3)),atHerFeetRow:bHero.slice(0,2).map(v=>+v.toFixed(3)),atSignpostRow:bSign.slice(0,2).map(v=>+v.toFixed(3)),atBottom:bBottom.slice(0,2).map(v=>+v.toFixed(3))}});
   // day hidden, night fade without jumps (T9n weight -> lightFromNight like the beam)
   let dayMax=0;for(let t=0;t<30;t+=.1){const m=F.moonState(t,cam,0);dayMax=Math.max(dayMax,m.moonAlpha,m.haloAlpha,m.bandAlpha);}
   let w=0,prev=null,maxStep=0;for(let i=0;i<40;i++){w=F.approachNight(w,true,1/60);const m=F.moonState(3,cam,F.lightFromNight(w));if(prev)maxStep=Math.max(maxStep,Math.abs(m.moonAlpha-prev.moonAlpha),Math.abs(m.bandAlpha-prev.bandAlpha));prev=m;}
   check('moon-day-hidden-night-fade',dayMax===0&&maxStep<.06&&prev.moonAlpha>.85&&prev.bandAlpha>.1,{dayMax,maxAlphaStepPer60fpsFrame:+maxStep.toFixed(4),night:{moon:+prev.moonAlpha.toFixed(3),halo:+prev.haloAlpha.toFixed(3),band:+prev.bandAlpha.toFixed(3)}});
   // band: far end on the sea for every camera on the track, near end >= 10 m from the lens, aimed at the moon from the live camera
   // glitter geometry (v3): per layer 5 vertices per sparkle (centre + 4 tips), alpha only at the centre (soft, no straight edges)
   const layers=[];for(let k=0;k<B.layers;k++)layers.push(F.bandGeometry(k));
   const sp=[];let shapeOk=true;for(const g of layers){if(g.positions.length%15||g.indices.length!==g.positions.length/15*12)shapeOk=false;
     for(let i=0;i<g.positions.length/3;i+=5){const al=g.colors[i*4+3];if(al<0||al>1)shapeOk=false;for(let j=1;j<5;j++)if(g.colors[(i+j)*4+3]!==0)shapeOk=false;sp.push({x:g.positions[i*3],z:g.positions[i*3+2],a:al,hl:Math.abs(g.positions[(i+2)*3]-g.positions[(i+1)*3])/2});}}
   const thF=Math.atan(B.eyeM/B.endM),thN=Math.atan(B.eyeM/B.startM),nOf=z=>(Math.atan(B.eyeM/z)-thF)/(thN-thF),third=k=>sp.filter(q=>{const n=nOf(q.z);return n>=k/3&&n<(k+1)/3;});
   const pct=(arr,p)=>{const v=arr.slice().sort((a,b)=>a-b);return v.length?v[Math.min(v.length-1,Math.floor(p*v.length))]:0;};
   const spreadDeg=arr=>pct(arr.map(q=>Math.abs(Math.atan2(q.x,q.z))*180/Math.PI),.9),meanA=arr=>arr.reduce((s,q)=>s+q.a,0)/Math.max(1,arr.length);
   const far3=third(0),mid3=third(1),near3=third(2),spread=[spreadDeg(far3),spreadDeg(mid3),spreadDeg(near3)],bright=[meanA(far3),meanA(mid3),meanA(near3)];
   // island front (< frontM[0]) held down vs the open water just behind it
   const front=sp.filter(q=>q.z<B.frontM[0]),open=sp.filter(q=>q.z>=B.frontM[1]&&q.z<B.frontM[1]*1.6),frontRatio=meanA(front)/Math.max(1e-9,meanA(open));
   // envelope wanders: 12 m windows in the mid range, CV of angular spread and of mean alpha
   const win=[];for(let z=40;z<200;z+=12){const w=sp.filter(q=>q.z>=z&&q.z<z+12);if(w.length>8)win.push({s:spreadDeg(w)/(B.farHalfDeg+(B.nearHalfDeg-B.farHalfDeg)*Math.pow(nOf(z+6),.8)),a:meanA(w)});}
   const cv=v=>{const m=v.reduce((s,x)=>s+x,0)/v.length;return Math.sqrt(v.reduce((s,x)=>s+(x-m)*(x-m),0)/v.length)/m;};
   const glitterOk=shapeOk&&sp.length===B.count&&layers.length===B.layers&&spread[0]*1.4<spread[1]&&spread[0]*1.4<spread[2]&&bright[0]>bright[1]&&bright[1]>bright[2]&&frontRatio<.75&&cv(win.map(w=>w.s))>.08&&cv(win.map(w=>w.a))>.12&&Math.max(...sp.map(q=>q.a))<=1;
   check('moonlight-glitter-geometry',glitterOk,{sparkles:sp.length,layers:layers.length,vertsPerLayer:layers.map(g=>g.positions.length/3),centreOnlyAlpha:shapeOk,spread90Deg_far_mid_near:spread.map(v=>+v.toFixed(2)),meanAlpha_far_mid_near:bright.map(v=>+v.toFixed(3)),
     islandFrontVsOpenWater:+frontRatio.toFixed(2),envelopeCV:{width:+cv(win.map(w=>w.s)).toFixed(2),brightness:+cv(win.map(w=>w.a)).toFixed(2)},sparkleHalfLenM:{far:+pct(far3.map(q=>q.hl),.5).toFixed(2),near:+pct(near3.map(q=>q.hl),.5).toFixed(2)}});
   // twinkle (3 layers out of phase), day hidden per layer, per-frame steps small
   let twMin=1e9,twMax=0,twStep=0,dayLayers=0,pw=null;for(let t=0;t<20;t+=1/60){const m=F.moonState(t,cam,1);for(const v of m.bandLayerAlpha){twMin=Math.min(twMin,v/m.bandAlpha);twMax=Math.max(twMax,v/m.bandAlpha);}
     if(pw)for(let k=0;k<pw.length;k++)twStep=Math.max(twStep,Math.abs(m.bandLayerAlpha[k]-pw[k]));pw=m.bandLayerAlpha;dayLayers=Math.max(dayLayers,...F.moonState(t,cam,0).bandLayerAlpha);}
   check('moonlight-glitter-twinkle',dayLayers===0&&twMin>=.19&&twMax<=1.0001&&twMax-twMin>.6&&twStep<.03,{dayMaxLayerAlpha:dayLayers,layerFactorRange:[+twMin.toFixed(2),+twMax.toFixed(2)],maxLayerAlphaStepPer60fpsFrame:+twStep.toFixed(4)});
   let offSea=0,minNear=1e9,minMoonCam=1e9,aim=0,scales=new Set();const cams=T9?T9.frames.map(f=>f.position).concat([cam]):[cam];
   for(const c of cams)for(const t of [0,.7,1.4,2.2,2.9]){const m=F.moonState(t,c,1),h=qrot(m.bandRotation,[0,0,1]),far=B.endM*m.bandScale,e=[c[0]+h[0]*far,c[2]+h[2]*far];scales.add(+m.bandScale.toFixed(3));
     if(Math.abs(e[0])>B.seaHalfM||Math.abs(e[1])>B.seaHalfM)offSea++;if(m.bandAlpha>0)minNear=Math.min(minNear,m.bandNearM);minMoonCam=Math.min(minMoonCam,m.moonCamM);
     const toM=[M.pos[0]-c[0],M.pos[2]-c[2]],l=Math.hypot(...toM);aim=Math.max(aim,1-(h[0]*toM[0]+h[2]*toM[1])/l);}
   check('moonlight-band-on-sea-safe',offSea===0&&minNear>=10&&minMoonCam>100&&aim<1e-9,{camerasChecked:cams.length,farEndOffSea:offSea,minBandDistToCameraM:+minNear.toFixed(2),minMoonDistToCameraM:+minMoonCam.toFixed(1),maxAimError:aim,bandScaleRange:[Math.min(...scales),Math.max(...scales)]});
  }
  // 7 taps
  const wfc=fs.readFileSync(path.join(scripts,'world-r1/WorldFlowComponent.ts'),'utf8'),fx=fs.readFileSync(path.join(scripts,'render/IslandAtmosphereFx.ts'),'utf8');
  check('taps-unchanged',wfc.includes("for(const name of ['env_lighthouse_ext','env_lighthouse_door','env_interior_shell'])")&&!/Collider|UITransform|EventType|\.on\(/.test(fx)&&!/fx_lighthouse|fx_chimney|fx_moon|atmosphere/.test(wfc.slice(wfc.indexOf('private hitLighthouse'),wfc.indexOf('private roomView'))),{lighthouseTargets:['env_lighthouse_ext','env_lighthouse_door','env_interior_shell']});
  // 8 wiring + bytes
  const wired=['new IslandAtmosphereFx(director.getScene()!)','this.atmosphere?.setView(this.exteriorVisible,','this.atmosphere?.advance(dt,this.worldCamera?.node??null,this.getWindStrength())'].every(s=>wfc.includes(s))&&(wfc.match(/this\.atmosphere\?\.dispose\(\);this\.atmosphere=null;/g)||[]).length===3;
  const names=['fx_lighthouse_beam','fx_lighthouse_glow','fx_lighthouse_seaglint','fx_chimney_smoke','fx_chimney_smoke_puff_','fx_moon','fx_moon_halo','fx_moonlight_band_'].every(n=>fx.includes("'"+n+"'"));
  check('wiring-and-names',wired&&names&&/replacedFx\(r\)\)r\.enabled=false/.test(wfc),{});
  const files=['render/IslandAtmosphereFxCore.ts','render/IslandAtmosphereFx.ts','render/IslandAtmosphereFxCore.ts.meta','render/IslandAtmosphereFx.ts.meta'];
  const bytes=files.reduce((s,f)=>s+fs.statSync(path.join(scripts,f)).size,0);
  // Shipped cost = the ES5 modules after terser (Cocos minifies bundles); the moon commit is measured against BYTE_BASE (git rev, default 29690bb).
  let terser=null;for(const p of [process.env.TERSER_MODULE,'/tmp/terser/node_modules/terser',path.join(root,'tools/vendor-node/node_modules/terser'),'terser'])try{if(p){terser=require(p);break;}}catch(e){}
  const mini=async src=>{const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES5}}).outputText;return terser?(await terser.minify(js,{compress:{passes:2},mangle:true})).code.length:js.length;};
  // Bases: 29690bb (before the moon, budget 10 KB for moon + glitter) and e903139 (moon v1 strip; glitter delta reported).
  const code=['render/IslandAtmosphereFxCore.ts','render/IslandAtmosphereFx.ts'];let now=0;for(const f of code)now+=await mini(fs.readFileSync(path.join(scripts,f),'utf8'));
  const sizeAt=async rev=>{let n=0;try{for(const f of code)n+=await mini(require('child_process').execFileSync('git',['show',rev+':creator-build-project/assets/scripts/'+f],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}));return n;}catch(e){return null;}};
  const baseRev=process.env.BYTE_BASE||'29690bb',base=await sizeAt(baseRev),v1=await sizeAt('e903139'),baseOk=base!==null;
  const glitterVerts=Array.from({length:X.band.layers},(_,k)=>F.bandGeometry(k).positions.length/3).reduce((a,b)=>a+b,0);
  check('byte-budget',(baseOk?now-base<=10*1024:true)&&now<=24*1024,{minifiedJsBytes:now,minifier:terser?'terser':'none (raw ES5)',baseRev:baseOk?baseRev:'unavailable',addedSinceBaseBytes:baseOk?now-base:null,addedSinceMoonV1_e903139:v1===null?null:now-v1,budgetAddedBytes:10240,drawCallsMoon:2+X.band.layers,glitterVertices:glitterVerts,sourceBytes:bytes,textures:0,newAssets:0,runtimeMeshVertices:bg.positions.length/3+gg.positions.length/3+dg.positions.length/3*2+37+glitterVerts+57+49,files});
  const fail=checks.filter(c=>!c.ok).length;if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify({checks},null,1));
  console.log(fail?'FAILED '+fail:'ALL PASS island-fx ('+checks.length+' checks)');process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
