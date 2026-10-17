#!/usr/bin/env node
'use strict';
/** Sail camera × 7 screens × day/night. Old 04→05 / 08→09 stays in baseline-current.json and is not failed. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
function load(rel,req){
 const file=path.join(S,rel);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:req,console},{filename:file});return m.exports;
}
const layout=load('region/RegionJourneyLayout.ts',()=>({}));
const leg=load('region/TransportLeg.ts',spec=>spec.includes('RegionJourneyLayout')?layout:{});
const bg=load('region/TransitBackdrop.ts',()=>({}));
const route=leg.sailRoute(),tl=leg.sailBeats(route.length),m0=leg.sailM0World();
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=a=>Math.hypot(a[0],a[1],a[2]);
function hitTri(o,d,ax,ay,az,bx,by,bz,cx,cy,cz){
 const e1=[bx-ax,by-ay,bz-az],e2=[cx-ax,cy-ay,cz-az],p=cross(d,e2),det=dot(e1,p);if(Math.abs(det)<1e-8)return null;
 const inv=1/det,tvec=sub(o,[ax,ay,az]),u=dot(tvec,p)*inv;if(u<0||u>1)return null;
 const q=cross(tvec,e1),v=dot(d,q)*inv;if(v<0||u+v>1)return null;
 const t=dot(e2,q)*inv;if(t<1e-4)return null;
 const n=cross(e1,e2),nl=len(n)||1;return {t,normal:[n[0]/nl,n[1]/nl,n[2]/nl]};
}
function cast(meshes,o,d,maxT){
 let best=null;
 for(const m of meshes){const tr=m.tris;for(let i=0;i<tr.length;i+=9){const h=hitTri(o,d,tr[i],tr[i+1],tr[i+2],tr[i+3],tr[i+4],tr[i+5],tr[i+6],tr[i+7],tr[i+8]);if(h&&h.t<maxT&&(!best||h.t<best.t))best={...h,mesh:m};}}
 return best;
}
function basis(cam){
 const f=sub(cam.target,cam.position),fl=len(f)||1,fw=f.map(v=>v/fl);
 let r=[fw[2],0,-fw[0]];const rl=len(r)||1;r=r.map(v=>v/rl);
 const up=cross(r,fw);return {fw,r,up,th:Math.tan((cam.fovVerticalDeg||48)*Math.PI/360)};
}
function triDist(o,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ao=sub(o,a);
 const d1=dot(ab,ao),d2=dot(ac,ao);
 if(d1<=0&&d2<=0)return len(ao);
 const bo=sub(o,b),d3=dot(ab,bo),d4=dot(ac,bo);
 if(d3>=0&&d4<=d3)return len(bo);
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return len(sub(o,[a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v]));}
 const co=sub(o,c),d5=dot(ab,co),d6=dot(ac,co);
 if(d6>=0&&d5<=d6)return len(co);
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return len(sub(o,[a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w]));}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return len(sub(o,[b[0]+(c[0]-b[0])*w,b[1]+(c[1]-b[1])*w,b[2]+(c[2]-b[2])*w]));}
 const denom=1/(va+vb+vc),v=vb*denom,w=vc*denom;
 const p=[a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w];
 return len(sub(o,p));
}
function clearM(o,meshes){
 let best=1e9,who='';
 for(const m of meshes){if(m.tag==='dome'||m.tag==='cloud'||m.tag==='sea'||m.tag==='card')continue;const tr=m.tris;for(let i=0;i<tr.length;i+=9){
  const d=triDist(o,[tr[i],tr[i+1],tr[i+2]],[tr[i+3],tr[i+4],tr[i+5]],[tr[i+6],tr[i+7],tr[i+8]]);
  if(d<best){best=d;who=m.name;}
 }}
 return [best,who];
}
const allow=new Set(['sea','card','ground','boat']);
const fails=[],worst={score:0,frame:0,screen:'',night:false,why:''};
let frame=0;
for(const night of [false,true])for(const screen of leg.SAIL_SCREENS){
 for(let t=0;t<=tl.build05S+1e-6;t+=0.1){
  const v=leg.sailVehicle(tl,route.samples,Math.min(tl.build05S,t));
  const cam=leg.sailCamera(tl,route.samples,Math.min(tl.build05S,t),screen);
  const meshes=bg.transitScene(cam.position,v.pos,v.yaw,m0,night);
  const {fw,r,up,th}=basis(cam),asp=screen.w/screen.h;
  let n=0,back=0,voidN=0,domes=new Set();
  for(let j=0;j<14;j++)for(let i=0;i<7;i++){
   const x=((i+.5)/7*2-1)*th*asp,y=((j+.5)/14*2-1)*th;
   const dd=[fw[0]+r[0]*x+up[0]*y,fw[1]+r[1]*x+up[1]*y,fw[2]+r[2]*x+up[2]*y],l=len(dd),u=dd.map(v=>v/l);
   n++;const h=cast(meshes,cam.position,u,900);
   if(!h){voidN++;continue;}
   if(dot(h.normal,u)>0.05)back++;
   if(h.mesh.tag==='dome')domes.add(h.mesh.name);
  }
  let horizonGap=0,hN=0;
  for(let k=0;k<12;k++)for(const pitch of [-0.5,-2,-4,-6]){
   const yaw=k/12*Math.PI*2,pr=pitch*Math.PI/180;
   const d=[Math.sin(yaw)*Math.cos(pr),Math.sin(pr),Math.cos(yaw)*Math.cos(pr)];
   hN++;const h=cast(meshes,cam.position,d,900);
   if(!h||h.mesh.tag==='dome'||h.mesh.tag==='cloud')horizonGap++;
  }
  const [cl,who]=clearM(cam.position,meshes);
  const nearPts=[];
  const cpos=cam.position;
  nearPts.push([cpos[0]+fw[0]*.1,cpos[1]+fw[1]*.1,cpos[2]+fw[2]*.1]);
  for(const sx of [-1,1])for(const sy of [-1,1])nearPts.push([cpos[0]+(fw[0]+r[0]*sx*th*asp*.1+up[0]*sy*th*.1)*.1,cpos[1]+(fw[1]+r[1]*sx*th*asp*.1+up[1]*sy*th*.1)*.1,cpos[2]+(fw[2]+r[2]*sx*th*asp*.1+up[2]*sy*th*.1)*.1]);
  let nearHit=false;for(const p of nearPts){const [d]=clearM(p,meshes);if(d<0.02)nearHit=true;}
  const rec={frame,t:+t.toFixed(2),screen:screen.w+'x'+screen.h,night,clearM:+cl.toFixed(3),nearHit,back:back/n,void:voidN/n,domes:domes.size,horizonGap:horizonGap/hN,dc:bg.countDc(meshes),tris:bg.countTris(meshes),who};
  const bad=nearHit||cl<0.6||rec.back>0.01||rec.void>0||rec.domes>1||rec.horizonGap>0||rec.dc>53||rec.tris>125000*1.05;
  const score=(bad?10:0)+1/Math.max(0.05,cl);
  if(!worst.rec||score>worst.score){worst.score=score;worst.frame=frame;worst.screen=rec.screen;worst.night=night;worst.why=bad?'fail':'tightest-clearance';worst.rec=rec;}
  if(bad)fails.push(rec);
  frame++;
 }
}
const baseline={status:'RECORDED',note:'f569ff0 04→05 and 08→09 are not failed here. See task audit-day/night and DESIGN §8.1 A1–A6.',oldPeakTris:{'04-05':125000,'08-09':160000}};
assert.equal(fails.length,0,'frame fails '+JSON.stringify(fails.slice(0,3)));
console.log(JSON.stringify({status:'PASS',frames:frame,worst,baseline:baseline.oldPeakTris}));
