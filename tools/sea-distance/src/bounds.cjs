'use strict';
// Above-water bounds for the handoff frustum test (world, sail layout). Real meadow: env_meadow tris (sail copy, root yaw 180),
// south lowland z<45 sunk (terrain, river_bank AND river) to y −1.3, keep only verts above y −0.89 (sea −0.91 + 2 cm); sky dome,
// near clouds, far hills skipped (far hills are held back until the swap). Stand-in: delivered glb tris at SEA_STANDIN.
const R=process.argv[2],L=require(R+'/tools/transitions/sail_farsea_lib.cjs'),sea=L.load('region/SeaReveal.ts'),{load}=require(R+'/tools/journey-integration/occlusion/lib-glb.cjs');
const Y=-0.89,root=L.leg.sailMeadowRoot(),out={real:{},realUnion:null};
const box=()=>({min:[1e9,1e9,1e9],max:[-1e9,-1e9,-1e9],n:0}),add=(b,p)=>{for(let k=0;k<3;k++){b.min[k]=Math.min(b.min[k],p[k]);b.max[k]=Math.max(b.max[k],p[k]);}b.n++;};
const U=box(),pts=[],tiles={},TILE=+(process.env.TILE||12);
for(const n of load(R+'/creator-build-project/assets/bundles/region_meadow/env_meadow.glb')){if(!n.tris||!n.tris.length||/^(meadow_sky_dome|meadow_clouds_near|meadow_far_hills)$/.test(n.name))continue;
 const b=box(),sink=/^meadow_(terrain|river_bank|river)$/.test(n.name);
 for(let i=0;i<n.tris.length;i+=3){const p=[root[0]-n.tris[i],root[1]+n.tris[i+1],root[2]-n.tris[i+2]];if(sink&&p[2]<45&&p[1]>-1.3)p[1]=-1.3;if(p[1]<=Y)continue;add(b,p);add(U,p);pts.push(p);if(n.name==='meadow_terrain'||n.name==='meadow_river_bank'){const k=n.name+'@'+Math.floor(p[0]/TILE)+','+Math.floor(p[2]/TILE);add(tiles[k]||(tiles[k]=box()),p);}}
 if(b.n)out.real[n.name.replace(/\.\d+$/,'')+(out.real[n.name]?'#':'')]={min:b.min.map(v=>+v.toFixed(2)),max:b.max.map(v=>+v.toFixed(2))};}
out.tiles=Object.fromEntries(Object.entries(tiles).map(([k,b])=>[k,{min:b.min.map(v=>+v.toFixed(2)),max:b.max.map(v=>+v.toFixed(2))}]));out.tileM=TILE;
const sph=(b,P)=>{const c=b.min.map((v,k)=>(v+b.max[k])/2);let r=0;for(const p of P)r=Math.max(r,Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2]));return {c:c.map(v=>+v.toFixed(2)),r:+r.toFixed(2)};};
out.realUnion={min:U.min.map(v=>+v.toFixed(2)),max:U.max.map(v=>+v.toFixed(2)),sphere:sph(U,pts)};
const S=sea.SEA_STANDIN,I=box(),ip=[];
const T=JSON.parse(require('fs').readFileSync('/workspace/wechat-game/product/2026-10-26/sea-distance/assets/out/impostor_tris.json'));
for(const t of T)for(const v of t.v){const p=[S.pos[0]-S.scale*v[0],S.pos[1]+S.scale*v[1],S.pos[2]-S.scale*v[2]];if(p[1]<=Y)continue;add(I,p);ip.push(p);}
out.standin={min:I.min.map(v=>+v.toFixed(2)),max:I.max.map(v=>+v.toFixed(2)),sphere:sph(I,ip),transform:S};
console.log(JSON.stringify(out,null,1));
