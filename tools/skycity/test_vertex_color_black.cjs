#!/usr/bin/env node
'use strict';
// cand9 black-shape check. (1) Every mainline glb primitive that renders with a vertex-colour material has COLOR_0:
//   Creator's glTF import turns USE_VERTEX_COLOR on for a material whose primitives carry COLOR_0, and a primitive without
//   COLOR_0 then reads a_color (0,0,0,1) = black. sky_mooring_props is rebound at runtime (RegionLoader.mountSkyMooring) to
//   env_skycity's M_sky_palette (all 20 palette primitives carry COLOR_0), so each of its primitives must carry COLOR_0.
//   Mixed materials are allowed only where the runtime recompiles the colourless renderers (configureMeadowVertexColors).
// (2) Where the landing mooring props sit relative to the B4 landing / B5 exit cameras (fraction of corners in the frustum).
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const R=path.resolve(__dirname,'../..'),BD=R+'/creator-build-project/assets/bundles',S=p=>fs.readFileSync(R+'/creator-build-project/assets/scripts/'+p,'utf8');
const glb=f=>{const b=fs.readFileSync(f),n=b.readUInt32LE(12);return JSON.parse(b.subarray(20,20+n).toString('utf8'));};
const MAIN=['region_island','region_meadow','region_skycity','region_lakeside','region_transit_balloon','transport_sail'];
let pass=0;const ok=m=>{pass++;console.log('PASS '+m);};const issues=[];
const handled={'region_meadow/env_meadow.glb':/configureMeadowVertexColors\(/.test(S('region/MeadowBoardBackground.ts'))};
for(const d of MAIN){if(!fs.existsSync(BD+'/'+d))continue;for(const f of fs.readdirSync(BD+'/'+d).filter(f=>f.endsWith('.glb'))){const j=glb(BD+'/'+d+'/'+f),by=new Map();
 for(const m of j.meshes||[])for(const p of m.primitives){const k=p.material??-1;if(!by.has(k))by.set(k,{c:0,n:0,names:[]});const e=by.get(k);if('COLOR_0' in p.attributes)e.c++;else{e.n++;e.names.push(m.name);}}
 for(const [k,e] of by)if(e.c&&e.n&&!handled[d+'/'+f])issues.push(d+'/'+f+' material '+(j.materials?.[k]?.name??k)+': '+e.n+' primitive(s) without COLOR_0 '+e.names.slice(0,4));}}
assert.deepEqual(issues,[],'vertex-colour material on colourless primitives');ok('no imported vertex-colour material is shared with a colourless primitive (meadow handled at runtime: '+handled['region_meadow/env_meadow.glb']+')');
const env=glb(BD+'/region_skycity/env_skycity.glb'),pal=env.materials.findIndex(m=>m.name==='M_sky_palette');
const palPrims=env.meshes.flatMap(m=>m.primitives).filter(p=>p.material===pal);assert(palPrims.length&&palPrims.every(p=>'COLOR_0' in p.attributes));
assert(/m\.name\.startsWith\('M_sky_palette'\)/.test(S('region/RegionLoader.ts'))&&/r\.setSharedMaterial\(palette,i\)/.test(S('region/RegionLoader.ts')),'mooring props rebind to M_sky_palette');
const moor=glb(BD+'/region_skycity/sky_mooring_props.glb'),mp=moor.meshes.flatMap(m=>m.primitives.map(p=>({m:m.name,p})));
for(const {m,p} of mp){assert('COLOR_0' in p.attributes,m+' lacks COLOR_0 (renders black on M_sky_palette)');const dr=p.extensions?.KHR_draco_mesh_compression;if(dr)assert('COLOR_0' in dr.attributes,m+' COLOR_0 not in the Draco stream');
 const a=moor.accessors[p.attributes.COLOR_0];assert(a.type==='VEC4'||a.type==='VEC3');}
ok('sky_mooring_props: '+mp.length+'/'+mp.length+' primitives carry COLOR_0 (in the Draco stream) for the runtime M_sky_palette rebind ('+palPrims.length+' palette primitives in env_skycity, all with COLOR_0)');
// (2) frustum: landing props (skycity-local AABB from the glb accessors) against the balloon landing / exit cameras
(async()=>{const RL=require('../journey-integration/route/route-legs.cjs'),{createHarness}=require('../board-ui/harness.cjs'),H=createHarness(),T=H.load('region/TransportLeg.ts');
 await RL.geometry();const {J}=RL,{add,rotY}=J,city=l=>add(rotY(J.yaw,l),J.sOff);
 const m6=add(rotY(180,[0.2,6.5,-25.6]),J.mOff),plan=T.balloonBeats(m6,[5.4,-0.11,43.8],J.sp('anchor_starcourt_center'),{walkInM:0,walkOutM:0,cityFrame:{yawDeg:J.yaw,origin:J.sOff}});
 const box=n=>{const nd=moor.nodes.find(x=>x.name===n),a=moor.accessors[moor.meshes[nd.mesh].primitives[0].attributes.POSITION];const c=[];for(const x of [a.min[0],a.max[0]])for(const y of [a.min[1],a.max[1]])for(const z of [a.min[2],a.max[2]])c.push(city([x,y,z]));return c;};
 const inView=(cam,p,w,h)=>{const f=[cam.target[0]-cam.position[0],cam.target[1]-cam.position[1],cam.target[2]-cam.position[2]],fl=Math.hypot(...f);const F=f.map(v=>v/fl);
  const rt=[F[2],0,-F[0]],rl=Math.hypot(...rt)||1,Rr=rt.map(v=>v/rl),U=[F[1]*Rr[2]-F[2]*Rr[1],F[2]*Rr[0]-F[0]*Rr[2],F[0]*Rr[1]-F[1]*Rr[0]];
  const v=[p[0]-cam.position[0],p[1]-cam.position[1],p[2]-cam.position[2]],z=v[0]*F[0]+v[1]*F[1]+v[2]*F[2];if(z<=0.1)return false;
  const t=Math.tan((cam.fovVerticalDeg||45)*Math.PI/360);const y=(v[0]*U[0]+v[1]*U[1]+v[2]*U[2])/(z*t),x=(v[0]*Rr[0]+v[1]*Rr[1]+v[2]*Rr[2])/(z*t*w/h);return Math.abs(x)<=1&&Math.abs(y)<=1;};
 const out={};for(const n of ['sky_mooring_deck','sky_mooring_posts','sky_mooring_rope']){const c=box(n);let best=0;
  for(const [w,h] of RL.SCREENS)for(let t=Math.max(0,plan.total-4);t<=plan.total+1e-9;t+=0.25){const cam=plan.camera(t,{w,h});best=Math.max(best,c.filter(p=>inView(cam,p,w,h)).length/c.length);}out[n]=best;}
 const centre=moor.accessors[moor.meshes[moor.nodes.find(x=>x.name==='sky_mooring_deck').mesh].primitives[0].attributes.POSITION];
 const dc=Math.hypot((centre.min[0]+centre.max[0])/2-5.4,(centre.min[2]+centre.max[2])/2-43.8);
 assert(dc<1,'landing deck not under the landing basket');assert(out.sky_mooring_deck>0,'deck never in the landing frustum');
 ok('landing deck centre '+dc.toFixed(2)+' m from the landing basket (5.4,43.8); max corner fraction in the last 4 s landing frustum (7 screens): '+JSON.stringify(out));
 console.log(JSON.stringify({result:'PASS',pass,frustum:out}));})().catch(e=>{console.error(e);process.exit(1);});
