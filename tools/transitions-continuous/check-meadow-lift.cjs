'use strict';
/* 运镜bot b19: meadow balloon lift-off clearance. Same volume model as 场景设计部's check-lift-clearance.cjs (71f1c41: basket walls
 * r 0.96 to 1.25 m, envelope radius profile of transport_balloon.glb balloon_envelope 2.9–10.5 m, ropes/burner r 0.5, triangle
 * barycentric grid ≤0.2 m) but against env_meadow.glb (meadow-local frame = flight-file 'meadow' frame), plus the windmill blade
 * SWEEP volume: windmill_sails rotated about its hub axis in 5° steps. Path = BalloonFlight.sampleFlight (incl. the b19 take-off
 * shift) from t=0 to the seam (meadow-unload).  usage: node check-meadow-lift.cjs [--min 0.5] [--dt 0.05]   needs /tmp/draco3d. */
const fs=require('fs'),path=require('path'),cp=require('child_process'),{createHarness}=require('../board-ui/harness.cjs');
const ROOT=path.resolve(__dirname,'../..'),BUN=path.join(ROOT,'creator-build-project/assets/bundles/'),DUMP=path.join(ROOT,'tools/transition-spaces/dump-mesh.cjs');
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf(k);return i>=0?+args[i+1]:d;};
function dump(glb,box,re){fs.mkdirSync('/tmp/b19ml',{recursive:true});const out=`/tmp/b19ml/${path.basename(glb)}_${box}_${re||''}.json`.replace(/[^A-Za-z0-9_./-]/g,'_');
 if(!fs.existsSync(out))cp.execFileSync('node',[DUMP,glb,box,out,...(re?[re]:[])],{stdio:'ignore'});return JSON.parse(fs.readFileSync(out,'utf8'));}
function envelopeProfile(){const T=Object.values(dump(BUN+'region_transit_balloon/transport_balloon.glb','-50,-50,50,50','^balloon_envelope$')).flat(),prof=[];
 for(let y=2.9;y<=10.5+1e-6;y+=.1){let m=0;for(let k=0;k+9<=T.length;k+=9)for(const [a,b] of [[0,3],[3,6],[6,0]]){const ya=T[k+a+1],yb=T[k+b+1];
  if((ya-y)*(yb-y)>0||ya===yb){if(Math.abs(ya-y)<.05)m=Math.max(m,Math.hypot(T[k+a],T[k+a+2]));continue;}const u=(y-ya)/(yb-ya);m=Math.max(m,Math.hypot(T[k+a]+(T[k+b]-T[k+a])*u,T[k+a+2]+(T[k+b+2]-T[k+a+2])*u));}prof.push(m);}
 return h=>(h<2.9||h>10.5)?0:prof[Math.min(prof.length-1,Math.round((h-2.9)/.1))];}
function grid(t,pts,names,n){const e=Math.max(Math.hypot(t[3]-t[0],t[4]-t[1],t[5]-t[2]),Math.hypot(t[6]-t[0],t[7]-t[1],t[8]-t[2]),Math.hypot(t[6]-t[3],t[7]-t[4],t[8]-t[5])),m=Math.max(1,Math.ceil(e/.2));
 for(let a=0;a<=m;a++)for(let b=0;a+b<=m;b++){const u=a/m,w=b/m;pts.push(t[0]+(t[3]-t[0])*u+(t[6]-t[0])*w,t[1]+(t[4]-t[1])*u+(t[7]-t[1])*w,t[2]+(t[5]-t[2])*u+(t[8]-t[2])*w);names.push(n);}}
