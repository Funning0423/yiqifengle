'use strict';
/** T9 island props (GGbot, work/GGbot-t9 0ec1701 = final T9) merged into the decoded island geometry for occlusion and
 * clearance tests. Positions/scales copied from 0ec1701 world-r2/IslandPropsLayout.ts (ISLAND_PROPS). Prop GLBs come
 * from T9_ROOT/<bundle>/ui-props when set, else straight from the git object store (`git show 0ec1701:<path>`), so the
 * test works in any worktree of this repo. Placement = GGbot's check_props_occlusion.cjs (yaw about +Y, uniform scale,
 * translate). Returns null when the props cannot be read (tests then report 'T9 props NOT loaded'). Note: T9 hides the
 * signpost during the fly-to-island segment; it is still included (conservative). */
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),G=require('./glb_geometry.cjs');
const T9_SHA='0ec1701',ROOT=path.resolve(__dirname,'..','..'),REL='creator-build-project/assets/bundles/region_island/ui-props';
const PROPS=[{prefab:'ui_signpost',position:[-4.38,-0.02,1.25],yawDeg:2,scale:1.0},
  {prefab:'beach_palm_tall',position:[-3.3,0.05,6.6],yawDeg:60,scale:0.75},{prefab:'beach_palm_short',position:[7.0,-0.36,7.4],yawDeg:180,scale:1}];
function dir(){return process.env.T9_ROOT?path.join(process.env.T9_ROOT,REL):'git:'+T9_SHA+':'+REL;}
function glbFile(prefab){
  if(process.env.T9_ROOT){const f=path.join(process.env.T9_ROOT,REL,prefab+'.glb');return fs.existsSync(f)?f:null;}
  const out=path.join(os.tmpdir(),'t9-'+T9_SHA+'-'+prefab+'.glb');if(fs.existsSync(out))return out;
  try{fs.writeFileSync(out,cp.execFileSync('git',['-C',ROOT,'show',T9_SHA+':'+REL+'/'+prefab+'.glb'],{maxBuffer:1<<26,stdio:['ignore','pipe','ignore']}));return out;}catch(e){return null;}}
async function merged(base){const out={};
  for(const p of PROPS){const f=glbFile(p.prefab);if(!f)return null;const g=await G.decode(f);if(!g)return null;
    const a=p.yawDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    for(const [name,tris] of Object.entries(g.meshes))out['T9:'+name]=tris.map(t=>t.map(v=>[p.position[0]+p.scale*(v[0]*c+v[2]*s),p.position[1]+p.scale*v[1],p.position[2]+p.scale*(-v[0]*s+v[2]*c)]));}
  return {...base,meshes:{...base.meshes,...out}};}
module.exports={merged,PROPS,T9_SHA,dir};
