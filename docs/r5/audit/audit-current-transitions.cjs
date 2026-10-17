#!/usr/bin/env node
'use strict';
// Env: WT=<repo worktree>  ROOM_GLB / SKY_GLB = Draco-decoded room_no_original_chair.glb / env_skycity.glb (blender -b --python tools/journey-integration/occlusion/decode-draco-blender.py -- in out)  MODE=day|night
/* Audit of the CURRENT (r4.1 / f569ff0 + WIP 9fc549) inter-region journey legs 04→05 (island→meadow) and 08→09 (meadow→sky city):
 * the real journey camera (RegionJourneyCore.journeyCamera, legs rebuilt by journey-scene.cjs exactly as RegionJourneyAdapter) against the
 * FULL decoded scene geometry (island room GLB incl. sea + sky dome, meadow GLB incl. dome/far hills, full sky-city GLB), 390x844.
 * Per sample (every 0.25 m = 0.21 s at 1.2 m/s): near-plane intersection (clearance < near-plane half-diagonal at near 0.1 m),
 * close-up (< 1 m), back faces in view (ray's first hit is a back face → hole/inside-out with single-sided materials), void
 * (ray hits nothing at all, i.e. no dome/sea/ground behind it), sky-island underside share, sunk geometry (sky-island triangles under
 * the meadow terrain that the view sees). Geometry evidence only, not engine screenshots. */
