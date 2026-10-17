// node gen.cjs <worktree> <W> <H> <view far|close>  -> scene json (stdout)
const wt=process.argv[2],W=+process.argv[3],H=+process.argv[4],view=process.argv[5];
const {load}=require(wt+'/tools/t9-island-props/load_ts.cjs');
const M=load(['world-r1/CameraPose','world-r1/RegionCameraData','world-r2/IslandPropsLayout']);
const C=M.CameraPose,L=M.IslandPropsLayout,P=L.ISLAND_PROPS;
const Rail=require(wt+'/tools/camera-frame-test/load_ts.cjs').load();
const cfg=Rail.FirstsliceRoutes.createFirstsliceRoutes(Rail.FirstsliceFacts.FIRSTSLICE,Rail.CharacterReference.CHARACTER_REFERENCE);
const rail=Rail.IslandRail.createIslandRail(cfg);rail.restore(view==='far'?1:0);const pose=rail.pose();
let PP=P;if(process.env.VB_OVR){const o=JSON.parse(process.env.VB_OVR);PP={...P,signpost:{...P.signpost,...(o.signpost||{})},palms:o.palms||P.palms};}
const aspect=W/H,S=PP.signpost,A='/tmp/vbsign/art/';
const rotY=(p,v)=>{const a=p.yawDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),k=p.scale;return [p.position[0]+k*(v[0]*c+v[2]*s),p.position[1]+k*v[1],p.position[2]+k*(-v[0]*s+v[2]*c)];};
const props=[{name:'signpost',glb:A+'ui_signpost.glb',pos:S.position,yaw:S.yawDeg,scale:S.scale}];
for(const p of PP.palms)props.push({name:p.prefab,glb:A+p.prefab+'.glb',pos:p.position,yaw:p.yawDeg,scale:p.scale});
const lay=L.propButtonLayout(W,H),tags=[];
for(const s of lay.slots){const b=P.buttons[s.role],[sx,sy]=L.uiToScreen(s.prop.x,s.prop.bottom,W,H);const a=L.seaAnchor(pose,aspect,sx,sy,s.prop.height,H,b.heightM);
  const ref=C.fromLookAt(M.RegionCameraData.islandPoseEntry());const sp=L.screenPropPose(pose,ref,aspect,sx,sy,s.prop.height,H,b);
  const qm=q=>{const [x,y,z,w]=q;return [[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];};
  const mul=(a,b)=>a.map((r,i)=>b[0].map((_,j)=>r[0]*b[0][j]+r[1]*b[1][j]+r[2]*b[2][j]));
  const Sd=[[sp.pivotScale[0],0,0],[0,sp.pivotScale[1],0],[0,0,sp.pivotScale[2]]];const R3=mul(mul(qm(sp.pivotRotation),Sd),qm(sp.localRotation));
  props.push({name:'btn_'+s.role,glb:A+b.prefab+'.glb',mcc:[...R3.map((r,i)=>[...r,sp.point[i]]),[0,0,0,1]]});tags.push({...s.tag,label:b.label});}
const T=S.text,tw=T.widthM*0.9/2,th=T.heightM*0.8/2,c=T.center;
const quad=[[c[0]-tw,c[1]+th,c[2]],[c[0]+tw,c[1]+th,c[2]],[c[0]+tw,c[1]-th,c[2]],[c[0]-tw,c[1]-th,c[2]]].map(v=>rotY(S,v));
const plate=S.plate?(()=>{const pw=S.plate.widthM/2,ph=S.plate.heightM/2,z=c[2]+0.005;return [[c[0]-pw,c[1]+ph,z],[c[0]+pw,c[1]+ph,z],[c[0]+pw,c[1]-ph,z],[c[0]-pw,c[1]-ph,z]].map(v=>rotY(S,v));})():null;
// post foot points (sign-local x of the two legs, from water.postsX), for ground checks
const feet=S.water.postsX.map(x=>rotY(S,[x,0,0]));
const q=pose.rotation;
console.log(JSON.stringify({island:wt+'/creator-project/assets/firstslice/combined_visual_m.glb',hide:['_night_v22','env_interior','character_height','floor_skirt'],
 props,chars:[{glb:wt+'/creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb',pos:[-2.1135,0,5.2814],yaw:0}],
 camera:{pos:pose.position,quat:q,fov:pose.fovVerticalDeg},res:[W,H],view,night:!!process.env.NIGHT,legs:S.legs||null,text:{quad,string:T.string,color:(S.plate?S.plate.text:(process.env.NIGHT&&T.nightColor?T.nightColor:T.color)),outlinePx:T.outlinePx||0},plate,plateStyle:S.plate||null,feet,
 signRectUi:view==='far'?L.signpostRectUi(pose,W,H):null,tags,sign:{position:S.position,yaw:S.yawDeg,scale:S.scale},palms:PP.palms}));
