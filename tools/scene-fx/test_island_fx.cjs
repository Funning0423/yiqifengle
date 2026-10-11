'use strict';
/** Scene FX test: chimney smoke + lighthouse beam/glow/sea glint (render/IslandAtmosphereFxCore.ts). CPU only.
 * 1 maths (basis quaternions), 2 anchors vs the real GLB (lamp pivot, chimney mouth), 3 beam/glint/disc geometry profiles,
 * 4 day/night (day = no light, night smoke not white), 5 flash from the LIVE camera, 6 near-camera fades over the whole
 * home->island->home flow (flow_sim, this tree; optional CAMERA_TREE=<other worktree> to replay another camera branch),
 * 7 tap safety (lighthouseTargets unchanged, no colliders), 8 wiring + byte cost.
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
  // 7 taps
  const wfc=fs.readFileSync(path.join(scripts,'world-r1/WorldFlowComponent.ts'),'utf8'),fx=fs.readFileSync(path.join(scripts,'render/IslandAtmosphereFx.ts'),'utf8');
  check('taps-unchanged',wfc.includes("for(const name of ['env_lighthouse_ext','env_lighthouse_door','env_interior_shell'])")&&!/Collider|UITransform|EventType|\.on\(/.test(fx)&&!/fx_lighthouse|fx_chimney|atmosphere/.test(wfc.slice(wfc.indexOf('private hitLighthouse'),wfc.indexOf('private roomView'))),{lighthouseTargets:['env_lighthouse_ext','env_lighthouse_door','env_interior_shell']});
  // 8 wiring + bytes
  const wired=['new IslandAtmosphereFx(director.getScene()!)','this.atmosphere?.setView(this.exteriorVisible,','this.atmosphere?.advance(dt,this.worldCamera?.node??null,this.getWindStrength())'].every(s=>wfc.includes(s))&&(wfc.match(/this\.atmosphere\?\.dispose\(\);this\.atmosphere=null;/g)||[]).length===3;
  const names=['fx_lighthouse_beam','fx_lighthouse_glow','fx_lighthouse_seaglint','fx_chimney_smoke','fx_chimney_smoke_puff_'].every(n=>fx.includes("'"+n+"'"));
  check('wiring-and-names',wired&&names&&/replacedFx\(r\)\)r\.enabled=false/.test(wfc),{});
  const files=['render/IslandAtmosphereFxCore.ts','render/IslandAtmosphereFx.ts','render/IslandAtmosphereFxCore.ts.meta','render/IslandAtmosphereFx.ts.meta'];
  const bytes=files.reduce((s,f)=>s+fs.statSync(path.join(scripts,f)).size,0);
  check('byte-budget',bytes<=30*1024,{sourceBytes:bytes,textures:0,newAssets:0,runtimeMeshVertices:bg.positions.length/3+gg.positions.length/3+dg.positions.length/3*2+37,files});
  const fail=checks.filter(c=>!c.ok).length;if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify({checks},null,1));
  console.log(fail?'FAILED '+fail:'ALL PASS island-fx ('+checks.length+' checks)');process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