function check({tEnd=null,dt=0.05,min=0.5,keysOverride=null}={}){
 const H=createHarness(),F=H.load('region/BalloonFlight.ts');global.__QF_BALLOON_FLIGHT=JSON.parse(fs.readFileSync(BUN+'region_transit_balloon/balloon_flightpath.json','utf8'));
 const doc=F.flightDocument(),T1=tEnd??F.SEAM_T-0.05,P=keysOverride||(t=>F.sampleFlight(doc,t).pos);
 let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let t=0;t<=T1;t+=dt){const p=P(t);x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[2]);z1=Math.max(z1,p[2]);}
 const M=14,box=[x0-M,z0-M,x1+M,z1+M].map(v=>Math.round(v)).join(',');const env=dump(BUN+'region_meadow/env_meadow.glb',box);
 const SKIP=/sky_dome|cloud|sea_surface|sea_foam|wave_line|surf_foam|far_|water|grass_card|windmill_sails/;const pts=[],names=[];
 for(const [n,v] of Object.entries(env)){if(SKIP.test(n))continue;for(let k=0;k+9<=v.length;k+=9)grid(v.slice(k,k+9),pts,names,n);}
 // blade sweep: rotate windmill_sails about its hub (bbox centre in its disc plane), axis = disc normal (thin bbox axis)
 const S=Object.values(dump(BUN+'region_meadow/env_meadow.glb','-60,-80,60,40','^windmill_sails$')).flat();let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
 for(let i=0;i<S.length;i+=3)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],S[i+j]);hi[j]=Math.max(hi[j],S[i+j]);}
 const hub=[0,1,2].map(j=>(lo[j]+hi[j])/2),ext=[0,1,2].map(j=>hi[j]-lo[j]),ax=ext.indexOf(Math.min(...ext));
 const rotAx=(p,a)=>{const c=Math.cos(a),s=Math.sin(a),q=[p[0]-hub[0],p[1]-hub[1],p[2]-hub[2]];let r;
  if(ax===2)r=[c*q[0]-s*q[1],s*q[0]+c*q[1],q[2]];else if(ax===0)r=[q[0],c*q[1]-s*q[2],s*q[1]+c*q[2]];else r=[c*q[0]+s*q[2],q[1],-s*q[0]+c*q[2]];return [r[0]+hub[0],r[1]+hub[1],r[2]+hub[2]];};
 for(let deg=0;deg<360;deg+=5){const a=deg*Math.PI/180;for(let k=0;k+9<=S.length;k+=9){const t=[];for(let v=0;v<3;v++)t.push(...rotAx(S.slice(k+v*3,k+v*3+3),a));grid(t,pts,names,'windmill_blade_sweep');}}
 const envR=envelopeProfile(),k0=P(0);
 const gapAt=p=>{const moored=Math.hypot(p[0]-k0[0],p[1]-k0[1],p[2]-k0[2])<.05;let g=99,who=null,hp=null;
  for(let i=0,j=0;i<pts.length;i+=3,j++){const h=pts[i+1]-p[1];if(h>10.8)continue;const d=Math.hypot(pts[i]-p[0],pts[i+2]-p[2]);if(d>9)continue;let gap;
   if(h>.02){const r=Math.max(envR(h),h<1.25?.96:0);gap=r<=0?d-.5:d-r;}else{if(moored||d>.96)continue;gap=-h-.03;}
   if(gap<g){g=gap;who=names[j];hp=[pts[i],pts[i+1],pts[i+2]];}}return {g,who,hp};};
 const GROUND=/terrain|path|grass|ground/;let best={g:99},bestLat={g:99},n=0;const per=[];for(let t=0;t<=T1+1e-9;t+=dt){const p=P(t),r=gapAt(p);n++;if(r.g<best.g)best={...r,t,p};if(!GROUND.test(r.who||'')&&r.g<bestLat.g)bestLat={...r,t,p};if(Math.abs(t/0.5-Math.round(t/0.5))<1e-6)per.push({t:+t.toFixed(2),gap:+r.g.toFixed(3),hit:r.who});}
 const r3=a=>a&&a.map(v=>+v.toFixed(3));/* pass on obstacles; the ground/path gap right after the basket leaves its mooring (vertical, 0→0.5 m in ~0.4 s) is reported, not gated */
 return {pass:bestLat.g>=min,minObstacleGapM:+bestLat.g.toFixed(3),obstacleAtT:+(bestLat.t??0).toFixed(2),obstacleHit:bestLat.who,minGapM:+best.g.toFixed(3),atT:+best.t.toFixed(2),atPos:r3(best.p),hit:best.who,hitPoint:r3(best.hp),min,hub:r3(hub),bladeAxis:'xyz'[ax],samples:n,perHalfSecond:per};}
module.exports={check};
if(require.main===module){const r=check({min:opt('--min',0.5),dt:opt('--dt',0.05)});console.log(JSON.stringify(r));process.exit(r.pass?0:1);}