const W=process.env.WT||'/workspace/gh/wt-skyb';const J=require(W+'/tools/journey-integration/journey-scene.cjs'),F=require(W+'/tools/journey-integration/journey-framing-lib.cjs');
const {load}=require(W+'/tools/journey-integration/occlusion/lib-glb.cjs');const fs=require('fs');
const take=(f,skip)=>load(f).filter(n=>n.tris&&n.tris.length&&!(skip&&skip.test(n.name))).map(n=>({name:n.name,tris:Float64Array.from(n.tris)}));
const island=J.place(take((process.env.ROOM_GLB||'/workspace/gh/scratch/dec/room.glb'),/^env_interior_|^env_int_/),'island');
// RegionJourneyAdapter.prepare disables meadow_sky_dome + meadow_far_hills in the journey copy (day); mountMeadowNightSky shows the dome at night only.
const MODE=process.env.MODE||'day';const meadow=J.place(take(W+'/creator-build-project/assets/bundles/region_meadow/env_meadow.glb',MODE==='night'?/^meadow_far_hills/:/^meadow_sky_dome|^meadow_far_hills/),'meadow',180,1,J.mOff);
const sky=J.place(take((process.env.SKY_GLB||'/workspace/gh/scratch/dec/skycity.glb'),/^chr_robot/),'skycity',J.yaw,1,J.sOff);
// 04→05: only the meadow copy is mounted (RegionJourneyAdapter mounts the sky city for 08→09).
const SETS={'04-05':[...island,...meadow],'08-09':[...island,...meadow,...sky]},BVH={};for(const k in SETS)BVH[k]=F.buildBvh(SETS[k]);
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024]];const NEAR=.1;
const out={scope:'geometry audit, 7 screens, near 0.1 m, r4.1 journey camera (RegionJourneyCore.journeyCamera as rebuilt by journey-scene.cjs)',screens:{}};
for(const [SW,SH] of SCREENS){const ASP=SW/SH;out.screens[SW+'x'+SH]={};const FOV=J.JOURNEY_CAMERA&&J.JOURNEY_CAMERA.fov||48,halfDiag=NEAR*Math.tan(FOV*Math.PI/360)*Math.hypot(1,ASP);if(SW!==390||SH!==844)console.log('#### screen',SW+'x'+SH);
for(const leg of J.legs){const objs=SETS[leg.id],bvh=BVH[leg.id];const T=J.routeLength(leg.path),rows=[],issues=[];
 for(let d=0;d<=T+1e-9;d+=.25){const c=J.journeyCamera(leg.path,Math.min(T,d),leg.start,leg.focus,leg.lens,leg.startBlendM),{fw,r,up,th}=F.basis(c);let n=0,back=0,voidN=0,under=0,sea=0,sunk=0;const domes=new Set();
  for(let j=0;j<14;j++)for(let i=0;i<7;i++){const x=((i+.5)/7*2-1)*th*ASP,y=((j+.5)/14*2-1)*th,dd=[fw[0]+r[0]*x+up[0]*y,fw[1]+r[1]*x+up[1]*y,fw[2]+r[2]*x+up[2]*y],l=Math.hypot(...dd),u=dd.map(v=>v/l);n++;
   const h=F.cast(bvh,c.position,u,900);if(!h){voidN++;continue;}const nd=h.normal[0]*u[0]+h.normal[1]*u[1]+h.normal[2]*u[2];if(nd>0)back++;if(h.obj.tag==='skycity'&&h.normal[1]<-.35)under++;if(/sea_surface/.test(h.obj.name))sea++;if(/sky_dome/.test(h.obj.name))domes.add(h.obj.tag);
   if(h.obj.tag==='skycity'){const p=[c.position[0]+u[0]*h.t,c.position[1]+u[1]*h.t,c.position[2]+u[2]*h.t];if(p[1]<J.mOff[1]+6&&Math.hypot(p[0]-J.mOff[0],p[2]-J.mOff[2])<80)sunk++;}}
  const [cl,who]=J.clearance(c.position,objs,12);const rec={d:+d.toFixed(2),t:+(d/1.2).toFixed(2),clearM:+cl.toFixed(2),nearObj:cl<12?who:null,back:+(back/n).toFixed(3),void:+(voidN/n).toFixed(3),underside:+(under/n).toFixed(3),sea:+(sea/n).toFixed(3),sunkSky:+(sunk/n).toFixed(3),camY:+c.position[1].toFixed(2),domes:[...domes].join('+')};rows.push(rec);
  const why=[];if(cl<halfDiag)why.push('NEAR-PLANE-INTERSECT');else if(cl<1)why.push('close-up<1m');if(rec.back>.03)why.push('back-faces '+(rec.back*100).toFixed(0)+'%');if(rec.void>0)why.push('VOID '+(rec.void*100).toFixed(0)+'%');if(rec.underside>.10)why.push('underside '+(rec.underside*100).toFixed(0)+'%');if(domes.size>1)why.push('two-sky-domes-seam');if(rec.sunkSky>0)why.push('sky-island-under-meadow '+(rec.sunkSky*100).toFixed(0)+'%');
  if(why.length)issues.push({...rec,why});}
 // merge consecutive issues into spans
 const spans=[];for(const it of issues){const key=it.why.map(w=>w.replace(/ \d+%/,'')).join('+'),last=spans[spans.length-1];if(last&&last.key===key&&it.d-last.toM<=.26){last.toM=it.d;last.toS=it.t;last.worst=Math.max(last.worst,Math.max(it.back,it.void,it.underside,it.sunkSky));last.minClearM=Math.min(last.minClearM,it.clearM);}else spans.push({key,fromM:it.d,toM:it.d,fromS:it.t,toS:it.t,worst:Math.max(it.back,it.void,it.underside,it.sunkSky),minClearM:it.clearM,nearObj:it.nearObj});}
 out.screens[SW+'x'+SH][leg.id]={lengthM:+T.toFixed(2),durationS:+(T/1.2).toFixed(1),samples:rows.length,spans,rows};
 console.log('==',leg.id,T.toFixed(1)+' m',(T/1.2).toFixed(1)+' s');const mc=Math.min(...rows.map(r=>r.clearM)),mr=rows.find(r=>r.clearM===mc);console.log('  min clearance',mc,'m at t',mr.t,'s',mr.nearObj);for(const s of spans)console.log('  t',s.fromS,'-',s.toS,'s  d',s.fromM,'-',s.toM,'m ',s.key,' worst',(s.worst*100).toFixed(0)+'%',' minClear',s.minClearM,s.nearObj||'');}
}
out.mode=MODE;fs.writeFileSync(__dirname+'/audit-current-transitions-'+MODE+'.json',JSON.stringify(out,null,1));
