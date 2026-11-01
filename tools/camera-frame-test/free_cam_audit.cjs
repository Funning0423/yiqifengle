'use strict';
/* QA-only (not shipped). Y2 free-camera audit (运镜bot, 2026-10-18).
 * For every free-look region, sweeps an orbit grid (world azimuth x pitch x distance) around the girl's walk points on the
 * COMMITTED region GLBs and reports, per cell: lens clearance (sphere, >= 1.1 m), lens-near-geometry (frustum rays, first
 * hit >= 1.1 m), line of sight to head/chest, push-in distance, framing on 390x844 / 360x780 / 768x1024 (body fully inside
 * the HUD-free band, >= 13 pt gap to the bottom UI, height >= 12 % of the screen), void (rays below the horizon that hit
 * nothing = map edge), back faces (rays that hit the back of a single-sided mesh = 露帮/穿墙/岛底).
 * Room: fixed lens at cameraHome (RoomLook), yaw/pitch only, view rays >= 0.45 m (room-look-clearance standard).
 * Also writes one low-res safety map + one 8-azimuth CPU ray-cast mosaic per region (no Blender).
 *   node tools/camera-frame-test/free_cam_audit.cjs [--out DIR] [--only island,meadow] [--json results.json]
 * Needs draco3d 1.5.7 (DRACO3D=<dir>) for the island/room and skycity GLBs, typescript (QF_TYPESCRIPT_MODULE) for the TS data,
 * python3 + Pillow for PNG output. Convention: azimuth a (deg) puts the lens at pivot + d*[cos(p) sin(a), sin(p), cos(p) cos(a)];
 * a = 0 is the +Z side of her looking toward -Z; p > 0 = lens above, looking down. */
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const ROOT=path.resolve(__dirname,'../..'),SCRIPTS=path.join(ROOT,'creator-build-project/assets/scripts'),BUNDLES=path.join(ROOT,'creator-build-project/assets/bundles');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const OUT=arg('--out','/workspace/yiqifengle/previews/运镜bot/free-camera-spec'),ONLY=(arg('--only','')||'').split(',').filter(Boolean);
fs.mkdirSync(OUT,{recursive:true});
// ---- TS data (real sources, transpiled on require) ----
function tsModule(){const c=[process.env.QF_TYPESCRIPT_MODULE,'/tmp/qfts/node_modules/typescript','/exec-daemon/node_modules/typescript','typescript'].filter(Boolean);
  for(const p of c){try{return require(p);}catch(e){}}throw Error('typescript not found (QF_TYPESCRIPT_MODULE)');}
const TS=tsModule();
require.extensions['.ts']=(m,f)=>{m._compile(TS.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:TS.ModuleKind.CommonJS,target:TS.ScriptTarget.ES2020}}).outputText,f);};
const req=p=>require(path.join(SCRIPTS,p+'.ts'));
const {REGION_NODES}=req('region/RegionNodes'),EC=req('region/ExploreCameraCore'),RC=req('world-r1/RegionCameraData'),TL=req('region/TransportLeg'),LK=req('region/LakesideCameraLayout');
const {ROOM_LOOK}=req('world-r1/RoomLook');
// ---- geometry ----
const {decode:dracoDecode}=require('./glb_geometry.cjs');
function readGlb(f){const raw=fs.readFileSync(f),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString()),o=20+jl+8;return {doc,bin:raw.subarray(o,o+raw.readUInt32LE(20+jl))};}
const m4mul=(A,B)=>{const C=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)C[c*4+r]+=A[k*4+r]*B[c*4+k];return C;};
const trs=n=>{if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];
  return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];};
const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
/** Plain (non-draco) GLB: world triangles per node name, TRIANGLES mode, skins ignored (meadow/lakeside/sail have none). */
function plainDecode(f){const {doc,bin}=readGlb(f),parent={},meshes={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parent[c]=i));
  const glob=i=>{let M=trs(doc.nodes[i]);for(let k=parent[i];k!==undefined;k=parent[k])M=m4mul(trs(doc.nodes[k]),M);return M;};
  const acc=(ai)=>{const A=doc.accessors[ai],bv=doc.bufferViews[A.bufferView],o=(bv.byteOffset||0)+(A.byteOffset||0),n=A.count,comp={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[A.type],
    sz={5126:4,5125:4,5123:2,5121:1}[A.componentType],stride=bv.byteStride||sz*comp,out=[];
    for(let i=0;i<n;i++)for(let c=0;c<comp;c++){const p=o+i*stride+c*sz;out.push(A.componentType===5126?bin.readFloatLE(p):A.componentType===5125?bin.readUInt32LE(p):A.componentType===5123?bin.readUInt16LE(p):bin.readUInt8(p));}return out;};
  doc.nodes.forEach((node,i)=>{if(node.mesh===undefined)return;const M=glob(i),tris=[];
    for(const pr of doc.meshes[node.mesh].primitives){if(pr.mode!==undefined&&pr.mode!==4)continue;if(pr.attributes.POSITION===undefined)continue;
      const P=acc(pr.attributes.POSITION),V=[];for(let k=0;k<P.length;k+=3)V.push(xf(M,[P[k],P[k+1],P[k+2]]));
      const I=pr.indices!==undefined?acc(pr.indices):V.map((_,k)=>k);for(let k=0;k+2<I.length;k+=3)tris.push([V[I[k]],V[I[k+1]],V[I[k+2]]]);}
    if(tris.length)meshes[node.name]=(meshes[node.name]||[]).concat(tris);});
  return {meshes};}
