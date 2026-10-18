#!/usr/bin/env node
'use strict';
/** Ride continuity for the GGbot balloon (30 fps).
 *  Always: balloon-local camera has no one-frame pose jump across 0..36 s.
 *  With BALLOON_RIDE_MP4 (and optional BALLOON_RIDE_NIGHT=1): stream frames and
 *  require the girl inside the viewport, no one-frame brightness spike.
 *  Writes JSON next to the video when BALLOON_CONTINUITY_OUT is set, else stdout. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createHarness}=require('../board-ui/harness.cjs');

const ROOT=path.resolve(__dirname,'../..');
const S=ROOT+'/creator-build-project/assets/scripts/';
const B=ROOT+'/creator-build-project/assets/bundles/';
const H=createHarness();
const J=require('./journey-scene.cjs');
const T=H.load(S+'region/TransportLeg.ts');
const Flight=H.load(S+'region/BalloonFlight.ts');
global.__QF_BALLOON_FLIGHT=JSON.parse(fs.readFileSync(B+'region_transit_balloon/balloon_flightpath.json','utf8'));
const m6=J.add(J.rotY(180,[0.2,6.5,-25.6]),J.mOff);
const court=J.sp('anchor_starcourt_center');
const plan=T.balloonBeats(m6,[5.4,-0.11,43.8],court,{cityFrame:{yawDeg:J.yaw,origin:J.sOff}});

function camLocal(t){
 const c=plan.camera(t),v=plan.vehicle(t),yaw=v.yaw*180/Math.PI;
 const rel=[c.position[0]-v.pos[0],c.position[1]-v.pos[1],c.position[2]-v.pos[2]];
 const look=[c.target[0]-v.pos[0],c.target[1]-v.pos[1],c.target[2]-v.pos[2]];
 return {pos:Flight.rotY(-yaw,rel),look:Flight.rotY(-yaw,look),roll:v.roll,fov:c.fovVerticalDeg};
}
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
const FPS=30,DT=1/FPS;
const speeds=[];
let prev=null;
for(let i=0;i<=Math.round(36*FPS);i++){
 const t=Math.min(36,i*DT);
 const c=camLocal(t);
 if(prev)speeds.push({t,v:dist(c.pos,prev.pos)/DT,look:dist(c.look,prev.look)/DT,roll:Math.abs(c.roll-prev.roll)/DT,fov:Math.abs(c.fov-prev.fov)});
 prev=c;
}
function isolated(rows,key,absMin,ratio){
 const hits=[];
 for(let i=2;i<rows.length-2;i++){
  const v=rows[i][key];
  const nb=[rows[i-2][key],rows[i-1][key],rows[i+1][key],rows[i+2][key]];
  const base=Math.max(...nb,1e-4);
  if(v>absMin&&v>base*ratio)hits.push({t:+rows[i].t.toFixed(3),v:+v.toFixed(3),base:+base.toFixed(3)});
 }
 return hits;
}
const camJumps=isolated(speeds,'v',12,3.5).concat(isolated(speeds,'look',8,3.5)).concat(isolated(speeds,'roll',25,4));
const camReport={frames:speeds.length+1,fps:FPS,maxPosMs:+Math.max(...speeds.map(s=>s.v)).toFixed(3),jumps:camJumps};
assert.equal(camJumps.length,0,'camera one-frame jump '+JSON.stringify(camJumps.slice(0,6)));

function analyzeMp4(file,night){
 const W=390,H=844,N=W*H,frameBytes=N*3;
 const girlMin=night?12:25;
 return new Promise((ok,bad)=>{
  const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-vf','fps=30,scale=390:844','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
  const rows=[];
  let acc=Buffer.alloc(0),err='';
  ff.stderr.on('data',d=>{err+=d.toString();});
  ff.stdout.on('data',chunk=>{
   acc=Buffer.concat([acc,chunk]);
   while(acc.length>=frameBytes){
    const buf=acc.subarray(0,frameBytes);acc=Buffer.from(acc.subarray(frameBytes));
    let sum=0,girl=0,x0=W,y0=H,x1=0,y1=0;
    for(let p=0,i=0;p<N;p++,i+=3){
     const r=buf[i],g=buf[i+1],b=buf[i+2];
     sum+=0.299*r+0.587*g+0.114*b;
     const warm=night?(r>90&&r>b+12&&g>50&&g<r+30):(r>145&&g>70&&g<190&&b<110&&r>g+15&&r>b+40);
     if(!warm)continue;
     girl++;
     const x=p%W,y=(p/W)|0;
     if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
    }
    const wide=girl>=girlMin&&(x1-x0)>6&&(y1-y0)>8;
    rows.push({luma:sum/N,girl,inside:wide});
   }
  });
  ff.on('error',bad);
  ff.on('close',code=>{
   if(code){bad(Error('ffmpeg '+file+' '+err.slice(0,400)));return;}
   if(rows.length<FPS*30){bad(Error('short ride video '+file+' frames='+rows.length));return;}
   const dL=[];
   for(let i=1;i<rows.length;i++)dL.push({i,d:Math.abs(rows[i].luma-rows[i-1].luma)});
   const spikes=[];
   for(let i=2;i<dL.length-2;i++){
    const v=dL[i].d,nb=[dL[i-2].d,dL[i-1].d,dL[i+1].d,dL[i+2].d],base=Math.max(...nb,0.4);
    if(v>12&&v>base*4)spikes.push({frame:dL[i].i,d:+v.toFixed(2),base:+base.toFixed(2)});
   }
   const girlFail=rows.map((r,i)=>r.inside?null:i).filter(i=>i!=null);
   const miss=girlFail.length,edge=rows.filter(r=>!r.inside&&r.girl>=girlMin).length;
   ok({file,night,frames:rows.length,girlMin,miss,edge,spikes,girlFail:girlFail.slice(0,12),meanGirl:rows.reduce((s,r)=>s+r.girl,0)/rows.length});
  });
 });
}

async function main(){
 const mp4=process.env.BALLOON_RIDE_MP4||'';
 let pixels=null;
 if(mp4){
  pixels=await analyzeMp4(mp4,process.env.BALLOON_RIDE_NIGHT==='1');
  assert.equal(pixels.miss,0,'girl not visible '+JSON.stringify({miss:pixels.miss,edge:pixels.edge,sample:pixels.girlFail}));
  assert.equal(pixels.spikes.length,0,'brightness spike '+JSON.stringify(pixels.spikes.slice(0,8)));
 }
 const report={cam:camReport,pixels};
 const out=process.env.BALLOON_CONTINUITY_OUT;
 if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report));
 console.log('BALLOON CONTINUITY PASS');
}
main().catch(e=>{console.error(e);process.exit(1);});
