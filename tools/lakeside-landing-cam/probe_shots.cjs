// diagnostic shots: top view of the departure + the new keyframes (writes shots json for render_shots.py)
const Jn=require('../journey-integration/journey-scene.cjs'),{H,S,rotY,add,sub,yaw,sOff}=Jn,LC=H.load(S+'region/LakesideCameraLayout.ts');
const S6=add(rotY(yaw,[0.2,0.032,-27.8]),sOff),LJ=LC.lakesideJourney(S6),W=p=>LJ.toWorld(p);
const scene={lakeYawDeg:LJ.yawDeg,lakeRoot:LJ.root,skyYawDeg:yaw,skyOff:sOff,repo:Jn.ROOT};
const c=W([2,0.6,45]);const shots=[{name:'top',res:[800,1000],cam:{position:[c[0],c[1]+200,c[2]+0.01],target:c,fov:40},ortho:90,vehicle:null,girl:{pos:S6,yawRad:0}},
 {name:'oblique',res:[800,1000],cam:{position:W([30,40,20]),target:W([2,5,55]),fov:45},vehicle:S6,girl:{pos:S6,yawRad:0}}];
require('fs').writeFileSync(process.argv[2],JSON.stringify({scene,shots}));