/** Classes: 0 ignored (sky, clouds, fx, glass, gull flyers, grass instances), 1 visual-only (sea/water/far cards: seen, not solid),
 *  2 solid. Back faces are reported only for meshes that are NOT plausibly double-sided cards. */
const IGNORE=/(sky_dome|skydome|env_cloud_layer|meadow_clouds|env_sky_cloud_small|env_sky_cumulus|^fx_|beam|glow|moon|smoke|seagull_fly|env_sky_birds|glass|blind_cards|starring|_stars|mist|halo|grass_instances|flower_instances|env_lighthouse_door$)/i;
const VISUAL=/(cloud|cumulus|sea_|_sea|^sea|foam|wave_line|river$|river_bank|lake|water|islets_far|far_hills|far_shore|far_cards|tide_pools|wet_sand)/i;
/** Every committed material is glTF doubleSided EXCEPT env_interior_shell (checked 2026-10-18), and the merged props have mixed
 *  winding, so a generic back-face test is noise. Back faces are counted only on the single-sided room shell (= the lens or the
 *  frustum is outside the room). Underside = a ray going UP that meets a near-horizontal GROUND surface (terrain / island
 *  rock / sky-island strata): the lens is below the ground it looks at (岛底 / 地形下面). */
const SHELL=/interior_shell/i,GROUND=/(terrain|island_main|rock_strata|static_palette|LK_terrain|floatingrocks)/i;
function cls(name){if(VISUAL.test(name))return 1;if(IGNORE.test(name))return 0;return 2;}
function buildIndex(meshes,cell){const names=[],tri=[],tcls=[],tname=[],two=[],gnd=[];
  for(const name of Object.keys(meshes)){const c=cls(name);if(!c)continue;const ni=names.push(name)-1;for(const t of meshes[name]){tri.push(...t[0],...t[1],...t[2]);tcls.push(c);tname.push(ni);two.push(SHELL.test(name)?0:1);gnd.push(GROUND.test(name)?1:0);}}
  const T=Float32Array.from(tri),N=tcls.length,grid=new Map(),key=(i,j,k)=>(i+4096)*67108864+(j+4096)*8192+(k+4096);
  let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  for(let t=0;t<N;t++){const b=t*9,mn=[0,1,2].map(a=>Math.min(T[b+a],T[b+3+a],T[b+6+a])),mx=[0,1,2].map(a=>Math.max(T[b+a],T[b+3+a],T[b+6+a]));
    for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],mn[a]);hi[a]=Math.max(hi[a],mx[a]);}
    for(let i=Math.floor(mn[0]/cell);i<=Math.floor(mx[0]/cell);i++)for(let j=Math.floor(mn[1]/cell);j<=Math.floor(mx[1]/cell);j++)for(let k=Math.floor(mn[2]/cell);k<=Math.floor(mx[2]/cell);k++){const kk=key(i,j,k);let a=grid.get(kk);if(!a)grid.set(kk,a=[]);a.push(t);}}
  const stamp=new Int32Array(N);let gen=0;
  function triHit(t,o,d,tmax){const b=t*9,ax=T[b],ay=T[b+1],az=T[b+2],e1x=T[b+3]-ax,e1y=T[b+4]-ay,e1z=T[b+5]-az,e2x=T[b+6]-ax,e2y=T[b+7]-ay,e2z=T[b+8]-az;
    const hx=d[1]*e2z-d[2]*e2y,hy=d[2]*e2x-d[0]*e2z,hz=d[0]*e2y-d[1]*e2x,det=e1x*hx+e1y*hy+e1z*hz;if(Math.abs(det)<1e-12)return -1;
    const f=1/det,sx=o[0]-ax,sy=o[1]-ay,sz=o[2]-az,u=f*(sx*hx+sy*hy+sz*hz);if(u<0||u>1)return -1;const qx=sy*e1z-sz*e1y,qy=sz*e1x-sx*e1z,qz=sx*e1y-sy*e1x,v=f*(d[0]*qx+d[1]*qy+d[2]*qz);
    if(v<0||u+v>1)return -1;const tt=f*(e2x*qx+e2y*qy+e2z*qz);return tt>1e-4&&tt<tmax?tt:-1;}
  /** First hit along unit d within tmax. minCls 1 = visual+solid, 2 = solid only. -> {t,name,back,cls} | null. 3D DDA. */
  function ray(o,d,tmax=150,minCls=1){gen++;let i=Math.floor(o[0]/cell),j=Math.floor(o[1]/cell),k=Math.floor(o[2]/cell);
    const st=[d[0]>0?1:-1,d[1]>0?1:-1,d[2]>0?1:-1],idx=[i,j,k],tD=[0,1,2].map(a=>Math.abs(d[a])<1e-12?1e30:cell/Math.abs(d[a])),
      tM=[0,1,2].map(a=>{if(Math.abs(d[a])<1e-12)return 1e30;const nb=(idx[a]+(st[a]>0?1:0))*cell;return (nb-o[a])/d[a];});
    let best=tmax,bt=-1,tc=0;
    for(let s=0;s<4000&&tc<=best;s++){
      if(idx[0]*cell<lo[0]-cell&&st[0]<0||idx[0]*cell>hi[0]+cell&&st[0]>0||idx[1]*cell<lo[1]-cell&&st[1]<0||idx[1]*cell>hi[1]+cell&&st[1]>0||idx[2]*cell<lo[2]-cell&&st[2]<0||idx[2]*cell>hi[2]+cell&&st[2]>0)break;
      const a=grid.get(key(idx[0],idx[1],idx[2]));
      if(a)for(const t of a){if(stamp[t]===gen||tcls[t]<minCls)continue;stamp[t]=gen;const h=triHit(t,o,d,best);if(h>0){best=h;bt=t;}}
      const ax=tM[0]<tM[1]?(tM[0]<tM[2]?0:2):(tM[1]<tM[2]?1:2);tc=tM[ax];idx[ax]+=st[ax];tM[ax]+=tD[ax];}
    if(bt<0)return null;const b=bt*9,e1=[T[b+3]-T[b],T[b+4]-T[b+1],T[b+5]-T[b+2]],e2=[T[b+6]-T[b],T[b+7]-T[b+1],T[b+8]-T[b+2]],n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],nl=Math.hypot(...n)||1;
    const dn=(n[0]*d[0]+n[1]*d[1]+n[2]*d[2])/nl;const ny=Math.abs(n[1]/nl);return {t:best,name:names[tname[bt]],back:dn>0&&!two[bt],under:!!gnd[bt]&&d[1]>0.05&&ny>0.7,cls:tcls[bt],shade:Math.abs(dn)};}
  function closestD(p,a,b,c){/* point-triangle distance (Ericson) */const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]],dt=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
    const d1=dt(ab,ap),d2=dt(ac,ap);let q;if(d1<=0&&d2<=0)q=a;else{const bp=[p[0]-b[0],p[1]-b[1],p[2]-b[2]],d3=dt(ab,bp),d4=dt(ac,bp);if(d3>=0&&d4<=d3)q=b;else{const vc=d1*d4-d3*d2;
    if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);q=[a[0]+ab[0]*v,a[1]+ab[1]*v,a[2]+ab[2]*v];}else{const cp=[p[0]-c[0],p[1]-c[1],p[2]-c[2]],d5=dt(ab,cp),d6=dt(ac,cp);if(d6>=0&&d5<=d6)q=c;else{const vb=d5*d2-d1*d6;
    if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);q=[a[0]+ac[0]*w,a[1]+ac[1]*w,a[2]+ac[2]*w];}else{const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));q=[b[0]+(c[0]-b[0])*w,b[1]+(c[1]-b[1])*w,b[2]+(c[2]-b[2])*w];}
    else{const den=1/(va+vb+vc),v=vb*den,w=vc*den;q=[a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w];}}}}}}return Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);}
  /** Nearest SOLID triangle within R of p -> {d,name}. */
  function clearance(p,R=1.1){gen++;let best=R,who=null;const r=Math.ceil(R/cell),c=p.map(v=>Math.floor(v/cell));
    for(let i=c[0]-r;i<=c[0]+r;i++)for(let j=c[1]-r;j<=c[1]+r;j++)for(let k=c[2]-r;k<=c[2]+r;k++){const a=grid.get(key(i,j,k));if(!a)continue;
      for(const t of a){if(stamp[t]===gen||tcls[t]<2)continue;stamp[t]=gen;const b=t*9;const d=closestD(p,[T[b],T[b+1],T[b+2]],[T[b+3],T[b+4],T[b+5]],[T[b+6],T[b+7],T[b+8]]);if(d<best){best=d;who=names[tname[t]];}}}
    return {d:best,who};}
  return {ray,clearance,triangles:N,meshes:names.length,lo,hi};}
