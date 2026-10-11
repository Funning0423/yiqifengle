#!/usr/bin/env node
'use strict';
/* QA only (not shipped). T9 props vs camera path: runs 运镜bot's camera-frame-test (REAL WorldFlow + routes +
 * camera tracks, home -> island -> home incl. the T2+ crane panorama) twice over the same frames:
 *   A) island GLB only (baseline)            B) island GLB + T9 world props (signpost + palms, Draco-decoded,
 *      placed exactly as ISLAND_PROPS says)    (screen props are only shown in the settled island view)
 * and compares line of sight lens -> head (1.6 m) / chest (1.0 m) / feet (0.1 m) on every 2nd frame plus lens
 * clearance. FAIL if a T9 prop blocks the head or the chest on any sample, or the lens comes within 0.15 m of a prop.
 * Then re-runs the unmodified test_camera_frames.cjs with the props merged into its geometry (all checks must pass).
 * usage: node check_props_occlusion.cjs --camtest <dir of tools/camera-frame-test> [--json out.json] [--no-full]
 * draco3d 1.5.7: same lookup as the camera test (DRACO3D / vendor-node). */
const fs=require('fs'),path=require('path');
const args=process.argv.slice(2),opt=k=>args.includes(k)?args[args.indexOf(k)+1]:null;
const camtest=path.resolve(opt('--camtest')||path.resolve(__dirname,'../../../运镜bot/tools/camera-frame-test'));
const {load,ROOT}=require('./load_ts.cjs'),L=load(['world-r1/CameraPose','world-r2/IslandPropsLayout']).IslandPropsLayout,P=L.ISLAND_PROPS;
const G=require(path.join(camtest,'glb_geometry.cjs')),S=require(path.join(camtest,'flow_sim.cjs'));
const PROP_DIR=path.join(ROOT,'creator-build-project/assets/bundles/region_island',P.dir);
function place(meshes,p,tag){const a=p.yawDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),out={};
  for(const [name,tris] of Object.entries(meshes))out[tag+':'+name]=tris.map(t=>t.map(v=>[p.position[0]+p.scale*(v[0]*c+v[2]*s),p.position[1]+p.scale*v[1],p.position[2]+p.scale*(-v[0]*s+v[2]*c)]));return out;}
async function propsGeometry(){const out={};
  for(const p of [{...P.signpost},...P.palms]){const g=await G.decode(path.join(PROP_DIR,p.prefab+'.glb'));if(!g)return null;Object.assign(out,place(g.meshes,p,'T9'));}
  return out;}
(async()=>{
  const base=await G.decode();if(!base){console.log('SKIP draco3d not found');process.exit(2);}
  const extra=await propsGeometry();const merged={...base,meshes:{...base.meshes,...extra}};
  const IA=G.index(base),IB=G.index(merged);
  const env=S.create(),run=await S.run(env),F=run.frames;
  const parts=[['head',1.6],['chest',1.0],['feet',.1]];const res={baseline:{},withProps:{},newByProp:[],propClearance:{min:Infinity,frame:null,mesh:null}};
  const bump=(o,k)=>o[k]=(o[k]||0)+1;
  F.forEach((f,i)=>{if(i%2)return;const p=f.cam.position,r=f.root;
    for(const [part,h] of parts){const t=[r[0],r[1]+h,r[2]];const a=IA.occluded(p,t),b=IB.occluded(p,t);
      if(a)bump(res.baseline,f.state+':'+part+':'+a);if(b)bump(res.withProps,f.state+':'+part+':'+b);
      if(b&&b.startsWith('T9:'))res.newByProp.push({frame:i,t:+f.t.toFixed(3),state:f.state,part,mesh:b,baselineHit:a});}
    const c=IB.clearance(p);if(c.who&&c.who.startsWith('T9:')&&c.d<res.propClearance.min)res.propClearance={min:+c.d.toFixed(3),frame:i,mesh:c.who,state:f.state};});
  // a prop can also hide a part that the island already hid; count only parts that were visible in the baseline
  const blockingNew=res.newByProp.filter(o=>!o.baselineHit&&o.part!=='feet');
  const headChest=res.newByProp.filter(o=>o.part!=='feet');
  const ok=headChest.length===0&&!(res.propClearance.min<.15);
  const lines=[
    ['T9 props geometry', Object.keys(extra).join(', ')],
    ['frames', F.length+' @60fps, camera test '+path.relative(path.resolve(ROOT,'..'),camtest)],
    ['baseline head/chest occlusions', JSON.stringify(Object.fromEntries(Object.entries(res.baseline).filter(([k])=>!k.includes(':feet:'))))],
    ['with props head/chest occlusions', JSON.stringify(Object.fromEntries(Object.entries(res.withProps).filter(([k])=>!k.includes(':feet:'))))],
    ['prop hits head/chest (any)', headChest.length+(headChest.length?' first '+JSON.stringify(headChest.slice(0,4)):'')],
    ['prop hits on parts visible in baseline', blockingNew.length],
    ['prop hits feet', res.newByProp.filter(o=>o.part==='feet').length],
    ['min lens clearance to a prop (m)', String(res.propClearance.min)+(res.propClearance.mesh?' '+res.propClearance.mesh+' frame '+res.propClearance.frame:'')]];
  for(const [k,v] of lines)console.log((k+':').padEnd(42),v);
  console.log(ok?'PASS T9 props never block head/chest; lens clearance >= 0.15 m':'FAIL T9 props block head/chest or crowd the lens');
  if(opt('--json'))fs.writeFileSync(opt('--json'),JSON.stringify({ok,res,lines},null,1));
  let fullOk=true;
  if(!args.includes('--no-full')){ // unmodified camera test in a child process; preload merges the props into its geometry
    const r=require('child_process').spawnSync(process.execPath,['-r',path.join(__dirname,'merge_props_preload.cjs'),path.join(camtest,'test_camera_frames.cjs'),'--no-drag'],{env:{...process.env,T9_CAMTEST:camtest},encoding:'utf8'});
    const out=(r.stdout||'')+(r.stderr||'');for(const l of out.split('\n'))if(/^(PASS|FAIL|ALL PASS|FAILED|T9)/.test(l))console.log('  | '+l.slice(0,160));
    fullOk=r.status===0;console.log(fullOk?'PASS full camera test with T9 props merged':'FAIL full camera test with T9 props merged (exit '+r.status+')');}
  process.exit(ok&&fullOk?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
