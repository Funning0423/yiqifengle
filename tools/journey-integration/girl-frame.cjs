'use strict';
// 运镜bot report helper (camera rules for GGbot's r4-prep B+): her frozen board copy (r4-prep B+) at the board camera = the region hook's end pose: on-screen footprint per screen
const Jn=require('./journey-scene.cjs');const {legs,routeLength,rotY,add,sub,mOff,sOff,yaw,sA,H,S,sampleRoute}=Jn;
const RB=H.load(S+'region/RegionBoardLanding.ts'),BL=H.load(S+'ui/BoardLayout.ts'),RC=H.load(S+'world-r1/RegionCameraData.ts');
const SRC={meadow:{region:'meadow',map:{toJourney:p=>add(rotY(180,p),mOff),toBoard:p=>rotY(-180,sub(p,mOff))}},skycity:{region:'skycity',map:{toJourney:p=>add(rotY(yaw,p),sOff),toBoard:p=>rotY(-yaw,sub(p,sOff))},anchors:{spawn:sA('anchor_spawn_girl'),court:sA('anchor_starcourt_center')}}};
const C=RC.REGION_CAMERA.islandCharacter;const out=[];
for(const region of ['meadow','skycity'])for(const [w,h] of [[390,844],[414,896],[360,780],[375,667],[390,520]]){
 const leg=legs.find(l=>l.id===(region==='meadow'?'04-05':'08-09')),L=routeLength(leg.path),root=sampleRoute(leg.path,L).slice(0,3),b=RB.regionBoardEnd(SRC[region],w/h);
 const f=sub(b.target,b.position),fl=Math.hypot(...f);const F=f.map(x=>x/fl),R=[F[2],0,-F[0]].map((x,_,a)=>x/Math.hypot(a[0],a[2])),U=[R[1]*F[2]-R[2]*F[1],R[2]*F[0]-R[0]*F[2],R[0]*F[1]-R[1]*F[0]].map(x=>-x);
 for(let k=0;k<3;k++)R[k]=-R[k];// screen right = F x up (the vector above was screen-left; U is built from it, so flip after)
 const t=Math.tan(b.fovVerticalDeg*Math.PI/360),asp=w/h;const pts=[];
 for(const dx of [-C.halfWidthM,C.halfWidthM])for(const dz of [-C.halfWidthM,C.halfWidthM])for(const y of [0,C.heightM]){const q=sub([root[0]+dx,root[1]+y,root[2]+dz],b.position),z=q[0]*F[0]+q[1]*F[1]+q[2]*F[2];pts.push(z>0?[(q[0]*R[0]+q[1]*R[1]+q[2]*R[2])/(z*t*asp),(q[0]*U[0]+q[1]*U[1]+q[2]*U[2])/(z*t),z]:null);}
 const lay=BL.boardLayout(w,h,BL.boardSafeInsets(w,h));
 if(pts.some(p=>!p)){out.push({region,screen:`${w}x${h}`,behindCamera:true});continue;}
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const ndc={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
 const px={l:(ndc.minX+1)/2*w,r:(ndc.maxX+1)/2*w,t:(1-ndc.maxY)/2*h,b:(1-ndc.minY)/2*h};const cl={l:Math.max(0,px.l),r:Math.min(w,px.r),t:Math.max(0,px.t),b:Math.min(h,px.b)};
 const vis=cl.r>cl.l&&cl.b>cl.t;const rect=r=>({l:r.x-r.width/2,r:r.x+r.width/2,t:r.y-r.height/2,b:r.y+r.height/2});const ov=(a,q)=>Math.max(0,Math.min(a.r,q.r)-Math.max(a.l,q.l))*Math.max(0,Math.min(a.b,q.b)-Math.max(a.t,q.t));
 const area=vis?(cl.r-cl.l)*(cl.b-cl.t):0,tray=rect(lay.tray),plate=rect(lay.plate);
 out.push({region,screen:`${w}x${h}`,distanceM:+Math.min(...pts.map(p=>p[2])).toFixed(2),visible:vis,boxPt:{l:+px.l.toFixed(1),r:+px.r.toFixed(1),t:+px.t.toFixed(1),b:+px.b.toFixed(1)},widthFrac:vis?+((cl.r-cl.l)/w).toFixed(3):null,heightFrac:vis?+((cl.b-cl.t)/h).toFixed(3):null,ndcX:[+ndc.minX.toFixed(2),+ndc.maxX.toFixed(2)],
  inFrameLimits:ndc.minX>=-RC.REGION_CAMERA.frameLimits.maxAbsX&&ndc.maxX<=RC.REGION_CAMERA.frameLimits.maxAbsX&&ndc.minY>=RC.REGION_CAMERA.frameLimits.minY&&ndc.maxY<=RC.REGION_CAMERA.frameLimits.maxY,
  trayPt:{l:+tray.l.toFixed(1),r:+tray.r.toFixed(1),t:+tray.t.toFixed(1),b:+tray.b.toFixed(1)},underTrayShareOfHer:area?+(ov(cl,tray)/area).toFixed(3):0,underPlateShareOfHer:area?+(ov(cl,plate)/area).toFixed(3):0,
  underToolIconsShareOfHer:Object.fromEntries([1,2,3].map(n=>[n+'tools',area?+(BL.toolSlots(lay,n).reduce((a,x)=>a+ov(cl,{l:x-lay.tools.size/2,r:x+lay.tools.size/2,t:lay.tools.y-lay.tools.size/2,b:lay.tools.y+lay.tools.size/2}),0)/area).toFixed(3):0]))});}
if(require.main===module)console.log(JSON.stringify(out,null,0).replace(/\},\{/g,'},\n{'));module.exports=out;
