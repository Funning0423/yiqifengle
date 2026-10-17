'use strict';
// Camera kinematics of the lakeside journey, new (Landing A lakeside) vs fallback (the same route with no focus/landing =
// what any JourneyRoute gets by default: 04→05-style follow lens to the end). Time base: real walk driver distance (walk.json).
const fs=require('fs'),W='/workspace/wechat-game/work/wt-lk';
const {createHarness}=require(W+'/tools/board-ui/harness.cjs'),H=createHarness(),S=W+'/creator-build-project/assets/scripts/';
const Core=H.load(S+'world-r1/RegionJourneyCore.ts');
const dump=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),walk=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const P=dump.path,T=Core.routeLength(P);
const variants={new:d=>Core.journeyCamera(P,d,dump.start1,dump.focus,undefined,0,dump.landing),fallback:d=>Core.journeyCamera(P,d,dump.start1,undefined,undefined,0)};
const fps=walk.fps,dt=1/fps,F=walk.frames.filter(f=>f.t<=walk.frames.find(x=>x.s>=walk.L-1e-9).t+2);
const out={fps,T,variants:{}};
for(const [k,fn] of Object.entries(variants)){const pos=F.map(f=>fn(Math.min(T,f.s))),dir=pos.map(c=>{const v=[0,1,2].map(i=>c.target[i]-c.position[i]),l=Math.hypot(...v);return v.map(x=>x/l);});
 const der=(a)=>a.slice(1).map((v,i)=>v.map((x,j)=>(x-a[i][j])/dt));const p=pos.map(c=>c.position),v=der(p),a=der(v),j=der(a),n=x=>Math.hypot(...x);
 const ang=dir.slice(1).map((u,i)=>Math.acos(Math.min(1,u[0]*dir[i][0]+u[1]*dir[i][1]+u[2]*dir[i][2]))*180/Math.PI/dt);
 const rows=F.map((f,i)=>({t:+f.t.toFixed(4),s:+f.s.toFixed(4),herV:i?+((f.s-F[i-1].s)/dt).toFixed(4):0,camV:v[i-1]?+n(v[i-1]).toFixed(4):0,camA:a[i-2]?+n(a[i-2]).toFixed(4):0,camJ:j[i-3]?+n(j[i-3]).toFixed(3):0,turnDegS:ang[i-1]!==undefined?+ang[i-1].toFixed(3):0,camY:+p[i][1].toFixed(4)}));
 const after=t0=>rows.filter(r=>r.t>=t0);const mx=(rs,key)=>rs.reduce((m,r)=>r[key]>m[key]?r:m);
 const tStop=F.find(x=>x.s>=walk.L-1e-9).t,last=rows.filter(r=>r.t>tStop-.5&&r.t<=tStop+1e-6);
 out.variants[k]={rows,summary:{durationS:+tStop.toFixed(3),peakCamV:mx(after(.6),'camV'),peakCamA:mx(after(.6),'camA'),peakCamJ:mx(after(.6),'camJ'),peakTurn:mx(rows,'turnDegS'),
  stop:{camVLast05sMax:Math.max(...last.map(r=>r.camV)),camVAtStop:rows.find(r=>r.t>=tStop-1e-9).camV,camAJumpAtStop:Math.max(...rows.filter(r=>Math.abs(r.t-tStop)<4*dt).map(r=>r.camA))}}};}
fs.writeFileSync(process.argv[4],JSON.stringify(out));
for(const [k,v] of Object.entries(out.variants))console.log(k,JSON.stringify(v.summary));
