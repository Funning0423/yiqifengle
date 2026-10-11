'use strict';
/** Camera-track FX check (CPU, repeatable): replays 运镜bot's per-frame camera export (previews/运镜bot/camera-track.json,
 * or CAMERA_TRACK=...) through the REAL IslandAtmosphereFxCore at night (worst case; day light = 0) and reports per phase
 * (outbound / islandIdle / return, plus a 20 s fixed island-idle run = one full beam revolution):
 *  - frames with the camera inside the beam cone (incl. outer mist) / inside a smoke puff volume
 *  - screen brightness after the near-camera fades: a 18x38 ray grid per frame integrates the additive light
 *    (beam core+mist profile, glow disc, sea glint, moon disc + halo, moonlight band; luminance of their colours x alpha) and the smoke coverage
 *    (alpha-blend opacity). Reported: max frame-to-frame jump of the screen mean and of any single ray.
 * Moon/glitter path: the real glitter meshes (bandGeometry per layer, barycentric alpha) with the per-layer twinkle; camera distance to the moon and to the band's near end, and their per-frame alpha steps, are reported too.
 * The beam phase in game is arbitrary (FX clock), so every frame is evaluated for 8 beam phases.
 * Analytic profiles = the mesh vertex-alpha formulas (no mist hash, no Cocos rasterisation). Not a render.
 * Usage: node tools/scene-fx/test_camera_track_fx.cjs [--json out.json] */
const fs=require('fs'),path=require('path'),os=require('os');
const root=path.resolve(__dirname,'..','..'),ts=require('../qf-env.cjs').typescript();
const args=process.argv.slice(2),jsonOut=args.includes('--json')?args[args.indexOf('--json')+1]:null;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fxtrack-'));
fs.writeFileSync(path.join(tmp,'c.js'),ts.transpileModule(fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/render/IslandAtmosphereFxCore.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
const F=require(path.join(tmp,'c.js')),X=F.ISLAND_FX;
const trackFile=process.env.CAMERA_TRACK||path.resolve(root,'../../previews/运镜bot/camera-track.json');
if(!fs.existsSync(trackFile)){console.log('SKIP: camera track not found '+trackFile);process.exit(0);}
const T=JSON.parse(fs.readFileSync(trackFile,'utf8'));
const qrot=(q,v)=>{const [x,y,z,w]=q,ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.sqrt(dot(a,a));
const lum=c=>(.2126*c[0]+.7152*c[1]+.0722*c[2])/255;
const GX=18,GY=38,aspect=T.aspect||586/1266,PH=8;
// Moonlight glitter = the real bandGeometry(k) meshes (5 verts / 4 tris per sparkle, alpha at the centre vertex), bucketed by
// local z; a ray's sea hit is interpolated barycentrically inside any sparkle triangle it falls in, times that layer's alpha.
const GLIT=[];for(let k=0;k<X.band.layers;k++){const g=F.bandGeometry(k),P=g.positions,C=g.colors,I=g.indices,tris=[];
  for(let i=0;i<I.length;i+=3){const v=[I[i],I[i+1],I[i+2]].map(j=>[P[j*3],P[j*3+2],C[j*4+3]]);tris.push({v,z0:Math.min(v[0][1],v[1][1],v[2][1]),z1:Math.max(v[0][1],v[1][1],v[2][1])});}
  const B={};for(const t of tris)for(let b=Math.floor(t.z0);b<=Math.floor(t.z1);b++)(B[b]=B[b]||[]).push(t);GLIT.push(B);}
function glitterAt(k,x,z){const L=GLIT[k][Math.floor(z)];if(!L)return 0;let s=0;for(const t of L){const [a,b,c]=t.v,d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)continue;
  const w0=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(z-c[1]))/d,w1=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(z-c[1]))/d,w2=1-w0-w1;if(w0>=0&&w1>=0&&w2>=0)s+=w0*a[2]+w1*b[2]+w2*c[2];}return s;}
