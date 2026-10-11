'use strict';
/** Island gulls test (render/GullFlockCore.ts + GullFlock.ts), CPU only, repeatable.
 * 1 perches sit on real GLB geometry (roof ridge, fence posts), none on the lighthouse / signpost
 * 2 fixed island camera (camera-track islandIdlePose), 180 s day + 180 s night, AmbienceAudio stub with random calls:
 *   gulls in frame per frame (day ~2-4, night fewer), flight kinds (pass / glide / land / perch / takeoff / near), route variety,
 *   per-frame static clearance (lighthouse, house, trees, ground, signpost >= 2 m incl. the sea glide), camera >= 1.0 m
 * 3 camera-track replay (outbound / islandIdle / return, previews/运镜bot/camera-track.json or CAMERA_TRACK=...): camera >= 1.0 m
 *   every frame (closest approach before the hard push-out reported separately), heroine clearance
 * 4 near calls -> gull in frame: outbound near call at apron lift + 0.4 s (leadS 0.4 and 1.7, apron time jittered, Voice bot's
 *   near-yaw rule = camera yaw +-60 deg / turning side) and island near calls (leadS 2.5 and 0); in frame >= 0.25 s within
 *   2.5 s after 'start', camera >= 1.0 m. Also all yaw offsets 0..330 relative to the camera (incl. behind).
 * 5 contract: cancelled -> booking released; no interface -> own random flights; request-only (lead 0) still enters
 * 6 cc wrapper with a mocked cc: interface probe (absent -> later present -> rebuilt), node names fx_gull_N, no colliders,
 *   not in lighthouseTargets, original gull renderers replaced in WorldFlowComponent
 * 7 wings (Mac r4 black slivers): two-sided cambered fx wing (top shell faces up, underside faces down, underside white-grey,
 *   visible depth when seen edge-on, edge-on guard tilts near flying gulls toward the lens), unlit tint day 1 / night darker+cool, wrapper uses builtin-unlit wings; far gulls drawn larger
 * 8 bytes: ES5 module build + terser (Cocos bundles modules), new assets 0
 * Usage: node tools/scene-fx/test_gulls.cjs [--json out.json] */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const S=require('./gull_sim.cjs'),{C}=S.load(),G=C.GULL_FX,root=S.root,scripts=path.join(root,'creator-build-project/assets/scripts');