// ---- camera maths ----
const R2D=180/Math.PI,D2R=Math.PI/180,unit=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);},crossV=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const orbitDir=(az,p)=>[Math.cos(p*D2R)*Math.sin(az*D2R),Math.sin(p*D2R),Math.cos(p*D2R)*Math.cos(az*D2R)];
function basis(fwd){const f=unit(fwd),r=unit(crossV(f,[0,1,0])),u=crossV(r,f);return {f,r,u};}
function frustumRays(fwd,fovV,aspect,cols,rows){const {f,r,u}=basis(fwd),th=Math.tan(fovV*D2R/2),out=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const sx=((x+.5)/cols*2-1)*th*aspect,sy=(1-(y+.5)/rows*2)*th;out.push(unit([f[0]+r[0]*sx+u[0]*sy,f[1]+r[1]*sx+u[1]*sy,f[2]+r[2]*sx+u[2]*sy]));}return out;}
/** Screens (pt). topPt = capsule bottom (~88 pt phones, 64 pt pad) + 4 % H; bottomPt = 64 pt bottom UI row + 13 pt gap (UI_GAP_PT). */
const SCREENS=[{w:390,h:844,top:88,bot:64},{w:360,h:780,top:86,bot:64},{w:768,h:1024,top:64,bot:72}];
function framing(cam,fwd,fov,feet){const {f,r,u}=basis(fwd),th=Math.tan(fov*D2R/2);const res=[];
  for(const s of SCREENS){const asp=s.w/s.h,pr=p=>{const v=[p[0]-cam[0],p[1]-cam[1],p[2]-cam[2]],z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2];return {x:(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*asp),y:(v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/(z*th),z};};
    const head=pr([feet[0],feet[1]+EC.BODY_M,feet[2]]),foot=pr(feet),topN=1-2*(s.top+0.04*s.h)/s.h,botN=-1+2*(s.bot+EC.UI_GAP_PT)/s.h,frac=(head.y-foot.y)/2;
    res.push({ok:head.z>0.3&&foot.z>0.3&&head.y<=topN&&foot.y>=botN&&Math.abs(head.x)<=0.9&&Math.abs(foot.x)<=0.9&&frac>=EC.MIN_BODY_SCREEN,frac,headY:head.y,footY:foot.y});}
  return res;}
