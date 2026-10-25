'use strict';
// 运镜bot cand7 D (d3fe578e P2): entering L9 (after the balloon) and L10, the balloon cloud-sea close-up cut to the board.
// regionBoardHandoff hands the live world lens to the skycity board pose BEFORE regionLandingToBoard, so the hook then finds the
// lens on-pose (exact write, push-in held) and the board camera takes over at the identical pose. Checked per screen (7):
//  * first write within one capped frame of the live lens (no jump), last write = board pose exactly; hook after it: 'on-board-pose'
//  * written view yaw ≤ 90°/s, p99 yaw accel ≤ 200°/s²; lens step ≤ blendLensMS/60·1.05; FOV / pitch rate caps
//  * lens clearance ≥ 1.1 m from env_skycity geometry over the whole blend (journey copy, world)
//  * L10: a second entry from the board pose = 'near', no write (the hook's exact path)
//  * wiring: composition calls it for skycity before the landing hook, unchanged hook regex intact.
const fs=require('fs');const Jn=require('./journey-scene.cjs');const {rotY,add,sub,sOff,yaw,sA,H,S,sky,clearance}=Jn;
const RB=H.load(S+'region/RegionBoardLanding.ts'),TC=H.load(S+'region/TransitionCamera.ts');
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const src={region:'skycity',map:{toJourney:p=>add(rotY(yaw,p),sOff),toBoard:p=>rotY(-yaw,sub(p,sOff))},anchors:{spawn:sA('anchor_spawn_girl'),court:sA('anchor_starcourt_center')}};
const her=add(rotY(yaw,[5.25,-0.084,40.6]),sOff);
const starts={exitLens:{position:add(her,[2.6,1.7,2.4]),target:add(her,[0,1.1,0]),fovVerticalDeg:48},
 cloudSea:{position:[18.6,20.4,99.2],target:[28,19.2,90],fovVerticalDeg:48}};
let fail=0;const rows=[];const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m);}};
(async()=>{
for(const [w,h] of SCREENS)for(const [name,from] of Object.entries(starts)){
 let cam=from;const writes=[];const deps={readCamera:()=>cam,setCamera:p=>{cam=p;writes.push(p);return true;},nextFrame:async()=>1/60,viewport:()=>({width:w,height:h}),boardPose:v=>RB.regionBoardPose(src,v.width/v.height,v)};
 const r=await RB.regionBoardHandoff({region:'skycity',stageId:'mainline-09',deps});const to=deps.boardPose({width:w,height:h});
 ok(r.ok&&r.result==='handed',`${w}x${h} ${name} ${JSON.stringify(r)}`);
 const g0=RB.poseGap(from,writes[0]),gl=RB.poseGap(writes.at(-1),to);
 ok(g0.positionM<=TC.TRANSITION_CAM.blendLensMS/60*1.05&&g0.viewDeg<=1.6,`${w}x${h} ${name} first jump ${JSON.stringify(g0)}`);
 ok(gl.positionM<1e-9&&gl.viewDeg<1e-6,`${w}x${h} last != board`);
 const yw=[from,...writes].map(p=>TC.viewOf(p).yaw),rate=[],acc=[];let step=0,minC=9,who=null;
 for(let i=1;i<yw.length;i++)rate.push(TC.wrap(yw[i]-yw[i-1])*60);for(let i=1;i<rate.length;i++)acc.push(Math.abs(rate[i]-rate[i-1])*60);
 const all=[from,...writes];for(let i=1;i<all.length;i++)step=Math.max(step,Math.hypot(...sub(all[i].position,all[i-1].position)));
 for(let i=0;i<all.length;i+=3){const [c,o]=clearance(all[i].position,sky,3);if(c<minC){minC=c;who=o;}}
 const yMax=Math.max(...rate.map(Math.abs)),a=acc.sort((x,y)=>x-y),p99=a[Math.floor(a.length*.99)]||0;
 ok(yMax<=90.01,`${w}x${h} ${name} yaw ${yMax}`);ok(p99<=200,`${w}x${h} ${name} acc p99 ${p99}`);ok(step<=TC.TRANSITION_CAM.blendLensMS/60*1.05,`${w}x${h} ${name} step ${step}`);ok(minC>=1.1,`${w}x${h} ${name} clearance ${minC} ${who}`);
 const hook=await RB.regionLandingToBoard({region:'skycity',stageId:'mainline-09',deps});ok(hook.ok&&hook.result==='on-board-pose',`${w}x${h} hook ${hook.result}`);
 const n=writes.length,r10=await RB.regionBoardHandoff({region:'skycity',stageId:'mainline-10',deps});ok(r10.result==='near'&&writes.length===n,`${w}x${h} L10 ${r10.result}`);
 rows.push({screen:`${w}x${h}`,start:name,gapM:+RB.poseGap(from,to).positionM.toFixed(2),gapDeg:+RB.poseGap(from,to).viewDeg.toFixed(1),seconds:+(writes.length/60).toFixed(2),yawMaxDegS:+yMax.toFixed(1),yawAccP99:+p99.toFixed(0),stepM:+step.toFixed(3),clearM:+minC.toFixed(2),hook:hook.result,L10:r10.result});}
const co=fs.readFileSync(S+'world-r2/WorldNativeComposition.ts','utf8').replace(/\s+/g,' ');
ok(/if\(region==='skycity'\)\{const deps=this\.regionLandingDeps\(region\);if\(deps&&requiresSkycityScene\(selection\)\)await regionBoardHandoff\(/.test(co)&&co.indexOf('regionBoardHandoff({')<co.indexOf('regionLandingToBoard({region'),'wiring');
console.table(rows);const out={status:fail?'FAIL':'PASS',rows};fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/board-handoff.json',JSON.stringify(out,null,1)+'\n');
console.log(JSON.stringify({status:out.status}));process.exit(fail?1:0);})();
