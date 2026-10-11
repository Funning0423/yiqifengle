'use strict';
/** QA preview helper (not shipped): evaluates the REAL IslandAtmosphereFxCore per frame for a fixed camera and a
 * day->night timeline and writes JSON for blender_fx_preview.py. Mirrors IslandAtmosphereFx.advance():
 * moon/halo/band via moonState(t, cam, light); night weight via approachNight (first frame snaps), light = lightFromNight(w), smoke shown = 1 on the exterior.
 * Usage: node dump_fx_frames.cjs <out.json> <camPos x,y,z> <camTarget x,y,z> <fov> <t0> <seconds> <nightAtS> <fps> [wind | windA-windB linear ramp] */
const fs=require('fs'),path=require('path'),os=require('os');
const root=path.resolve(__dirname,'..','..'),ts=require('../qf-env.cjs').typescript();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fxdump-'));
fs.writeFileSync(path.join(tmp,'c.js'),ts.transpileModule(fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/render/IslandAtmosphereFxCore.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
const F=require(path.join(tmp,'c.js')),X=F.ISLAND_FX;
const [out,cp,ct,fov,t0,secs,nightAt,fps,wind]=process.argv.slice(2);const cam=cp.split(',').map(Number),target=ct.split(',').map(Number);
const geo=g=>({positions:g.positions,colors:g.colors,indices:g.indices});
const frames=[];let w=0,first=true;const n=Math.round(+secs*+fps);
for(let i=0;i<n;i++){const s=i/ +fps,t=+t0+s,night=s>=+nightAt;w=first?(night?1:0):F.approachNight(w,night,1/ +fps);first=false;
  const wr=String(wind||'0').split('-').map(Number),wv=wr.length>1?wr[0]+(wr[1]-wr[0])*i/Math.max(1,n-1):wr[0];
  const light=F.lightFromNight(w),b=F.beamState(t,cam,light),p=F.smokePuffs(t,wv,w,1,cam),m=F.moonState(t,cam,light);
  frames.push({t,night:w,wind:wv,beam:{rot:b.rotation,alpha:b.alpha,flash:b.flash},glow:{pos:b.glowPos,rot:b.glowRotation,scale:b.glowScale,alpha:b.glowAlpha},glint:{rot:b.glintRotation,alpha:b.glintAlpha},
    moon:{rot:m.moonRotation,alpha:m.moonAlpha,halo:m.haloAlpha},band:{pos:m.bandPos,rot:m.bandRotation,scale:m.bandScale,alpha:m.bandAlpha},
    puffs:p.map(q=>({pos:q.position,rot:q.rotation,scale:q.scale,color:q.color,alpha:q.alpha,mesh:0}))});}
fs.writeFileSync(out,JSON.stringify({camera:{pos:cam,target,fov:+fov},fps:+fps,lamp:X.lamp,seaY:X.seaY,colors:{beam:X.beam.color,glow:X.glow.color,glint:X.glint.color,moon:X.moon.color,halo:X.moon.haloColor,band:X.band.color},moon:{pos:X.moon.pos,radius:X.moon.radiusM,halo:X.moon.haloRadiusM},
  geometry:{beam:geo(F.beamGeometry()),glow:geo(F.discGeometry(18,.32,.55,0,0,900)),glint:geo(F.glintGeometry()),puff0:geo(F.discGeometry(14,.5,.8,.26,.22,11)),puff1:geo(F.discGeometry(14,.5,.8,.3,.22,37)),moon:geo(F.discGeometry(28,.9,1,0,.14,0)),halo:geo(F.discGeometry(24,.2,.5,0,0,0)),band:geo(F.bandGeometry())},frames}));
const fl=frames.map(f=>f.beam.flash);console.log('frames',n,'maxFlash',Math.max(...fl).toFixed(3),'at',frames[fl.indexOf(Math.max(...fl))].t.toFixed(2));