function hitPlane(o,d,p,n){const den=dot(d,n);if(Math.abs(den)<1e-6)return null;const t=dot(sub(p,o),n)/den;return t>0.05?t:null;}
function screen(cam,q,fov,t){
  const b=F.beamState(t,cam,1),puffs=F.smokePuffs(t,1,1,1,cam),L=X.lamp,tanY=Math.tan(fov*Math.PI/360),tanX=tanY*aspect;
  const side=qrot(b.rotation,[1,0,0]),nrm=qrot(b.rotation,[0,1,0]),ax=b.dir,gn=qrot(b.glowRotation,[0,0,1]),gx=qrot(b.glowRotation,[1,0,0]),gy=qrot(b.glowRotation,[0,1,0]);
  const h=qrot(b.glintRotation,[0,0,1]),hx=qrot(b.glintRotation,[1,0,0]),G=X.glint,glintO=[L[0],X.seaY,L[2]];
  const m=F.moonState(t,cam,1),M=X.moon,B=X.band,mn=sub(cam,M.pos),mnl=len(mn),mN=[mn[0]/mnl,mn[1]/mnl,mn[2]/mnl],mx=qrot(m.moonRotation,[1,0,0]),my=qrot(m.moonRotation,[0,1,0]);
  const bz=qrot(m.bandRotation,[0,0,1]),bx=qrot(m.bandRotation,[1,0,0]),bO=m.bandPos,bS=m.bandScale;
  const light=new Float32Array(GX*GY),smoke=new Float32Array(GX*GY);
  for(let j=0;j<GY;j++)for(let i=0;i<GX;i++){const sx=((i+.5)/GX*2-1)*tanX,sy=((j+.5)/GY*2-1)*tanY,d0=qrot(q,[sx,sy,-1]),l0=len(d0),d=[d0[0]/l0,d0[1]/l0,d0[2]/l0];let add=0,cov=0;
    if(b.alpha>0){const tt=hitPlane(cam,d,L,nrm);if(tt!==null){const p=sub([cam[0]+d[0]*tt,cam[1]+d[1]*tt,cam[2]+d[2]*tt],L),u=dot(p,ax)/X.beam.lengthM,x=dot(p,side);
      if(u>=0&&u<=1){const r=F.beamRadius(u),al=F.beamAlongAlpha(u),v=x/r,vm=x/(1.9*r);add+=b.alpha*al*((Math.abs(v)<1.6?Math.exp(-2.2*v*v):0)+.32*(Math.abs(vm)<1.6?Math.exp(-2.2*vm*vm):0))*lum(X.beam.color);}}}
    if(b.glowAlpha>0){const tt=hitPlane(cam,d,b.glowPos,gn);if(tt!==null){const p=sub([cam[0]+d[0]*tt,cam[1]+d[1]*tt,cam[2]+d[2]*tt],b.glowPos),rr=Math.hypot(dot(p,gx),dot(p,gy))/b.glowScale;
      const pr=rr<.32?1-(1-.55)*rr/.32:rr<1?.55*(1-(rr-.32)/.68):0;add+=b.glowAlpha*pr*lum(X.glow.color);}}
    if(b.glintAlpha>0){const tt=hitPlane(cam,d,glintO,[0,1,0]);if(tt!==null){const p=sub([cam[0]+d[0]*tt,cam[1]+d[1]*tt,cam[2]+d[2]*tt],glintO),z=dot(p,h),x=dot(p,hx),u=(z-G.startM)/(G.endM-G.startM);
      if(u>=0&&u<=1){const w=G.w0+(G.w1-G.w0)*u,v=x/w;add+=b.glintAlpha*F.smoothstep(0,.15,u)*Math.pow(1-u,1.3)*.71*(Math.abs(v)<1?Math.exp(-2.4*v*v):0)*lum(X.glint.color);}}}
    if(m.moonAlpha>0||m.haloAlpha>0){const tt=hitPlane(cam,d,M.pos,mN);if(tt!==null){const p=sub([cam[0]+d[0]*tt,cam[1]+d[1]*tt,cam[2]+d[2]*tt],M.pos),rm=Math.hypot(dot(p,mx),dot(p,my));
      const r1=rm/M.radiusM,r2=rm/M.haloRadiusM;add+=m.moonAlpha*(r1<.9?1:r1<1?(1-r1)/.1:0)*lum(M.color)+m.haloAlpha*(r2<.2?1-.5*r2/.2:r2<1?.5*(1-(r2-.2)/.8):0)*lum(M.haloColor);}}
    if(m.bandAlpha>0&&bS>0){const tt=hitPlane(cam,d,bO,[0,1,0]);if(tt!==null){const p=sub([cam[0]+d[0]*tt,cam[1]+d[1]*tt,cam[2]+d[2]*tt],bO),z=dot(p,bz)/bS,x=dot(p,bx)/bS;
      if(z>=X.band.startM*.5&&z<=X.band.endM*1.05)for(let k=0;k<GLIT.length;k++)if(m.bandLayerAlpha[k]>0)add+=m.bandLayerAlpha[k]*glitterAt(k,x,z)*lum(X.band.color);}}
    for(const pf of puffs){if(pf.alpha<=0)continue;const n=sub(cam,pf.position),nl=len(n),nn=[n[0]/nl,n[1]/nl,n[2]/nl],tt=hitPlane(cam,d,pf.position,nn);if(tt===null)continue;
      const p=sub([cam[0]+d[0]*tt,cam[1]+d[1]*tt,cam[2]+d[2]*tt],pf.position),rr=len(p)/pf.scale[0];const pr=rr<.5?1-.2*rr/.5:rr<1?.8*(1-(rr-.5)/.5):0;cov=1-(1-cov)*(1-pf.alpha*pr);}
    light[j*GX+i]=add;smoke[j*GX+i]=cov;}
  const near=F.beamCameraFade(b.dir,cam),inSmoke=puffs.some(pf=>len(sub(cam,pf.position))<pf.scale[0]);
  return {light,smoke,inCone:near.inside,inSmoke,beamAlpha:b.alpha,glowAlpha:b.glowAlpha,glintAlpha:b.glintAlpha,moonAlpha:m.moonAlpha,bandAlpha:Math.max(...m.bandLayerAlpha),moonCamM:m.moonCamM,bandNearM:m.bandNearM,puffFade:puffs.map(pf=>pf.cameraFade)};
}
function run(label,frames){const res={label,frames:frames.length,beamPhases:PH,framesInsideCone:0,samplesInsideCone:0,framesInsideSmoke:0,maxMeanLightJump:0,maxRayLightJump:0,maxMeanSmokeJump:0,maxRaySmokeJump:0,maxMeanLight:0,maxBeamAlphaInsideCone:0,maxBeamAlphaStep:0,maxGlowAlphaStep:0,maxGlintAlphaStep:0,maxPuffFadeStep:0,maxMoonAlphaStep:0,maxBandAlphaStep:0,minMoonCamM:1e9,minBandNearM:1e9,worstAt:null};
  for(let k=0;k<PH;k++){let prev=null;const insideFrames=new Set();
    for(let f=0;f<frames.length;f++){const fr=frames[f],s=screen(fr.position,fr.rotation,fr.fovVerticalDeg,fr.t+k*X.beam.periodS/PH);
      if(s.inCone){res.samplesInsideCone++;insideFrames.add(f);res.maxBeamAlphaInsideCone=Math.max(res.maxBeamAlphaInsideCone,s.beamAlpha);}if(s.inSmoke&&k===0)res.framesInsideSmoke++;
      res.minMoonCamM=Math.min(res.minMoonCamM,s.moonCamM);if(s.bandAlpha>0)res.minBandNearM=Math.min(res.minBandNearM,s.bandNearM);
      let ml=0,ms=0;for(let i=0;i<s.light.length;i++){ml+=s.light[i];ms+=s.smoke[i];}ml/=s.light.length;ms/=s.smoke.length;res.maxMeanLight=Math.max(res.maxMeanLight,ml);
      if(prev&&fr.t-prev.t<.05){const jl=Math.abs(ml-prev.ml),js=Math.abs(ms-prev.ms);let rl=0,rs=0;for(let i=0;i<s.light.length;i++){rl=Math.max(rl,Math.abs(s.light[i]-prev.s.light[i]));rs=Math.max(rs,Math.abs(s.smoke[i]-prev.s.smoke[i]));}
        if(jl>res.maxMeanLightJump){res.maxMeanLightJump=jl;res.worstAt={t:+fr.t.toFixed(3),phase:fr.phase,beamPhase:k};}res.maxRayLightJump=Math.max(res.maxRayLightJump,rl);res.maxMeanSmokeJump=Math.max(res.maxMeanSmokeJump,js);res.maxRaySmokeJump=Math.max(res.maxRaySmokeJump,rs);
        res.maxBeamAlphaStep=Math.max(res.maxBeamAlphaStep,Math.abs(s.beamAlpha-prev.s.beamAlpha));res.maxGlowAlphaStep=Math.max(res.maxGlowAlphaStep,Math.abs(s.glowAlpha-prev.s.glowAlpha));res.maxGlintAlphaStep=Math.max(res.maxGlintAlphaStep,Math.abs(s.glintAlpha-prev.s.glintAlpha));res.maxMoonAlphaStep=Math.max(res.maxMoonAlphaStep,Math.abs(s.moonAlpha-prev.s.moonAlpha));res.maxBandAlphaStep=Math.max(res.maxBandAlphaStep,Math.abs(s.bandAlpha-prev.s.bandAlpha));for(let i=0;i<s.puffFade.length;i++)res.maxPuffFadeStep=Math.max(res.maxPuffFadeStep,Math.abs(s.puffFade[i]-prev.s.puffFade[i]));}
      prev={t:fr.t,ml,ms,s};}
    res.framesInsideCone=Math.max(res.framesInsideCone,insideFrames.size);}
  for(const k of Object.keys(res))if(typeof res[k]==='number')res[k]=+res[k].toFixed(4);return res;}