// ---- region definitions ----
function lakesideMeshes(){const S=JSON.parse(fs.readFileSync(path.join(BUNDLES,'region_lakeside/scene_r5h_slim_transforms.json'),'utf8')),cache={},out={};
  for(const ins of S.instances){const f=path.join(BUNDLES,'region_lakeside/models',ins.glb);if(!fs.existsSync(f))continue;const g=cache[ins.glb]||(cache[ins.glb]=plainDecode(f));
    const M=trs({translation:ins.pos,rotation:ins.rot_quat_xyzw,scale:ins.scale});for(const n of Object.keys(g.meshes)){const key=ins.glb.replace('.glb','')+':'+n;(out[key]=out[key]||[]).push(...g.meshes[n].map(t=>t.map(v=>xf(M,v))));}}
  return out;}
function pathPivots(region,keys){const G=REGION_NODES[region],pts=[];for(const n of G.nodes)if(!keys||keys.includes(n.key))pts.push({id:n.key,at:n.at,faceDeg:n.faceDeg});
  for(const e of G.edges){if(keys)continue;const m=e.path[Math.floor(e.path.length/2)];pts.push({id:e.a+'-'+e.b,at:m,faceDeg:null});}return pts;}
const F=EC.FOLLOW,DEF={dist:+Math.hypot(Math.hypot(F.backM,F.sideM),F.upM-1.2).toFixed(2),pitch:+(Math.atan2(F.upM-1.2,Math.hypot(F.backM,F.sideM))*R2D).toFixed(1),
  relYaw:+(Math.atan2(F.sideM,-F.backM)*R2D).toFixed(1),fov:F.fovDeg,pivotH:1.2};
/** Push-in below 4.3 m widens the FOV linearly to 60 deg at 3.0 m so her body stays inside the HUD band (CAMERA_FIXED 30..75). */
const fovAt=d=>d>=4.3?DEF.fov:DEF.fov+(4.3-Math.max(3,d))/1.3*12;
const ORB={dists:[3,3.5,4.3,5,6,DEF.dist,9,11],dDef:DEF.dist,dMin:3,fov:DEF.fov,fovAt,pivotH:DEF.pivotH};
async function regions(){const room=await dracoDecode(path.join(BUNDLES,'static_seat_preview/room/room_no_original_chair.glb'));if(!room)throw Error('draco3d not found: set DRACO3D');
  const R=[];
  R.push({id:'room',kind:'pan',meshes:room.meshes,cell:0.25,home:RC.homePoseEntry()});
  R.push({id:'island',kind:'orbit',mosaicPivot:'I4-I5',meshes:room.meshes,cell:0.5,pivots:pathPivots('island'),box:REGION_NODES.island.exploreBox,params:ORB});
  R.push({id:'meadow',kind:'orbit',mosaicPivot:'M3',meshes:plainDecode(path.join(BUNDLES,'region_meadow/env_meadow.glb')).meshes,cell:1,pivots:pathPivots('meadow'),box:REGION_NODES.meadow.exploreBox,params:ORB});
  const sky=await dracoDecode(path.join(BUNDLES,'region_skycity/env_skycity.glb'));
  R.push({id:'skycity',kind:'orbit',mosaicPivot:'S5',meshes:sky.meshes,cell:1,pivots:pathPivots('skycity'),box:REGION_NODES.skycity.exploreBox,params:ORB});
  const L=LK.LAKESIDE_CAMERA_LAYOUT;R.push({id:'lakeside',kind:'orbit',meshes:lakesideMeshes(),cell:1,pivots:[L.landingLocal,...L.walkLocal].map((p,i)=>({id:'L'+i,at:p,faceDeg:0})),params:ORB});
  // Sail: island (world) + meadow rotated 180 about Y at sailMeadowRoot (SailShot.startSailShot). Pivot = boat + 1.05 (sailCamera target).
  const root=TL.sailMeadowRoot(),mw=plainDecode(path.join(BUNDLES,'region_meadow/env_meadow.glb')).meshes,sailM={};
  for(const n of Object.keys(room.meshes))if(!/^env_(interior|int_anim|rear_window)/.test(n))sailM['island:'+n]=room.meshes[n];
  for(const n of Object.keys(mw))if(!/meadow_far_hills|sky_dome/.test(n))sailM['meadow:'+n]=mw[n].map(t=>t.map(v=>TL.rotY180(v,root)));
  const route=TL.sailRoute(),tl=TL.sailBeats(route.length),piv=[];
  for(const b of tl.beats)if(/S-[b-g]/.test(b.id)){const v=TL.sailVehicle(tl,route.samples,(b.t0+b.t1)/2);piv.push({id:b.id,at:[v.pos[0],v.pos[1],v.pos[2]],faceDeg:v.yaw*R2D,boat:true});}
  const boatG=plainDecode(path.join(BUNDLES,'transport_sail/sailboat.glb')).meshes;delete boatG.lantern_glow;delete boatG.pennant_flag;
  const BI=buildIndex(Object.fromEntries(Object.entries(boatG).map(([k,v])=>['boat_'+k,v])),0.25);
  R.push({id:'sail',kind:'orbit',meshes:sailM,cell:1.5,pivots:piv,sea:TL.SAIL_SEA_Y,params:{boat:true,boatIndex:BI,boatPivot:[0,1.05,0],boatTargets:[[0,1.25,-0.55],[0,0.85,-0.55]],hullM:7.2,
    dists:[7.2,8.5,10,11.3,12.4,14,16],dDef:12.4,dMin:7.2,fov:52,pivotH:1.05}});
  return R;}
