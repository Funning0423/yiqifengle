#!/usr/bin/env node
'use strict';
// b19 standin-scale (场景设计部, Grok Bot): the SHIPPED far_meadow_impostor.glb (Draco, windmill ×1.2) at SEA_STANDIN, measured with
// 运镜bot's sail-voyage raster gate (voyage_lib.raster, sailVoyageCamera, S-b hold at 0.25 s, res 1 for w≤390 else 2) on all 7 screens:
// dock share (stand-in vertical extent ÷ frame height) ≤ 3.9 % and windmill silhouette ≥ 12 px tall / ≥ 10 px wide.
// The sail-voyage test measures a scaled sail-copy meadow proxy (unchanged windmill); this one measures the delivered asset, so the
// 11 px (proxy) vs 14 px (asset) windmill on 390x520 is explained by the asset's ×1.2 windmill.
const assert=require('node:assert/strict'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'../..');
const V=require('../sail-voyage/voyage_lib.cjs'),leg=V.leg,L=V.L;
const SV=L.load('region/SailVoyage.ts',s=>s.includes('TransportLeg')?leg:{}),sea=L.load('region/SeaReveal.ts');
const S=sea.SEA_STANDIN,DOCK=0.039,MH=12,MW=10;
const D=process.env.DRACO3D||(fs.existsSync(ROOT+'/node_modules/draco3d')?ROOT+'/node_modules/draco3d':'/tmp/draco3d/node_modules/draco3d');
let draco;try{draco=require(D);}catch(e){console.log('SKIP standin-raster: draco3d not found (set DRACO3D)');process.exit(0);}
async function decode(file){const b=fs.readFileSync(file),jl=b.readUInt32LE(12),J=JSON.parse(b.subarray(20,20+jl)),bin=b.subarray(20+jl+8),dm=await draco.createDecoderModule({});
 const n=J.nodes.find(x=>x.name==='far_meadow_impostor'&&x.mesh!=null);assert.ok(n&&!n.rotation&&!n.scale&&!n.translation&&!n.matrix,'impostor node is identity');const out=[];
 for(const p of J.meshes[n.mesh].primitives){const ext=p.extensions.KHR_draco_mesh_compression,bv=J.bufferViews[ext.bufferView],buf=new dm.DecoderBuffer();buf.Init(new Int8Array(bin.buffer,bin.byteOffset+(bv.byteOffset||0),bv.byteLength),bv.byteLength);
  const dec=new dm.Decoder(),mesh=new dm.Mesh();dec.DecodeBufferToMesh(buf,mesh);const att=dec.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),arr=new dm.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,att,arr);
  const ia=new dm.DracoInt32Array();for(let f=0;f<mesh.num_faces();f++){dec.GetFaceFromMesh(mesh,f,ia);for(let k=0;k<3;k++){const v=ia.GetValue(k);out.push(arr.GetValue(v*3),arr.GetValue(v*3+1),arr.GetValue(v*3+2));}}}
 return out;}
(async()=>{
 const t=await decode(ROOT+'/creator-build-project/assets/bundles/transport_sail/far_meadow_impostor.glb');
 const STATS=JSON.parse(fs.readFileSync(path.join(__dirname,'handoff_bounds.json'),'utf8'));assert.equal(STATS.standin.transform.scale,S.scale,'handoff_bounds.json standin scale = SEA_STANDIN.scale');
 const TW=[0.0486,-29.74]/* windmill tower (asset local x,z; build_assets.py stats) */,yaw=S.yawDeg*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw),base=[],mill=[];
 for(let i=0;i<t.length;i+=9){let cx=0,cy=0,cz=0;for(let k=0;k<3;k++){cx+=t[i+k*3]/3;cy+=t[i+k*3+1]/3;cz+=t[i+k*3+2]/3;}const dst=Math.hypot(cx-TW[0],cz-TW[1])<9.5&&cy>5?mill:base;
  for(let k=0;k<3;k++){const x=t[i+k*3],y=t[i+k*3+1],z=t[i+k*3+2];dst.push(S.pos[0]+S.scale*(c*x+s*z),S.pos[1]+S.scale*y,S.pos[2]+S.scale*(-s*x+c*z));}}
 assert.ok(mill.length>0,'windmill tris found');
 const E=V.eScene({scale:S.scale});E.imp.length=0;E.imp.push({t:Float64Array.from(base),mill:false,name:'far_meadow_impostor'},{t:Float64Array.from(mill),mill:true,name:'far_meadow_impostor#mill'});
 const route=leg.sailRoute(),R=route.samples,tl=leg.sailBeats(route.length),sb=tl.beats.find(b=>b.id==='S-b'),rows={},fails=[];
 for(const sc of leg.SAIL_SCREENS){let dmax=0,m=null;for(let tt=sb.t0;tt<=sb.t1+1e-6;tt+=0.25){const v=leg.sailVehicle(tl,R,tt),q=V.raster(SV.sailVoyageCamera(tl,R,tt,sc),sc,v,{E:{scale:S.scale,real:false,impostor:true}},sc.w<=390?1:2);dmax=Math.max(dmax,q.islandH);if(Math.abs(tt-(sb.t0+sb.t1)/2)<0.13)m=q.mill;}
  const k=sc.w+'x'+sc.h;rows[k]={dockPct:+(dmax*100).toFixed(2),millPx:m?[m.hPx,m.wPx]:null};
  if(dmax>DOCK+1e-9)fails.push(k+' dock '+rows[k].dockPct+'%');if(!m||m.hPx<MH||m.wPx<MW)fails.push(k+' windmill '+JSON.stringify(rows[k].millPx));}
 console.log(JSON.stringify({scale:S.scale,gate:{dockPct:3.9,millPx:[MH,MW]},rows}));
 assert.deepEqual(fails,[],fails.join('; '));console.log('PASS standin-raster (shipped impostor, sail-voyage raster)');
})().catch(e=>{console.error(e);process.exit(1);});