const byPhase={};for(const fr of T.frames)(byPhase[fr.phase]=byPhase[fr.phase]||[]).push(fr);
const idle=T.islandIdlePose,idleRun=[];for(let i=0;i<X.beam.periodS*60;i++)idleRun.push({t:i/60,phase:'islandIdle-20s',position:idle.position,rotation:idle.rotation,fovVerticalDeg:idle.fovVerticalDeg});
const out=[];for(const [k,v] of Object.entries(byPhase))out.push(run(k,v));out.push(run('islandIdle-fixed-20s',idleRun));
// Limits: no beam light while the camera is inside the cone; per-frame screen-mean jump < 0.01 (1% of white); smoke coverage
// mean jump < 0.02; moon >= 100 m and the band's near end >= 10 m from the lens; the fades themselves (material alpha factors) move < 0.03 per 60 fps frame (beam peak alpha 0.34..0.54).
// Per-ray jumps are reported only: with a moving camera, edges sweeping across pixels are motion, not a fade pop; with the
// fixed idle camera they must stay < 0.08 per frame (the flash rises over ~0.3 s).
let fail=0;for(const r of out){const fixed=r.label.indexOf('fixed')>=0;const ok=r.maxBeamAlphaInsideCone===0&&r.maxMeanLightJump<.01&&r.maxMeanSmokeJump<.02&&r.maxBeamAlphaStep<.03&&r.maxGlowAlphaStep<.03&&r.maxGlintAlphaStep<.03&&r.maxMoonAlphaStep<.03&&r.maxBandAlphaStep<.03&&r.minMoonCamM>=100&&r.minBandNearM>=10&&(!fixed||r.maxRayLightJump<.08);if(!ok)fail++;console.log((ok?'PASS ':'FAIL ')+r.label.padEnd(22)+' '+JSON.stringify(r));}
if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify({track:path.relative(path.resolve(root,'../..'),trackFile),results:out},null,1));
console.log(fail?'FAILED '+fail:'ALL PASS camera-track-fx ('+out.length+' runs)');process.exitCode=fail?1:0;