// ---- audits ----
const AZ=[],PITCH=[];for(let a=0;a<360;a+=10)AZ.push(a);for(let p=-10;p<=75;p+=5)PITCH.push(p);
const RANK=['ok','push','near','frame','void','under','shell','block'];
/** Boat frame (TransportLeg.sailCamera): forward f=[sin yaw,0,cos yaw], local +X = port = r=[cos yaw,0,-sin yaw]. */
const boatToWorld=(yaw,l)=>{const f=[Math.sin(yaw),0,Math.cos(yaw)],r=[f[2],0,-f[0]];return [r[0]*l[0]+f[0]*l[2],l[1],r[2]*l[0]+f[2]*l[2]];};
function auditOrbit(reg,I){const P=reg.params,clear=1.1,cells=[];
  for(const p of PITCH)for(const a of AZ){const per=[];
    for(const pv of reg.pivots){const feet=pv.at;let piv,u,boatLocal=null;
      if(P.boat){const yaw=pv.faceDeg*D2R,lp=P.boatPivot;piv=boatToWorld(yaw,lp).map((v,i)=>v+feet[i]);boatLocal=orbitDir(a,p);u=boatToWorld(yaw,boatLocal);}
      else{piv=[feet[0],feet[1]+P.pivotH,feet[2]];u=orbitDir(a,p);}
      const hit=I.ray(piv,u,60,2),tFree=hit?hit.t:60;let dOk=null;const why=[];
      for(let k=P.dists.length-1;k>=0;k--){const d=P.dists[k];if(d>P.dDef+1e-6)continue;const cam=[piv[0]+u[0]*d,piv[1]+u[1]*d,piv[2]+u[2]*d];
        if(d>tFree-clear){why.push('ray:'+(hit&&hit.name));continue;}
        if(P.boat){const lc=P.boatPivot.map((v,i)=>v+boatLocal[i]*d);if(Math.hypot(lc[0],lc[2])<P.hullM){why.push('hull');continue;}if(cam[1]<reg.sea+clear){why.push('sea');continue;}
          const blk=P.boatTargets.map(t=>{const v=[t[0]-lc[0],t[1]-lc[1],t[2]-lc[2]],L=Math.hypot(...v),r=P.boatIndex.ray(lc,v.map(x=>x/L),L-0.15,2);return r&&r.name;}).filter(Boolean);
          if(blk.length){why.push('boat:'+blk[0]);continue;}}
        const c=I.clearance(cam,clear);if(c.d<clear){why.push('clear:'+c.who);continue;}
        if(!P.boat){const los=[1.1,1.6].map(h=>{const tg=[feet[0],feet[1]+h,feet[2]],v=[tg[0]-cam[0],tg[1]-cam[1],tg[2]-cam[2]],L=Math.hypot(...v),r=I.ray(cam,v.map(x=>x/L),L-0.3,2);return r&&r.name;}).filter(Boolean);
          if(los.length){why.push('los:'+los[0]);continue;}}
        dOk=d;break;}
      const dUse=dOk||P.dMin,cam=[piv[0]+u[0]*dUse,piv[1]+u[1]*dUse,piv[2]+u[2]*dUse],fwd=[-u[0],-u[1],-u[2]];
      const fovU=P.fovAt?P.fovAt(dUse):P.fov;let voidN=0,backN=0,underN=0,nearMin=99;const RR=frustumRays(fwd,fovU,0.75,8,14);
      for(const d of RR){const h=I.ray(cam,d,400,1);if(h){if(h.cls===2&&h.t<nearMin)nearMin=h.t;if(h.back)backN++;if(h.under)underN++;}else if(d[1]<-0.03)voidN++;}
      const fr=P.boat?null:framing(cam,fwd,fovU,feet),n=RR.length;
      const x={pv:pv.id,dOk,why:dOk!==null&&dOk>=P.dDef-1e-6?[]:why.slice(0,2),nearMin:+nearMin.toFixed(2),voidFrac:+(voidN/n).toFixed(3),backFrac:+(backN/n).toFixed(3),underFrac:+(underN/n).toFixed(3),
        frameOk:fr?fr.every(f=>f.ok):true,frac:fr?+Math.min(...fr.map(f=>f.frac)).toFixed(3):null};
      x.status=!x.dOk?'block':x.backFrac>0.02?'shell':x.underFrac>0.02?'under':x.voidFrac>0.02?'void':!x.frameOk?'frame':x.nearMin<clear?'near':x.dOk>=P.dDef-1e-6?'ok':'push';
      per.push(x);}
    const cnt={};per.forEach(x=>cnt[x.status]=(cnt[x.status]||0)+1);const usable=((cnt.ok||0)+(cnt.push||0))/per.length;
    let dom='ok',dn=0;for(const k of Object.keys(cnt))if(k!=='ok'&&k!=='push'&&cnt[k]>dn){dn=cnt[k];dom=k;}
    cells.push({a,p,usable:+usable.toFixed(3),dominantFail:dn?dom:null,cnt,per});}
  return {params:{dDef:P.dDef,dMin:P.dMin,dists:P.dists,fov:P.fov,fovByDist:P.fovAt?P.dists.map(d=>[d,+P.fovAt(d).toFixed(1)]):null,pivotH:P.pivotH,boat:!!P.boat},cells};}
