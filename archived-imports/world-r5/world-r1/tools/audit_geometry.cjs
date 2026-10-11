const {CHARACTER_REFERENCE}=require('../components/CharacterReference.ts');
const fs=require('fs'),assert=require('node:assert/strict');
const {FIRSTSLICE:f}=require('../components/FirstsliceFacts.ts');
const {createFirstsliceRoutes}=require('../components/FirstsliceRoutes.ts');
const {auditDoorTrack}=require('../components/WorldGeometry.ts');
const c=createFirstsliceRoutes(f,CHARACTER_REFERENCE),door=f.door;
const tests=[
 ['camera-home',[c.cameraHome.position],0,105,.12],
 ['camera-inside-full-sweep',[c.cameraInside.position],0,105,.12],
 ['camera-door-crossing',[c.cameraInside.position,c.cameraOutside.position],86.4,86.4,.12],
 ['camera-island-track',[c.cameraOutside.position,c.cameraIsland.position],86.4,86.4,.12],
 ['camera-pre-turn',[c.cameraHome.position,c.cameraToDoor[0].position],0,0,.12],
 ['camera-approach',c.cameraToDoor.map(p=>p.position),0,0,.12],
 ['actor-door-stand-full-sweep',[c.toDoor.at(-1)],0,105,.18],
 ['actor-return-stop-full-sweep',[c.inCrossing.at(-1)],0,105,.18],
 ['actor-exit-crossing',c.outCrossing,86.4,86.4,.18],
 ['actor-return-crossing',c.inCrossing,86.4,86.4,.18],
];
const results=tests.map(([name,path,a,b,radius])=>({name,path,fromDeg:a,toDeg:b,...auditDoorTrack(path,a,b,door,radius)}));
for(const x of results){console.log(x.name,x.conservativeMinimumClearanceM.toFixed(6));assert.ok(x.conservativeMinimumClearanceM>.05,x.name+' minimum margin');}
// +Z facing character: right = forward x up = -X; seated yaw uses same convention.
const rightDot=(cam,actor,yaw)=>{const right=[-Math.cos(yaw),0,Math.sin(yaw)];return right.reduce((s,x,i)=>s+x*(cam[i]-actor[i]),0);};
const side={seated:rightDot(c.cameraHome.position,c.seat.position,c.seat.yawRad),door:rightDot(c.cameraInside.position,c.toDoor.at(-1),0)};
assert.ok(side.seated>0&&side.door>0);
// For a straight actor segment and synchronized camera segment, right projection is linear.
// Checking both endpoints proves the whole segment stays on that character-right half-plane.
const walkingRight=c.toDoor.slice(1).flatMap((p,i)=>{const yaw=Math.atan2(p[0]-c.toDoor[i][0],p[2]-c.toDoor[i][2]);return [rightDot(c.cameraToDoor[i].position,c.toDoor[i],yaw),rightDot(c.cameraToDoor[i+1].position,p,yaw)];});
side.minimumAlongDoorApproach=Math.min(...walkingRight);assert.ok(side.minimumAlongDoorApproach>.05);
side.preTurnAtStandingRoot=rightDot(c.cameraToDoor[0].position,c.seat.standingControllerRoot,c.seat.yawRad);assert.ok(side.preTurnAtStandingRoot>0);
const report={scope:'Pure geometry: actual GLB door OBB, candidate rails, conservative continuous door bound. Not engine collision or rendered-view acceptance.',cameraSphereRadiusM:.12,actorProvisionalRadiusM:.18,actorCalibration:'not validated against final B',requiredMarginM:.05,results,rightSideProjectionM:side,
 limitations:['Interior/exterior mesh occlusion and projection clipping require Cocos review.','Actor radius is provisional; adapter calibration must fail closed if actual collision shape exceeds it.','Camera crosses the doorway only after door completes opening; it cannot avoid the union of every door angle while crossing.'],routes:c};
fs.writeFileSync(require('path').join(__dirname,'../evidence/geometry.json'),JSON.stringify(report,null,2)+'\n');
