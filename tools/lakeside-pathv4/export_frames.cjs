'use strict';
// Offline proxy-render inputs: lakeside triangles (lake-local, one colour per GLB family) + camera/girl track for the
// door lens → board blend and the 7-screen end frames. Output dir = argv[2].
const fs=require('node:fs'),Jn=require('../journey-integration/journey-scene.cjs'),LKS=require('../journey-integration/lakeside/lakeside-scene.cjs');
const {H,S,rotY,add,sub,yaw,sOff}=Jn,LC=H.load(S+'region/LakesideCameraLayout.ts'),LB=H.load(S+'region/LakesideBalloon.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts'),BL=H.load(S+'ui/BoardLayout.ts');
const O=process.argv[2];fs.mkdirSync(O,{recursive:true});
const S6=add(rotY(yaw,[0.2,0.032,-27.8]),sOff),LJ=LC.lakesideJourney(S6),toL=p=>rotY(-LJ.yawDeg,sub(p,LJ.root));
const pal=n=>/terrain/i.test(n)?[.55,.72,.42]:/water|lake/i.test(n)?[.45,.66,.8]:/tree|bush|reed|grass|tuft|flower/i.test(n)?[.33,.55,.3]:/rock|stone/i.test(n)?[.6,.6,.58]:/bridge|pier|dock|barrel|post|raft|house|fence|boat/i.test(n)?[.62,.48,.33]:/cloud|sky/i.test(n)?[.95,.96,1]:[.75,.72,.65];
const inst=LKS.instances().filter(i=>!/sky_dome|cloud/i.test(i.glb));let n=0;for(const i of inst)n+=i.tris.length;
const T=new Float32Array(n),C=new Float32Array(n/3);let o=0,c=0;for(const i of inst){T.set(i.tris,o);o+=i.tris.length;const col=pal(i.glb);for(let k=0;k<i.tris.length/9;k++){C.set(col,c);c+=3;}}
fs.writeFileSync(O+'/tris.f32',Buffer.from(T.buffer));fs.writeFileSync(O+'/cols.f32',Buffer.from(C.buffer));
const shore=LJ.arrival[LJ.arrival.length-1],M=LB.lakesideBalloonMooring(shore,LJ.toWorld),endL=LC.LAKESIDE_CAMERA_LAYOUT.stopLocal;
const L=x=>({position:toL(x.position),target:toL(x.target),fov:x.fovVerticalDeg});
const pose=(w,h)=>{const frame=LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h)),lan=LC.lakesideScreenLanding({landing:LC.LAKESIDE_CAMERA_LAYOUT.landing},frame,endL),E=Core.arrivalPose([shore,LJ.toWorld(endL)],LJ.focus,lan);
 const tray=BL.boardLayout(w,h,BL.boardSafeInsets(w,h),2).tray;return {land:{position:E.position,target:E.target,fovVerticalDeg:lan.arrivalFovDeg},trayBottom:tray.y+tray.height/2};};
const walkL=M.walk.map(toL),yawAt=s=>{const a=Jn.sampleRoute(walkL,Math.max(0,s-.3)),b=Jn.sampleRoute(walkL,Math.min(M.length,s+.3));return Math.atan2(b[0]-a[0],b[2]-a[2]);};
const ends=[[390,844],[360,780],[414,896],[320,568],[390,520],[375,667],[430,932]].map(([w,h])=>{const p=pose(w,h);return {w,h,cam:L(p.land),trayBottom:p.trayBottom,girl:endL,yaw:-58*Math.PI/180};});
// blend track on 390x844 at 30 fps: she walks from outM at the mean walk speed (stop eased over the last 0.6 m)
const P=pose(390,844),door=LB.lakesideDoorLens(M.walk,M.mooring,390/844),bS=LB.lakesideDoorBlendS(door,P.land),entry=LB.lakesideBoardEntryM(M.walk,P.land,390/844,LB.LAKESIDE_DOOR_HOLD.outM),v=M.length/M.walkS,dur=LB.lakesideDoorBlendDurS(bS,LB.LAKESIDE_DOOR_HOLD.outM,entry,v);
const out=LB.LAKESIDE_DOOR_HOLD.outM,rem=M.length-out,track=[];
for(let t=-1;t<=dur+1.5+1e-9;t+=1/30){const tt=Math.max(0,t),lin=out+v*tt,s=Math.min(M.length,lin<M.length-.6?lin:M.length-.6+.6*(1-Math.exp(-(lin-(M.length-.6))/.6)));const g=toL(Jn.sampleRoute(M.walk,s)),gw=Jn.sampleRoute(M.walk,s);
 const cam=t<0?door:LB.lakesideDoorBlendPose(door,P.land,Math.min(1,tt/dur),gw);track.push({t:+t.toFixed(4),cam:L(cam),girl:g,yaw:yawAt(s)});}
fs.writeFileSync(O+'/frames.json',JSON.stringify({ends,track,blendS:dur,w:390,h:844,trayBottom:P.trayBottom}));
console.log('tris',n/9,'frames',track.length,'blend',dur.toFixed(3));