function auditRoom(reg,I){const h=reg.home,pos=h.position,f0=unit([h.target[0]-pos[0],h.target[1]-pos[1],h.target[2]-pos[2]]),yaw0=Math.atan2(f0[0],f0[2])*R2D,pitch0=Math.asin(f0[1])*R2D,cells=[];
  for(let p=-30;p<=30;p+=3)for(let y=-180;y<180;y+=5){const yy=(yaw0+y)*D2R,pp=(pitch0+p)*D2R,fwd=[Math.cos(pp)*Math.sin(yy),Math.sin(pp),Math.cos(pp)*Math.cos(yy)];
    let near=99,who=null,back=0,esc=0;const bw={};for(const d of frustumRays(fwd,h.fovVerticalDeg,0.75,10,20)){const r=I.ray(pos,d,400,1);if(!r){if(d[1]<-0.03)esc++;continue;}if(r.cls===2&&r.t<near){near=r.t;who=r.name;}if(r.back){back++;bw[r.name]=(bw[r.name]||0)+1;}}
    cells.push({y,p,near:+near.toFixed(3),who,backFrac:+(back/200).toFixed(3),backWho:Object.keys(bw),escFrac:+(esc/200).toFixed(3)});}
  return {yaw0:+yaw0.toFixed(2),pitch0:+pitch0.toFixed(2),fov:h.fovVerticalDeg,position:pos,cells};}
// ---- images (PPM -> PNG via Pillow) ----
const COL={ok:[70,170,90],push:[230,200,60],frame:[150,150,150],near:[240,140,50],void:[30,30,30],back:[200,60,200],block:[200,50,50]};
function writeImg(file,w,h,px){const ppm=file.replace(/\.png$/,'.ppm');fs.writeFileSync(ppm,Buffer.concat([Buffer.from(`P6 ${w} ${h} 255\n`),Buffer.from(px)]));
  cp.execFileSync('python3',['-c','import sys;from PIL import Image;im=Image.open(sys.argv[1]);im.save(sys.argv[2]);',ppm,file]);fs.unlinkSync(ppm);}
function safetyMap(reg,res){const S=10,W=AZ.length*S,H=PITCH.length*S,px=new Uint8Array(W*H*3),FC={block:[200,40,40],void:[20,20,20],under:[120,40,160],shell:[220,60,220],frame:[140,140,140],near:[240,140,50]};
  for(const c of res.cells){const i=AZ.indexOf(c.a),j=PITCH.length-1-PITCH.indexOf(c.p),g=c.usable;let col=[Math.round(200*(1-g)+60*g),Math.round(60*(1-g)+175*g),Math.round(50*(1-g)+80*g)];
    if(g<0.5&&c.dominantFail)col=FC[c.dominantFail].map((v,q)=>Math.round(v*0.7+col[q]*0.3));
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){const o=((j*S+y)*W+i*S+x)*3,axis=(c.a%90===0&&x===0)||(c.p===0&&y===S-1),edge=x===0||y===0,k=axis?0:edge?.8:1;
      for(let q=0;q<3;q++)px[o+q]=axis?255:Math.round(col[q]*k);}}
  const f=path.join(OUT,`${reg.id}_safety.png`);writeImg(f,W,H,px);return f;}