const args=process.argv.slice(2),jsonOut=args.includes('--json')?args[args.indexOf('--json')+1]:null;
const trackFile=process.env.CAMERA_TRACK||path.resolve(root,'../../previews/运镜bot/camera-track.json');
const checks=[],check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name.padEnd(34)+' '+JSON.stringify(detail));};
const d3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
(async()=>{
  // 1 perches on geometry
  let geo=null;try{geo=await require('../camera-frame-test/glb_geometry.cjs').decode();}catch(e){}
  if(geo){const pts=[];for(const k in geo.meshes){if(/sky|cloud|sea|col_|beam|gull|smoke/.test(k))continue;for(const p of geo.meshes[k].flat())pts.push(p);}
    const res=G.perches.map(P=>{let top=-9;for(const p of pts)if(Math.hypot(p[0]-P.p[0],p[2]-P.p[2])<.14)top=Math.max(top,p[1]);return {id:P.id,gap:+(P.p[1]-.09-top).toFixed(3)};});
    const sign=G.sign.base,lh=G.lighthouse;
    check('perches-on-geometry',res.every(r=>Math.abs(r.gap)<.12)&&G.perches.every(P=>Math.hypot(P.p[0]-lh.c[0],P.p[2]-lh.c[1])>lh.r&&Math.hypot(P.p[0]-sign[0],P.p[2]-sign[2])>4),{perches:res});
  } else check('perches-on-geometry',false,{error:'glb decode failed (DRACO3D?)'});
  if(!fs.existsSync(trackFile)){console.log('SKIP camera track not found '+trackFile);}
  const T=JSON.parse(fs.readFileSync(trackFile,'utf8')),trackSha=crypto.createHash('sha256').update(fs.readFileSync(trackFile)).digest('hex');
  console.log('camera track',path.relative(path.resolve(root,'../..'),trackFile),'sha256',trackSha);
  const nearestPerch=q=>{let b=null,bd=1e9;for(const P of G.perches){const d=d3(P.p,q);if(d<bd){bd=d;b=P.p;}}return b;};
  const staticBad=(p)=>{if(p.mode==='perch'||!p.visible)return null;const k=p.mode==='glide'?'glide':'near';return C.pointClear(p.pos,k,p.mode==='land'||p.mode==='takeoff'?nearestPerch(p.pos):null,null);};
  const signDist=q=>{const b=G.sign.base,t=Math.max(b[1],Math.min(G.sign.topY,q[1]));return d3(q,[b[0],t,b[2]]);};
  // 2 fixed island camera
  const idle=S.camOf(T.islandIdlePose,T.aspect),fixed={};
  for(const night of [0,1]){const fl=new C.GullFlock(11+night);fl.setView(true);const routes=[];const sl=fl.startLegs.bind(fl);fl.startLegs=(g,legs,perch)=>{routes.push(legs[0].a);sl(g,legs,perch);};const rnd=C.rng(5+night),A=S.ambience(rnd);A.onGullCall(e=>fl.onCall(e,A.gameTime()));
    let next=4;const hist=[0,0,0,0,0,0,0],kinds={},starts=[],bad={},near=[];let minCam=1e9,signMin=1e9,glideSign=1e9,frames=0;
    for(let f=0;f<60*180;f++){const c=Object.assign({},idle);delete c.vel;A.tick(1/60,c);
      if(A.gameTime()>next){const nr=rnd()<.35;A.schedule('random',nr?'near':'far',rnd()<.2?0:2.5);next+=night?(14+rnd()*14):(6+rnd()*9);}
      const P=fl.advance(1/60,c,night,T.frames[T.frames.length-1].root?null:null);frames++;let n=0;
      for(let i=0;i<P.length;i++){const p=P[i];if(!p.visible)continue;if(C.project(c,p.pos).inFrame)n++;kinds[p.mode]=(kinds[p.mode]||0)+1;minCam=Math.min(minCam,d3(p.pos,c.pos));
        const sd=signDist(p.pos);signMin=Math.min(signMin,sd);if(p.mode==='glide')glideSign=Math.min(glideSign,sd);
        const why=staticBad(p);if(why){bad[why]=(bad[why]||0)+1;if(process.env.GULL_DEBUG)console.log('DBG',why,p.mode,p.pos.map(v=>v.toFixed(2)).join(','),fl.gulls[i].legs.length);}}
      hist[n]++;}starts.push(...routes);
    const pct=k=>+(100*k/frames).toFixed(1),inRange=pct(hist[2]+hist[3]+hist[4]),uniq=new Set(starts.filter(p=>!G.perches.some(P=>d3(P.p,p)<.5)).map(p=>p.map(v=>Math.round(v)).join(','))).size;
    fixed[night?'night':'day']={inFramePct:hist.map(pct),pct2to4:inRange,kinds,minCamM:+minCam.toFixed(2),signpostMinM:+signMin.toFixed(2),glideSignpostMinM:+glideSign.toFixed(2),staticViolations:bad,routes:starts.length,routesNotFromPerch:starts.filter(p=>!G.perches.some(P=>d3(P.p,p)<.5)).length,distinctStarts:uniq,nearLog:fl.nearLog.filter(x=>x).length};
  }
  const D=fixed.day,N=fixed.night,starts0=x=>x.routesNotFromPerch;
  check('fixed-day-count',D.pct2to4>=70&&D.inFramePct[0]<8,{inFramePct_0to6:D.inFramePct,pct2to4:D.pct2to4});
  check('fixed-night-fewer',N.inFramePct[0]+N.inFramePct[1]+N.inFramePct[2]>=90&&(N.kinds.perch||0)>(N.kinds.fly||0),{inFramePct:N.inFramePct,kinds:N.kinds});
  check('fixed-kinds-variety',['fly','glide','land','perch','takeoff'].every(k=>(D.kinds[k]||0)>0)&&D.distinctStarts>=starts0(D)*.85,{kinds:D.kinds,routes:D.routes,distinctStarts:D.distinctStarts});
  check('fixed-clearance',D.minCamM>=1&&N.minCamM>=1&&!Object.keys(D.staticViolations).length&&!Object.keys(N.staticViolations).length&&Math.min(D.signpostMinM,N.signpostMinM)>=G.sign.clearM+G.sign.postR,
    {minCamM:[D.minCamM,N.minCamM],signpostMinM:[D.signpostMinM,N.signpostMinM],glideSignpostMinM:D.glideSignpostMinM,violations:[D.staticViolations,N.staticViolations]});
  // 3+4 camera track
  const phases={};for(const fr of T.frames)(phases[fr.phase]=phases[fr.phase]||[]).push(fr);
  function replay(frames,seed,opt){const fl=new C.GullFlock(seed);fl.setView(true);const rnd=C.rng(seed*7+1),A=S.ambience(rnd);A.onGullCall(e=>fl.onCall(e,A.gameTime()));
    let call=null,booked=false,inF=0,minCall=1e9,minCam=1e9,minHero=1e9,bad={};
    for(let i=1;i<frames.length;i++){const f=frames[i],dt=f.t-frames[i-1].t;if(dt<=0)continue;const c=S.camOf(f,T.aspect);A.tick(dt,c);
      if(opt&&!booked&&f.t>=opt.at){booked=true;const y=opt.offset===undefined?undefined:(S.camYaw(c)+opt.offset+360)%360;call=A.schedule(opt.kind||'near','near',opt.lead,y);}
      const P=fl.advance(dt,c,opt&&opt.night||0,f.root);
      for(let k=0;k<P.length;k++){const p=P[k];if(!p.visible)continue;minCam=Math.min(minCam,d3(p.pos,c.pos));const h=f.root;if(h){const dy=Math.max(0,Math.min(p.pos[1]-h[1],1.7));minHero=Math.min(minHero,d3(p.pos,[h[0],h[1]+dy,h[2]]));}
        const why=staticBad(p);if(why){bad[why]=(bad[why]||0)+1;if(process.env.GULL_DEBUG)console.log('DBG',why,p.mode,p.pos.map(v=>v.toFixed(2)).join(','),f.t);}}
      if(call&&call.startAt!==undefined&&A.gameTime()<=call.startAt+2.5){const L=fl.nearLog.find(x=>x.id===call.id);if(L&&L.gull>=0){const p=P[L.gull];if(p.visible){minCall=Math.min(minCall,d3(p.pos,c.pos));if(C.project(c,p.pos).inFrame)inF+=dt;}}}}
    const L=call&&fl.nearLog.find(x=>x.id===call.id);
    return {seen:inF>=.25,inFrameS:+inF.toFixed(2),planned:!!(L&&L.ok),behind:!!(L&&L.behind),minCallCamM:+minCall.toFixed(2),minCamM:+minCam.toFixed(2),preClampMinM:+fl.stats.minCamM.toFixed(2),pushes:fl.stats.pushes,minHeroM:+minHero.toFixed(2),bad};}
  const trackRes={};for(const [ph,frames] of Object.entries(phases)){const r=[];for(let s=1;s<=20;s++)r.push(replay(frames,s,null));
    trackRes[ph]={frames:frames.length,runs:r.length,minCamM:Math.min(...r.map(x=>x.minCamM)),preClampMinM:Math.min(...r.map(x=>x.preClampMinM)),pushFrames:r.reduce((a,x)=>a+x.pushes,0),minHeroM:Math.min(...r.map(x=>x.minHeroM)),violations:r.reduce((a,x)=>{for(const k in x.bad)a[k]=(a[k]||0)+x.bad[k];return a;},{})};}
  check('track-camera-clearance',Object.values(trackRes).every(r=>r.minCamM>=1&&!Object.keys(r.violations).length),trackRes);
  // outbound near call: apron lift ~14.82 s (+-0.6), start = apron + 0.4 s; leadS 0.4 (Voice bot plan) and 1.7 (fbee3d5 gap-pushed)
  const out=phases.outbound,runs=[];for(let s=1;s<=40;s++)for(const lead of [.4,1.7])runs.push(replay(out,s,{at:14.82+((s%5)-2)*.3+(lead<1?.4-lead:0),lead}));
  const outSeen=runs.filter(r=>r.seen).length,outMin=Math.min(...runs.map(r=>r.minCallCamM));
  const crane=[];for(let s=1;s<=20;s++)crane.push(replay(out,s,{at:15.567,lead:1.5,kind:'crane'}));
  const allYaw=[];for(let o=0;o<360;o+=30)for(let s=1;s<=3;s++)allYaw.push(Object.assign({offset:o},replay(out,s,{at:14.82,lead:.4,offset:o})));
  const idleFrames=[];for(let i=0;i<60*14;i++)idleFrames.push(Object.assign({},T.islandIdlePose,{t:21.65+i/60,root:T.frames.find(f=>f.phase==='islandIdle').root}));
  const isl=[];for(let s=1;s<=30;s++)for(const lead of [2.5,0])isl.push(replay(idleFrames,s,{at:21.65+4+(s%7),lead}));
  const islYaw=[];for(let o=0;o<360;o+=30)for(let s=1;s<=3;s++)islYaw.push(Object.assign({offset:o},replay(idleFrames,s,{at:26,lead:2.5,offset:o})));
  const pc=(a)=>+(100*a.filter(r=>r.seen).length/a.length).toFixed(1);
  const nearSummary={outboundApron:{runs:runs.length,inFramePct:pc(runs),leadS:[.4,1.7],minCamM:outMin,preClampMinM:Math.min(...runs.map(r=>r.preClampMinM)),pushFrames:runs.reduce((a,r)=>a+r.pushes,0),meanInFrameS:+(runs.reduce((a,r)=>a+r.inFrameS,0)/runs.length).toFixed(2)},
    outboundCrane:{runs:crane.length,inFramePct:pc(crane),minCamM:Math.min(...crane.map(r=>r.minCallCamM))},
    outboundAllYaw:{runs:allYaw.length,inFramePct:pc(allYaw),behindPlanned:allYaw.filter(r=>r.behind).length,missedOffsets:[...new Set(allYaw.filter(r=>!r.seen).map(r=>r.offset))]},
    island:{runs:isl.length,inFramePct:pc(isl),minCamM:Math.min(...isl.map(r=>r.minCallCamM))},
    islandAllYaw:{runs:islYaw.length,inFramePct:pc(islYaw),behindPlanned:islYaw.filter(r=>r.behind).length,missedOffsets:[...new Set(islYaw.filter(r=>!r.seen).map(r=>r.offset))]}};
  check('near-call-in-frame',nearSummary.outboundApron.inFramePct>=85&&nearSummary.island.inFramePct>=90&&outMin>=1&&nearSummary.island.minCamM>=1,nearSummary);
  // 5 contract edge cases
  { const fl=new C.GullFlock(3);fl.setView(true);const A=S.ambience(C.rng(9));A.onGullCall(e=>fl.onCall(e,A.gameTime()));const c0=Object.assign({},idle);
    for(let i=0;i<30;i++){A.tick(1/60,c0);fl.advance(1/60,Object.assign({},idle),0,null);}
    const c=A.schedule('random','near',2.5,200);const booked=fl.gulls.filter(g=>g.call===c.id).length;fl.onCall({id:c.id,phase:'cancelled',dist:'near',yawWorldDeg:200,leadS:0});
    const released=fl.gulls.every(g=>g.call!==c.id);
    const fl2=new C.GullFlock(4);fl2.setView(true);let seen=0;for(let i=0;i<60*40;i++){const P=fl2.advance(1/60,Object.assign({},idle),0,null);if(P.some(p=>p.visible&&C.project(idle,p.pos).inFrame))seen++;}
    let thrown=null;try{fl2.onCall(null);fl2.onCall({phase:'start',dist:'near',yawWorldDeg:NaN});fl2.onCall({phase:'weird',dist:'x',yawWorldDeg:10});}catch(e){thrown=String(e);}
    check('contract-cancel-fallback',booked===1&&released&&seen>60*40*.8&&!thrown,{booked,released,noInterfaceFramesWithGullPct:+(100*seen/2400).toFixed(1),thrown});}
  let wrapWings=null;
  // 6 cc wrapper (mocked cc)
  { const ts=require('../qf-env.cjs').typescript(),os=require('os'),Module=require('module');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gullcc-'));
    for(const f of ['IslandAtmosphereFxCore','GullFlockCore','GullFlock'])fs.writeFileSync(path.join(tmp,f+'.js'),ts.transpileModule(fs.readFileSync(path.join(scripts,'render',f+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES5}}).outputText);
    const made=[];class V{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}
    class Node{constructor(n){this.name=n;this.children=[];this.comps=[];this.active=true;this.worldPosition=new V();made.push(this);}addChild(c){this.children.push(c);c.parent=this;}
      addComponent(K){const c=new K();c.node=this;this.comps.push(c);return c;}getComponent(K){return this.comps.find(c=>c instanceof K)||null;}
      getComponentsInChildren(K){const o=[];const w=n=>{for(const c of n.comps)if(c instanceof K)o.push(c);n.children.forEach(w);};w(this);return o;}
      getChildByName(n){return this.children.find(c=>c.name===n)||null;}setPosition(){}setWorldPosition(x,y,z){this.worldPosition=new V(x,y,z);}setWorldRotation(){}setScale(){}setRotation(){}destroy(){this.destroyed=true;}}
    class Color{constructor(r=255,g=255,b=255,a=255){Object.assign(this,{r,g,b,a});}clone(){return new Color(this.r,this.g,this.b,this.a);}}
    const mats=[];class Material{constructor(){mats.push(this);}copy(m){this.src=m;}initialize(o){this.init=o;}getProperty(){return new Color();}setProperty(k,v){this.last=[k,v];}destroy(){}}
    class MeshRenderer{constructor(){this.mesh=null;}setMaterial(m){this.mat=m;}} MeshRenderer.ShadowCastingMode={OFF:0};class Camera{constructor(){this.fov=42;this.camera={aspect:T.aspect};}}
    const meshes=[];const cc={Node,Scene:Node,MeshRenderer,Material,Color,Camera,Mesh:class{},Vec3:V,EffectAsset:{get:n=>n==='builtin-unlit'?{}:null},utils:{createMesh:g=>{const m={g,destroy(){m.gone=true;}};meshes.push(m);return m;}},isValid:o=>!!o&&!o.destroyed};
    const load=f=>{const m=new Module(path.join(tmp,f+'.js'));m.filename=path.join(tmp,f+'.js');m.paths=[];const o=m.require.bind(m);m.require=id=>id==='cc'?cc:id.startsWith('./')?load(id.slice(2)):o(id);m._compile(fs.readFileSync(m.filename,'utf8'),m.filename);return m.exports;};
    const W=load('GullFlock');const scene=new Node('scene'),model=new Node('model');scene.addChild(model);
    for(const n of ['env_anim_seagull_fly_01_v22','env_anim_seagull_fly_01_v22_wing_L','env_anim_seagull_fly_01_v22_wing_R']){const x=new Node(n);model.addChild(x);const r=x.addComponent(MeshRenderer);r.mesh={};r.sharedMaterial=new Material();}
    const hero=new Node('FLOW_REFERENCE_PLACEHOLDER_NOT_B');scene.addChild(hero);hero.worldPosition=new V(-2.1,0,5.3);
    const parent=new Node('IslandAtmosphereFx');scene.addChild(parent);const camNode=new Node('cam');camNode.addComponent(Camera);
    const qc=S.camOf(T.islandIdlePose,T.aspect);camNode.worldPosition=new V(...qc.pos);camNode.forward=new V(...qc.fwd);camNode.up=new V(...qc.up);camNode.right=new V(...qc.right);
    let thrown=null,subs=0,unsubs=0;const w=new W.GullFlock(scene,parent);w.setView(true);
    try{delete globalThis.__worldIntegration;for(let i=0;i<30;i++)w.advance(1/60,camNode,0);
      const cbs=[];globalThis.__worldIntegration={onGullCall:cb=>{subs++;cbs.push(cb);return()=>{unsubs++;};},gullClock:()=>1};for(let i=0;i<30;i++)w.advance(1/60,camNode,0);
      cbs[0]({id:1,phase:'scheduled',dist:'near',yawWorldDeg:180,leadS:.4,at:1.4});
      globalThis.__worldIntegration={onGullCall:cb=>{subs++;cbs.push(cb);return()=>{unsubs++;};}};for(let i=0;i<30;i++)w.advance(1/60,camNode,0);
      cbs[1]({id:1,phase:'start',dist:'near',yawWorldDeg:180,leadS:0,at:1.4});for(let i=0;i<60*20;i++)w.advance(1/60,camNode,1);w.dispose();}catch(e){thrown=String(e&&e.stack||e);}
    delete globalThis.__worldIntegration;
    const names=made.filter(n=>/^fx_gull/.test(n.name)).map(n=>n.name),src=['GullFlock.ts','GullFlockCore.ts'].map(f=>fs.readFileSync(path.join(scripts,'render',f),'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,'')).join('\n');
    const wfc=fs.readFileSync(path.join(scripts,'world-r1/WorldFlowComponent.ts'),'utf8'),hit=wfc.slice(wfc.indexOf('private hitLighthouse'),wfc.indexOf('private roomView'));
    const ok=!thrown&&subs===2&&unsubs===2&&names.includes('fx_gull_0')&&names.includes('fx_gull_'+(G.count-1)+'_wing_R')&&!/Collider|RigidBody|UITransform|Button|EventType|\.on\(/.test(src)&&!/fx_gull|gull/i.test(hit)
      &&wfc.includes("for(const name of ['env_lighthouse_ext','env_lighthouse_door','env_interior_shell'])")&&/env_anim_seagull_fly_0\[12\]_v22/.test(wfc)&&wfc.includes('length!==12');
    const wingR=made.filter(n=>/^fx_gull_\d+_wing_[LR]$/.test(n.name)).map(n=>n.comps[0]),wm=mats.find(m=>m.init&&m.init.effectName==='builtin-unlit');
    wrapWings={wingNodes:wingR.length,unlitWings:wingR.every(r=>r.mat===wm&&meshes.includes(r.mesh)),meshes:meshes.length,disposed:meshes.every(m=>m.gone),nightColor:wm&&wm.last&&[wm.last[1].r,wm.last[1].g,wm.last[1].b]};
    check('cc-wrapper-taps-names',ok,{thrown,subscribes:subs,unsubscribes:unsubs,nodes:names.length,examples:names.slice(0,4),colliders:0,lighthouseTargets:['env_lighthouse_ext','env_lighthouse_door','env_interior_shell']});}
  // 7 wings + far size
  { const lum=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];const sides=[-1,1].map(sd=>{const g=C.wingGeometry(sd),P=g.positions,col=g.colors,I=g.indices,nv=P.length/3,half=nv/2;let up=0,down=0,bad=0,underL=1,topL=1,area=0;
      for(let t=0;t<I.length;t+=3){const [a,b,c]=[I[t],I[t+1],I[t+2]],A=[P[3*a],P[3*a+1],P[3*a+2]],B=[P[3*b],P[3*b+1],P[3*b+2]],Cc=[P[3*c],P[3*c+1],P[3*c+2]];
        const u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],v=[Cc[0]-A[0],Cc[1]-A[1],Cc[2]-A[2]],ny=u[2]*v[0]-u[0]*v[2],top=a<half;if(top&&ny>0)up++;else if(!top&&ny<0)down++;else bad++;area+=Math.abs(ny)/2;}
      for(let i=0;i<nv;i++){const L=lum([col[4*i],col[4*i+1],col[4*i+2]]);if(i<half)topL=Math.min(topL,L);else underL=Math.min(underL,L);}
      let y0=1e9,y1=-1e9,x1=0;for(let i=0;i<nv;i++){y0=Math.min(y0,P[3*i+1]);y1=Math.max(y1,P[3*i+1]);x1=Math.max(x1,P[3*i]*sd);}
      return {tris:I.length/3,upFacingTop:up,downFacingUnder:down,miswound:bad,minUnderLum:+underL.toFixed(2),minTopLum:+topL.toFixed(2),edgeOnDepthM:+(y1-y0).toFixed(3),spanM:+x1.toFixed(2),halfArea:+(area/2).toFixed(3)};});
    const day=C.wingTint(0),night=C.wingTint(1),f=new C.GullFlock(9);f.setView(true);const cam0=S.camOf(T.islandIdlePose,T.aspect);let near=[],far=[];
    for(let i=0;i<60*120;i++){const P=f.advance(1/60,Object.assign({},cam0),0,null);for(let k=0;k<P.length;k++){const p=P[k];if(!p.visible)continue;const d=Math.hypot(p.pos[0]-cam0.pos[0],p.pos[1]-cam0.pos[1],p.pos[2]-cam0.pos[2]),r=p.size/f.gulls[k].size;(d<G.farM[0]?near:d>G.farM[1]?far:[]).push(r);}}
    // edge-on: wing-plane elevation seen from the lens for in-frame gulls within 12 m (outbound near call + island), guard on vs off
    const edge=face=>{const keep=G.faceDeg;G.faceDeg=face;let n=0,thin=0,minE=90;const one=(fl,c,P)=>{for(const p of P){if(!p.visible||p.mode==='perch'||!C.project(c,p.pos).inFrame)continue;const d=[c.pos[0]-p.pos[0],c.pos[1]-p.pos[1],c.pos[2]-p.pos[2]],l=Math.hypot(...d);if(l>12)continue;
        const y=S.qrot(p.rot,[0,1,0]),e=Math.abs(Math.asin(Math.max(-1,Math.min(1,(d[0]*y[0]+d[1]*y[1]+d[2]*y[2])/l))))*180/Math.PI;n++;if(e<4)thin++;minE=Math.min(minE,e);}};
      for(let seed=1;seed<=12;seed++){const fr=T.frames.filter(f=>f.phase==='outbound'),fl=new C.GullFlock(seed);fl.setView(true);const A=S.ambience(C.rng(seed*7+1));A.onGullCall(e=>fl.onCall(e,A.gameTime()));let call=null;
        for(let i=1;i<fr.length;i++){const f=fr[i],dt=f.t-fr[i-1].t,c=S.camOf(f,T.aspect);A.tick(dt,c);if(!call&&f.t>=14.87+.43-.4)call=A.schedule('near','near',.4);one(fl,c,fl.advance(dt,c,0,f.root));}
        const fl2=new C.GullFlock(seed+50);fl2.setView(true);const A2=S.ambience(C.rng(seed));A2.onGullCall(e=>fl2.onCall(e,A2.gameTime()));let nx=2;
        for(let i=0;i<60*60;i++){const c=Object.assign({},cam0);A2.tick(1/60,c);if(i/60>nx){A2.schedule('random','near',2.5);nx+=6;}one(fl2,c,fl2.advance(1/60,c,0,null));}}
      G.faceDeg=keep;return {samples:n,edgeOnPct:+(100*thin/Math.max(1,n)).toFixed(2),minElevDeg:+minE.toFixed(2)};};
    const edgeOff=edge(0),edgeOn=edge(G.faceDeg);
    const mx=a=>a.length?+Math.max(...a).toFixed(3):null,mn=a=>a.length?+Math.min(...a).toFixed(3):null;
    const ok=sides.every(x=>x.miswound===0&&x.upFacingTop===x.downFacingUnder&&x.upFacingTop>=4&&x.minUnderLum>=.75&&x.minTopLum>=.3&&x.edgeOnDepthM>=.02&&x.spanM>=.5)
      &&day.every(v=>v===1)&&night.every(v=>v<.6&&v>.3)&&night[2]>night[0]&&wrapWings&&wrapWings.wingNodes===2*G.count&&wrapWings.unlitWings&&wrapWings.meshes===2&&wrapWings.disposed
      &&mx(near)===1&&mn(far)>=G.farBoost-1e-6&&far.length>0&&edgeOn.samples>200&&edgeOn.edgeOnPct<=Math.max(.5,edgeOff.edgeOnPct*.25);
    check('wings-bright-two-sided',ok,{sides,dayTint:day,nightTint:night.map(v=>+v.toFixed(3)),wrapper:wrapWings,farBoost:{maxNear:mx(near),minFar:mn(far),farSamples:far.length,farM:G.farM},edgeOnBelow4deg:{guardOff:edgeOff,guardOn:edgeOn,faceDeg:G.faceDeg}});}
  // 8 bytes
  { const ts=require('../qf-env.cjs').typescript();let terser=null;for(const p of [process.env.TERSER_MODULE,'/tmp/terser/node_modules/terser',path.join(root,'tools/vendor-node/node_modules/terser'),'terser'])try{if(p){terser=require(p);break;}}catch(e){}
    const sizes={};let total=0;
    for(const f of ['render/GullFlockCore.ts','render/GullFlock.ts']){const js=ts.transpileModule(fs.readFileSync(path.join(scripts,f),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2015,target:ts.ScriptTarget.ES5}}).outputText;
      const n=terser?(await terser.minify(js,{module:true,compress:{passes:2},mangle:true})).code.length:js.length;sizes[f]=n;total+=n;}
    check('bytes',true,{minifiedJs:sizes,totalMinifiedJs:total,minifier:terser?'terser':'none (raw ES5)',newAssets:0,newTextures:0,newMeshAssets:0,runtimeMeshes:'2 wing meshes shared by all gulls',budgetKB:10,withinBudget:total<=10240});}
  const fail=checks.filter(c=>!c.ok).length;if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify({track:{file:path.relative(path.resolve(root,'../..'),trackFile),sha256:trackSha},checks},null,1));
  console.log(fail?'FAILED '+fail:'ALL PASS gulls ('+checks.length+' checks)');process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
