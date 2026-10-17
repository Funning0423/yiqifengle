process.chdir('/tmp/wt-art/tools/journey-integration');
const J=require('/tmp/wt-art/tools/journey-integration/journey-scene.cjs'),{H,S}=J;
const LK=H.load(S+'region/LakesideCameraLayout.ts'),BL=H.load(S+'ui/BoardLayout.ts'),CP=H.load(S+'world-r1/CameraPose.ts');
const fs=require('fs');
function glbBounds(f){const b=fs.readFileSync(f),l=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+l));const a=j.accessors[j.meshes[0].primitives[0].attributes.POSITION];return [a.min,a.max];}
const [mn,mx]=glbBounds('/tmp/wt-art/creator-build-project/assets/bundles/region_lakeside/models/LK_pavilion.glb');
const corners=[];for(const x of [mn[0],mx[0]])for(const y of [mn[1],mx[1]])for(const z of [mn[2],mx[2]])corners.push([x,y,z]);
const out={};
for(const [name,W,Hh,safe] of [['390x844',390,844,{top:47,bottom:34,left:0,right:0,capsule:{left:281,top:51,right:368,bottom:83}}],['360x640',360,640,{top:0,bottom:0,left:0,right:0,capsule:null}],['360x780',360,780,{top:0,bottom:0,left:0,right:0,capsule:null}]]){
 const g=BL.boardLayout(W,Hh,safe,2),frame={width:W,height:Hh,boardTop:g.tray.y-g.tray.height/2,board:{x:g.grid.x,y:g.grid.y,size:g.grid.size}};
 const pose=LK.lakesideAlignedBoardPose(frame),a=W/Hh;
 const proj=(p)=>{const q=CP.projectPoint(pose,a,p);return {x:+((q.x+1)/2).toFixed(3),y:+((1-q.y)/2).toFixed(3),depth:+q.depth.toFixed(2)};};
 const real=corners.map(c=>proj([c[0]+13.6,c[1]+0.55,c[2]-4.6])),tpl=corners.map(c=>proj(c));
 const inside=ps=>ps.some(p=>p.depth>0&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
 out[name]={pose:{position:pose.position,fov:pose.fovVerticalDeg},real_pavilion_uv_min_x:Math.min(...real.map(p=>p.x)),real_in_frame:inside(real),template_at_origin_uv_center:proj([0,2,0]),template_in_frame:inside(tpl)};}
console.log(JSON.stringify({bounds:[mn,mx],out},null,1));