function roomMap(res){const ys=[...new Set(res.cells.map(c=>c.y))],ps=[...new Set(res.cells.map(c=>c.p))],S=8,W=ys.length*S,H=ps.length*S,px=new Uint8Array(W*H*3);
  for(const c of res.cells){const i=ys.indexOf(c.y),j=ps.length-1-ps.indexOf(c.p),inRange=c.y>=ROOM_LOOK.minYaw&&c.y<=ROOM_LOOK.maxYaw&&c.p>=ROOM_LOOK.minPitch&&c.p<=ROOM_LOOK.maxPitch;
    const col=c.backFrac>0.01||c.escFrac>0?COL.back:c.near<0.45?COL.block:c.near<0.6?COL.push:COL.ok;
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){const o=((j*S+y)*W+i*S+x)*3,k=inRange&&(x===0||y===0)?1.25:(x===0||y===0)?.7:1;for(let q=0;q<3;q++)px[o+q]=Math.min(255,col[q]*k);}}
  const f=path.join(OUT,'room_safety.png');writeImg(f,W,H,px);return f;}
/** Room: RoomLook yaw offsets ROOM_TILES at pitch 0. Orbit: 8 azimuths (0,45..315) at pitch 15 (sail 20) around reg.mosaicPivot, CPU ray cast (normal shading). Girl = orange capsule proxy. */
const ROOM_TILES=[-140,-112,-80,-40,0,14,45,90,145];
function mosaic(reg,I,res){const TW=54,TH=116,cols=reg.kind==='pan'?ROOM_TILES.length:8,W=TW*cols,H=TH,px=new Uint8Array(W*H*3);
  const pv=reg.kind==='pan'?null:(reg.pivots.find(p=>p.id===(reg.mosaicPivot||''))||reg.pivots[0]);
  for(let k=0;k<cols;k++){let cam,fwd,fov,feet=null;
    if(reg.kind==='pan'){const yy=(res.yaw0+ROOM_TILES[k])*D2R,pp=res.pitch0*D2R;cam=res.position;fwd=[Math.cos(pp)*Math.sin(yy),Math.sin(pp),Math.cos(pp)*Math.cos(yy)];fov=res.fov;}
    else{const P=reg.params,a=k*45,pp=P.boat?20:15,c=res.cells.find(c=>c.a===a&&c.p===pp),d=(c&&c.per[0].dOk)||P.dMin;let piv,u;
      if(P.boat){const yaw=pv.faceDeg*D2R;piv=boatToWorld(yaw,P.boatPivot).map((v,i)=>v+pv.at[i]);u=boatToWorld(yaw,orbitDir(a,pp));}else{piv=[pv.at[0],pv.at[1]+P.pivotH,pv.at[2]];u=orbitDir(a,pp);}
      cam=[piv[0]+u[0]*d,piv[1]+u[1]*d,piv[2]+u[2]*d];fwd=[-u[0],-u[1],-u[2]];fov=P.fovAt?P.fovAt(d):P.fov;feet=pv.at;}
    const R=frustumRays(fwd,fov,TW/TH,TW,TH);
    for(let y=0;y<TH;y++)for(let x=0;x<TW;x++){const d=R[y*TW+x],h=I.ray(cam,d,200,1);let c;
      let girl=Infinity;if(feet&&reg.id!=='sail'){/* vertical cylinder r .22 */const ox=cam[0]-feet[0],oz=cam[2]-feet[2],A=d[0]*d[0]+d[2]*d[2],B=2*(ox*d[0]+oz*d[2]),C=ox*ox+oz*oz-0.22*0.22,D=B*B-4*A*C;
        if(D>0){const t=(-B-Math.sqrt(D))/(2*A),yy=cam[1]+d[1]*t-feet[1];if(t>0&&yy>=0&&yy<=EC.BODY_M)girl=t;}}
      if(girl<(h?h.t:1e9))c=[245,140,40];
      else if(!h)c=d[1]<-0.03?[0,0,0]:[150,200,240];
      else{const s=0.35+0.65*h.shade;c=h.back?[230,40,230]:h.cls===1?[60*s+20,110*s+30,190*s+40]:[200*s,196*s,180*s];}
      const o=(y*W+k*TW+x)*3;px[o]=c[0];px[o+1]=c[1];px[o+2]=c[2];}}
  const f=path.join(OUT,`${reg.id}_mosaic.png`);writeImg(f,W,H,px);return f;}
// ---- summaries ----
function sectors(list){/* azimuth list (deg, step 10) -> merged [from,to] sectors with wrap */const set=new Set(list),out=[];if(!list.length)return out;if(set.size===AZ.length)return [[0,360]];
  let start=AZ.find(a=>set.has(a)&&!set.has((a+350)%360));const seen=new Set();
  for(const a0 of AZ){if(!set.has(a0)||set.has((a0+350)%360)||seen.has(a0))continue;let a=a0;while(set.has((a+10)%360)&&!seen.has((a+10)%360)){seen.add(a);a=(a+10)%360;}seen.add(a);out.push([a0-5,a+5]);}
  return out;}
