// Top-down walkability map from real scene triangles (2.5D multi-layer grid). Not engine output.
const fs=require('fs'),zlib=require('zlib');const {load}=require('/workspace/gh/wt-skyb/tools/journey-integration/occlusion/lib-glb.cjs');
const R={
 island:{f:'/workspace/gh/scratch/dec/room.glb',box:[-12,-14,16,18],c:.2,floor:/env_island_main|env_beach_|env_lighthouse_ext|env_island_props_merged/,solid:/env_island_main|env_island_props_merged|env_lighthouse_ext|env_lighthouse_door|env_prop_palm|env_beach_tide/,start:[-2.1,0,5.3],sea:-0.6},
 meadow:{f:'/workspace/gh/wt-skyb/creator-build-project/assets/bundles/region_meadow/env_meadow.glb',box:[-40,-45,40,45],c:.4,floor:/meadow_terrain|meadow_path|meadow_river_bank/,solid:/meadow_terrain|meadow_path|meadow_river_bank|meadow_fence|meadow_trees|windmill_static|wind_bell_frame/,start:[0,1.2,20]},
 sky:{f:'/workspace/gh/scratch/dec/skycity.glb',box:[-60,-50,45,80],c:.4,floor:/static_palette|env_sky_ruins|state_court_after$|static_rock_strata|state_bridge_after/,solid:/static_palette|env_sky_ruins|state_court_after$|static_rock_strata|state_gate_after$|env_sky_windchime|state_bridge_after|chr_robot/,start:[-1.4,-0.1,32.6]},
};
const STEP=.36,HEAD=1.7,LOW=.3;
function build(id,startOverride){const r={...R[id],...(startOverride?{start:startOverride}:{})},[x0,z0,x1,z1]=r.box,c=r.c,W=Math.ceil((x1-x0)/c),Hh=Math.ceil((z1-z0)/c);const floors=Array.from({length:W*Hh},()=>[]),solids=Array.from({length:W*Hh},()=>[]);
 for(const n of load(r.f)){if(!n.tris||!n.tris.length)continue;const isF=r.floor.test(n.name),isS=r.solid.test(n.name);if(!isF&&!isS)continue;const t=n.tris;
  for(let k=0;k<t.length;k+=9){const A=[t[k],t[k+1],t[k+2]],B=[t[k+3],t[k+4],t[k+5]],C=[t[k+6],t[k+7],t[k+8]],e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]],nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0],nl=Math.hypot(nx,ny,nz)||1,up=Math.abs(ny)/nl;
   const L=Math.max(Math.hypot(...e1),Math.hypot(...e2),Math.hypot(C[0]-B[0],C[1]-B[1],C[2]-B[2])),N=Math.max(1,Math.ceil(L/(c*.5)));
   for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){const u=i/N,v=j/N,x=A[0]+e1[0]*u+e2[0]*v,y=A[1]+e1[1]*u+e2[1]*v,z=A[2]+e1[2]*u+e2[2]*v,gx=Math.floor((x-x0)/c),gz=Math.floor((z-z0)/c);if(gx<0||gz<0||gx>=W||gz>=Hh)continue;const ci=gz*W+gx;
    if(isF&&up>.72)floors[ci].push(y);if(isS)solids[ci].push(y);}}}
 // cluster floors per cell
 const layers=floors.map(a=>{a.sort((p,q)=>p-q);const o=[];for(const y of a){if(o.length&&y-o[o.length-1].hi<.15){o[o.length-1].hi=y;}else o.push({lo:y,hi:y});}return o.map(l=>l.hi);});
 const ok=layers.map((ls,ci)=>ls.map(y=>{const s=solids[ci];for(const q of s)if(q>y+LOW&&q<y+HEAD)return false;for(const y2 of ls)if(y2>y+.2&&y2<y+HEAD)return false;return true;}));
 if(r.sea!==undefined)layers.forEach((ls,ci)=>ls.forEach((y,li)=>{if(y<r.sea)ok[ci][li]=false;}));
 // BFS from start
 const cellOf=p=>Math.floor((p[2]-z0)/c)*W+Math.floor((p[0]-x0)/c);const s=cellOf(r.start);let sl=-1,bd=9;layers[s].forEach((y,li)=>{if(ok[s][li]&&Math.abs(y-r.start[1])<bd){bd=Math.abs(y-r.start[1]);sl=li;}});
 const seen=new Map(),key=(ci,li)=>ci*8+li;const dist=new Map();const q=[[s,sl]];seen.set(key(s,sl),null);dist.set(key(s,sl),0);
 while(q.length){const [ci,li]=q.shift(),y=layers[ci][li],gx=ci%W,gz=(ci/W)|0,d0=dist.get(key(ci,li));for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=Hh)continue;const nc=nz*W+nx;const lim=STEP*Math.hypot(dx,dz)*(c/.4);
   layers[nc].forEach((y2,l2)=>{if(!ok[nc][l2]||Math.abs(y2-y)>lim)return;const k=key(nc,l2);if(seen.has(k))return;seen.set(k,key(ci,li));dist.set(k,d0+Math.hypot(dx,dz)*c);q.push([nc,l2]);});}}
 return {id,r,W,H:Hh,c,x0,z0,layers,ok,seen,dist,key,cellOf,startKey:key(s,sl)};}
function pathTo(M,p,ytol=1.5){const ci=M.cellOf(p);let best=null;M.layers[ci].forEach((y,li)=>{const k=M.key(ci,li);if(M.seen.has(k)&&Math.abs(y-p[1])<ytol&&(!best||Math.abs(y-p[1])<best.e))best={k,e:Math.abs(y-p[1]),y};});if(!best)return null;
 const out=[];let k=best.k;while(k!==null){const ci=(k/8)|0,li=k%8;out.push([M.x0+(ci%M.W+.5)*M.c,M.layers[ci][li],M.z0+(((ci/M.W)|0)+.5)*M.c]);k=M.seen.get(k);}return {path:out.reverse(),len:M.dist.get(best.k)};}
function png(file,w,h,px){const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;px.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);}const crc=b=>{let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}c=0xffffffff;for(const x of b)c=t[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const ch=(ty,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(ty),d]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc(td));return Buffer.concat([l,td,cr]);};
 const hd=Buffer.alloc(13);hd.writeUInt32BE(w,0);hd.writeUInt32BE(h,4);hd[8]=8;hd[9]=2;fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',hd),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));}
module.exports={R,build,pathTo,png};
