'use strict';
// 运镜bot clip3: reconstruct the 9ec5323c T-02 approach (key-try2 #42) as a must-fail fixture. 9ec5323c ran the same
// skyFinaleApproach/skyFinaleApproachPose (unchanged since) in the skycity model frame, from the lens the Mac trace shows held for 6 s
// after the chest tap ((60.91,25.01,140.01), euler (1,−163)) to the pre-full9c finale pose [1.972,1.542,−18.668]→[0.377,1.839,−27.012]
// fov 45 round her pre-full9c stand (planWalk tail end (0.941,0.044,−27.059)); world = skyMooring5a + Δ (the 26.6 m sail-chain offset).
// The fixture is checked against the trace sample at +8.81 s (mid-approach) and the end sample (+10.84 s = old finale pose).
const fs=require('fs'),path=require('path'),L=require('./lens-scene.cjs'),{createHarness}=require('../../board-ui/harness.cjs'),H=createHarness();
const F=H.load('region/SkyFinaleShot.ts'),SW=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),SO=H.load('region/SkycityLensOccluders.ts');
const M5=TS.TRANSITION_STAGING.skyMooring5a,D=L.DELTA_9EC,W=p=>SW.skyLocalToWorld(M5,p),W9=p=>W(p).map((v,i)=>v+D[i]);
const o0=W([0,0,0]),ex=W([1,0,0]).map((v,i)=>v-o0[i]),ez=W([0,0,1]).map((v,i)=>v-o0[i]),W2L=p=>{const d=[p[0]-o0[0],p[2]-o0[2]];return [d[0]*ex[0]+d[1]*ex[2],p[1]-o0[1],d[0]*ez[0]+d[1]*ez[2]];};
const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/9ec5323c-key-try2-sky-cam.json'),'utf8')).samples,held=fx.find(s=>s.tS>6&&s.tS<7),mid=fx.find(s=>s.tS>8&&s.tS<9),end=fx.find(s=>s.tS>10&&s.tS<11);
const fw=L.poseFromEuler(held.pos.map((v,i)=>v-D[i]),held.euler,held.fov),from={position:W2L(fw.position),target:W2L(fw.target),fovVerticalDeg:held.fov};
const to={position:[1.972,1.542,-18.668],target:[0.377,1.839,-27.012],fovVerticalDeg:45},feet=[0.941,0.044,-27.059];
const boxes=SO.SKYCITY_LENS_OCCLUDERS.map(b=>({min:b.slice(0,3),max:b.slice(3,6)})),ap=F.skyFinaleApproach(from,to,feet,boxes);
const samples=[];for(let k=0;k<=Math.ceil(ap.T*60);k++){const t=Math.min(ap.T,k/60),p=F.skyFinaleApproachPose(from,to,feet,t,ap.T,ap.dir).position;samples.push({t:+t.toFixed(4),pLocal:p.map(v=>+v.toFixed(4)),pWorld9ec:W9(p).map(v=>+v.toFixed(4))});}
let bm=null,bd=1e9;for(const s of samples){const d=Math.hypot(...s.pWorld9ec.map((v,i)=>v-mid.pos[i]));if(d<bd){bd=d;bm=s;}}
const endGap=Math.hypot(...samples.at(-1).pWorld9ec.map((v,i)=>v-end.pos[i]));
const out={source:'reconstructed from fixtures/9ec5323c-key-try2-sky-cam.json + SkyFinaleShot.skyFinaleApproach (see header of make-9ec-t02-fixture.cjs)',approachS:ap.T,dir:ap.dir,approachStartTS:+(mid.tS-bm.t).toFixed(3),
 check:{midSampleTS:mid.tS,midGapM:+bd.toFixed(2),endSampleTS:end.tS,endGapM:+endGap.toFixed(3)},samples:samples.filter((_,i)=>i%2===0)};
fs.writeFileSync(path.join(__dirname,'../fixtures/9ec5323c-t02-approach.json'),JSON.stringify(out));console.log(JSON.stringify({...out,samples:out.samples.length}));