function summarize(reg,res){const rows=PITCH.map(p=>{const r=res.cells.filter(c=>c.p===p),fail={};r.forEach(c=>{for(const [k,v] of Object.entries(c.cnt))if(k!=='ok'&&k!=='push')fail[k]=(fail[k]||0)+v;});
    const n=r.reduce((s,c)=>s+c.per.length,0),ok=r.reduce((s,c)=>s+(c.cnt.ok||0),0),us=r.reduce((s,c)=>s+(c.cnt.ok||0)+(c.cnt.push||0),0);
    return {p,ok:+(ok/n).toFixed(2),usable:+(us/n).toFixed(2),fail:Object.entries(fail).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+(v/n).toFixed(2))};});
  const band=res.params.boat?[10,40]:[10,30],per={};
  for(const pv of reg.pivots){const bad=[],why={};for(const a of AZ){const cs=res.cells.filter(c=>c.a===a&&c.p>=band[0]&&c.p<=band[1]),xs=cs.map(c=>c.per.find(x=>x.pv===pv.id));
      const nb=xs.filter(x=>x.status!=='ok'&&x.status!=='push');if(nb.length*2>xs.length){bad.push(a);for(const x of nb){const w=x.status==='block'?(x.why[0]||'block'):x.status;why[w]=(why[w]||0)+1;}}}
    per[pv.id]={badSectors:sectors(bad),why:Object.entries(why).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0])};}
  const regionBad=AZ.filter(a=>{const cs=res.cells.filter(c=>c.a===a&&c.p>=band[0]&&c.p<=band[1]);return cs.reduce((s,c)=>s+c.usable,0)/cs.length<0.6;});
  const pushWhy={};for(const c of res.cells)for(const x of c.per)for(const w of x.why){const k=w.split(':').slice(0,2).join(':');pushWhy[k]=(pushWhy[k]||0)+1;}
  return {band,rows,perPivot:per,regionSectorsUsableBelow60:sectors(regionBad),topReasons:Object.entries(pushWhy).sort((a,b)=>b[1]-a[1]).slice(0,10)};}
function designShots(){const src=fs.readFileSync(path.join(SCRIPTS,'region/TransportLeg.ts'),'utf8'),out={};
  for(const m of src.matchAll(/const (K\w+):SailOff=\{back:([-\d.]+),side:([-\d.]+),up:([-\d.]+),fov:([-\d.]+),look:([-\d.]+)/g)){const [,id,back,side,up,fov,look]=m.map(Number.isNaN?x=>x:x=>x);
    const b=+back,sd=+side,u=+up,lk=+look,tg=[0,1.05,lk],cam=[sd,u,-b],v=[cam[0]-tg[0],cam[1]-tg[1],cam[2]-tg[2]],d=Math.hypot(...v);
    out[id]={boatAzimuthDeg:+((Math.atan2(v[0],v[2])*R2D+360)%360).toFixed(1),pitchDeg:+(Math.asin(v[1]/d)*R2D).toFixed(1),distM:+d.toFixed(2),fov:+fov,hullR:+Math.hypot(b,sd).toFixed(2)};}
  out.follow={headingRelYawDeg:DEF.relYaw,pitchDeg:DEF.pitch,distM:DEF.dist,fov:DEF.fov,pivotH:DEF.pivotH,note:'ExploreCameraCore.FOLLOW (back 6.6, side -2.4 = her right, up 3.4) re-expressed around feet+1.2 m'};
  return out;}
(async()=>{const t0=Date.now(),all=await regions(),out={about:'free_cam_audit.cjs (运镜bot Y2). See header for conventions.',designShots:designShots(),defaults:DEF,screens:SCREENS,azimuths:AZ,pitches:PITCH,regions:{}};
  for(const reg of all){if(ONLY.length&&!ONLY.includes(reg.id))continue;const I=buildIndex(reg.meshes,reg.cell),t1=Date.now();
    const res=reg.kind==='pan'?auditRoom(reg,I):auditOrbit(reg,I),img=reg.kind==='pan'?roomMap(res):safetyMap(reg,res),mos=mosaic(reg,I,res);
    const sum=reg.kind==='pan'?null:summarize(reg,res);
    out.regions[reg.id]={kind:reg.kind,triangles:I.triangles,bounds:{lo:I.lo.map(v=>+v.toFixed(1)),hi:I.hi.map(v=>+v.toFixed(1))},pivots:reg.pivots?reg.pivots.map(p=>({id:p.id,at:p.at.map(v=>+(+v).toFixed(2))})):null,safetyMap:img,mosaic:mos,summary:sum,result:res};if(out.regions[reg.id].result.params)delete out.regions[reg.id].result.params.boatIndex;
    console.log(`${reg.id}: ${I.triangles} tris, ${((Date.now()-t1)/1000).toFixed(1)} s`,reg.kind==='pan'?'':JSON.stringify(sum.rows.map(r=>r.p+':'+r.usable)));}
  const jf=arg('--json',path.join(OUT,'free_cam_audit.json'));fs.writeFileSync(jf,JSON.stringify(out));console.log('wrote',jf,((Date.now()-t0)/1000).toFixed(1),'s');})().catch(e=>{console.error(e);process.exit(1);});
