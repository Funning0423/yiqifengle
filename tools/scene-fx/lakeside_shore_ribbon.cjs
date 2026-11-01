'use strict';
/* 场景特效bot r5 S3: the lakeside shore-wash ribbon, rebuilt into models/LK_shore_foam.glb (same node / mesh / material / texture
 * slots as the old flat foam ring, so its .meta sub-asset ids stay). The waterline is the y = 0 contour of LK_terrain_i inside the
 * lake plane (LK_lake: y 0, x -50..50, z -53..37 lake-local), marching squares on a 0.5 m height grid, chained, smoothed and
 * resampled every 1.5 m. Across the shore the rows follow ShoreFoamCore.LAKE_FOAM_ROWS: v 0 = 2.4 m out on the water (y 0.03),
 * v 0.5 = the waterline, v 1 = 2.0 m up the bank (terrain + 0.04). TEXCOORD_0 = (metres along the shore, v); COLOR_0 = (0, 1, 1,
 * end fade) - no sea lift on the lake. Drawn at runtime by resources/world/shore-foam.effect (LakesideBoardBackground swaps the material).
 *   node tools/scene-fx/lakeside_shore_ribbon.cjs [--dry]   -> stats JSON */
const fs=require('fs'),path=require('path');
const LKS=require(path.join(__dirname,'../journey-integration/lakeside/lakeside-scene.cjs'));
const OUT=LKS.B+'models/LK_shore_foam.glb',DRY=process.argv.includes('--dry');
const ROWS=[0,0.5,0.6,0.7,0.8,0.9,1];   // = ShoreFoamCore.LAKE_FOAM_ROWS (test checks): flat water offshore, the bank rows follow the terrain
const RECT=[-49,49,-52,36],G=0.5,STEP=1.5,OFF=2.4,IN=2.0,YW=0.03,YL=0.04,MINLEN=6;
const ground=LKS.instances().find(o=>o.name==='LK_terrain_i');if(!ground)throw Error('LK_terrain_i missing');
const C=2,grid=new Map(),t=ground.tris;
for(let k=0;k<t.length;k+=9){const x0=Math.min(t[k],t[k+3],t[k+6]),x1=Math.max(t[k],t[k+3],t[k+6]),z0=Math.min(t[k+2],t[k+5],t[k+8]),z1=Math.max(t[k+2],t[k+5],t[k+8]);
 for(let i=Math.floor(x0/C);i<=Math.floor(x1/C);i++)for(let j=Math.floor(z0/C);j<=Math.floor(z1/C);j++){const key=i+','+j;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(k);}}
function h(x,z){const L=grid.get(Math.floor(x/C)+','+Math.floor(z/C));let best=null;if(!L)return -5;
 for(const k of L){const ax=t[k],az=t[k+2],bx=t[k+3],bz=t[k+5],cx=t[k+6],cz=t[k+8],den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-12)continue;
  const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,c=1-a-b;if(a<-1e-9||b<-1e-9||c<-1e-9)continue;
  const y=a*t[k+1]+b*t[k+4]+c*t[k+7];if(best===null||y>best)best=y;}return best===null?-5:best;}
// height grid + marching squares (level 0)
const NX=Math.round((RECT[1]-RECT[0])/G)+1,NZ=Math.round((RECT[3]-RECT[2])/G)+1,H=new Float64Array(NX*NZ);
for(let i=0;i<NX;i++)for(let j=0;j<NZ;j++)H[i*NZ+j]=h(RECT[0]+i*G,RECT[2]+j*G);
const segs=[];const P=(i,j)=>[RECT[0]+i*G,RECT[2]+j*G],hv=(i,j)=>H[i*NZ+j];
function cross(a,b,ha,hb){const f=ha/(ha-hb);return [+(a[0]+(b[0]-a[0])*f).toFixed(4),+(a[1]+(b[1]-a[1])*f).toFixed(4)];}
for(let i=0;i<NX-1;i++)for(let j=0;j<NZ-1;j++){const c=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]],v=c.map(q=>hv(q[0],q[1])),pts=[];
 for(let e=0;e<4;e++){const a=e,b=(e+1)%4;if((v[a]>0)!==(v[b]>0))pts.push(cross(P(c[a][0],c[a][1]),P(c[b][0],c[b][1]),v[a],v[b]));}
 if(pts.length===2)segs.push(pts);else if(pts.length===4){segs.push([pts[0],pts[1]]);segs.push([pts[2],pts[3]]);}}
// chain
const key=p=>p[0].toFixed(3)+','+p[1].toFixed(3),ends=new Map();segs.forEach((s,i)=>{for(const e of [0,1]){const k=key(s[e]);if(!ends.has(k))ends.set(k,[]);ends.get(k).push(i);}});
const used=new Uint8Array(segs.length),lines=[];
for(let s0=0;s0<segs.length;s0++){if(used[s0])continue;used[s0]=1;const line=[segs[s0][0],segs[s0][1]];
 for(const dir of [1,0]){for(;;){const tip=dir?line[line.length-1]:line[0],L=ends.get(key(tip))||[];let nx=-1;for(const q of L)if(!used[q]){nx=q;break;}if(nx<0)break;used[nx]=1;
  const s=segs[nx],o=key(s[0])===key(tip)?s[1]:s[0];if(dir)line.push(o);else line.unshift(o);}}
 lines.push(line);}
const len=l=>{let s=0;for(let i=1;i<l.length;i++)s+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);return s;};
function resample(l,closed){const pts=closed?l.concat([l[0]]):l,out=[],L=len(pts),n=Math.max(2,Math.round(L/STEP));let seg=0,acc=0;
 for(let k=0;k<=n;k++){if(closed&&k===n)break;const d=L*k/n;while(seg<pts.length-2&&acc+Math.hypot(pts[seg+1][0]-pts[seg][0],pts[seg+1][1]-pts[seg][1])<d){acc+=Math.hypot(pts[seg+1][0]-pts[seg][0],pts[seg+1][1]-pts[seg][1]);seg++;}
  const a=pts[seg],b=pts[seg+1],sl=Math.hypot(b[0]-a[0],b[1]-a[1])||1,f=Math.min(1,(d-acc)/sl);out.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);}return out;}
function smooth(l,closed,it){let p=l;for(let r=0;r<it;r++){const q=[];for(let i=0;i<p.length;i++){if(!closed&&(i===0||i===p.length-1)){q.push(p[i]);continue;}const a=p[(i-1+p.length)%p.length],b=p[(i+1)%p.length];q.push([(a[0]+2*p[i][0]+b[0])/4,(a[1]+2*p[i][1]+b[1])/4]);}p=q;}return p;}
const ribbons=[];if(process.env.QF_DBG)for(const l of lines){const xs=l.map(p=>p[0]),zs=l.map(p=>p[1]);console.error(JSON.stringify({n:l.length,len:+len(l).toFixed(1),closed:key(l[0])===key(l[l.length-1]),x:[Math.min(...xs),Math.max(...xs)],z:[Math.min(...zs),Math.max(...zs)]}));}
for(const l of lines){const closed=key(l[0])===key(l[l.length-1]),raw=closed?l.slice(0,-1):l;if(len(l)<MINLEN)continue;
 // keep off the lake-plane rim (the contour there is the grid edge, not a shore): split the line into runs of inner points
 const inside=p=>p[0]>RECT[0]+1.5&&p[0]<RECT[1]-1.5&&p[1]>RECT[2]+1.5&&p[1]<RECT[3]-1.5;
 if(raw.every(inside)){ribbons.push({closed,pts:smooth(resample(smooth(raw,closed,2),closed),closed,2)});continue;}
 let run=[];const flush=()=>{if(run.length>2&&len(run)>=MINLEN)ribbons.push({closed:false,pts:smooth(resample(smooth(run,false,2),false),false,2)});run=[];};
 const n0=raw.length;let st=0;if(closed)while(st<n0&&inside(raw[st]))st++;          // a closed loop: start at an outside point
 for(let k=0;k<n0;k++){const q=raw[(st+k)%n0];if(inside(q))run.push(q);else flush();}flush();}
// mesh
const POS=[],UV=[],COL=[],IDX=[];let maxR=0;
for(const r of ribbons){const p=r.pts,n=p.length,base=POS.length/3;let u=0;
 for(let i=0;i<n;i++){if(i>0)u+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);
  const a=p[r.closed?(i-1+n)%n:Math.max(0,i-1)],b=p[r.closed?(i+1)%n:Math.min(n-1,i+1)];let tx=b[0]-a[0],tz=b[1]-a[1];const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
  let ox=-tz,oz=tx;if(h(p[i][0]+ox*0.8,p[i][1]+oz*0.8)>h(p[i][0]-ox*0.8,p[i][1]-oz*0.8)){ox=-ox;oz=-oz;}   // offshore = downhill
  const e=r.closed?1:Math.min(1,Math.min(i,n-1-i)/2),fade=Math.round(255*(0.15+0.85*e*e*(3-2*e)));
  for(const v of ROWS){const d=v<=0.5?(0.5-v)/0.5*OFF:-(v-0.5)/0.5*IN,x=p[i][0]+ox*d,z=p[i][1]+oz*d;
   const y=v<=0.5?YW:Math.max(h(x,z),0)+YL;if(y>maxR)maxR=y;POS.push(+x.toFixed(4),+y.toFixed(4),+z.toFixed(4));UV.push(+u.toFixed(3),v);COL.push(0,255,255,fade);}}
 const R=ROWS.length,cols=r.closed?n:n-1;
 for(let i=0;i<cols;i++){const i2=(i+1)%n;for(let k=0;k<R-1;k++){const a=base+i*R+k,b=a+1,c=base+i2*R+k,d=c+1;IDX.push(a,c,b,b,c,d);}}}
// fix winding upward
for(let k=0;k<IDX.length;k+=3){const a=IDX[k],b=IDX[k+1],c=IDX[k+2],ny=(POS[b*3+2]-POS[a*3+2])*(POS[c*3]-POS[a*3])-(POS[b*3]-POS[a*3])*(POS[c*3+2]-POS[a*3+2]);if(ny<0){IDX[k+1]=c;IDX[k+2]=b;}}
const nv=POS.length/3;if(nv>65535)throw Error('too many vertices');
const stats={ribbons:ribbons.length,closed:ribbons.filter(r=>r.closed).length,lengthM:+ribbons.reduce((s,r)=>s+len(r.closed?r.pts.concat([r.pts[0]]):r.pts),0).toFixed(1),verts:nv,tris:IDX.length/3,maxY:+maxR.toFixed(3)};
if(DRY){console.log(JSON.stringify(stats));process.exit(0);}
// write: same JSON skeleton as the old file (node 0 / mesh 0 / material M_LK_palette / texture 0 -> T_LK_palette_256.png)
const old=fs.readFileSync(OUT),jl=old.readUInt32LE(12),J=JSON.parse(old.slice(20,20+jl).toString('utf8'));
const bufs=[],views=[],acc=[];let off=0;
function add(arr,ctor,comp,type,count,target,extra){const b=Buffer.from(new ctor(arr).buffer);const pad=(4-off%4)%4;if(pad){bufs.push(Buffer.alloc(pad));off+=pad;}
 views.push(Object.assign({buffer:0,byteLength:b.length,byteOffset:off},target?{target}:{}));bufs.push(b);off+=b.length;acc.push(Object.assign({bufferView:views.length-1,componentType:comp,count,type},extra||{}));return acc.length-1;}
let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<nv;i++)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],POS[i*3+k]);mx[k]=Math.max(mx[k],POS[i*3+k]);}
const NRM=[];for(let i=0;i<nv;i++)NRM.push(0,1,0);
const aP=add(POS,Float32Array,5126,'VEC3',nv,34962,{min:mn,max:mx}),aN=add(NRM,Float32Array,5126,'VEC3',nv,34962),aT=add(UV,Float32Array,5126,'VEC2',nv,34962),
 aC=add(COL,Uint8Array,5121,'VEC4',nv,34962,{normalized:true}),aI=add(IDX,Uint16Array,5123,'SCALAR',IDX.length,34963);
J.accessors=acc;J.bufferViews=views;J.meshes[0].primitives=[{attributes:{POSITION:aP,NORMAL:aN,TEXCOORD_0:aT,COLOR_0:aC},indices:aI,material:0}];
J.asset.generator='tools/scene-fx/lakeside_shore_ribbon.cjs (场景特效bot r5 S3)';
let bin=Buffer.concat(bufs);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);J.buffers=[{byteLength:bin.length}];
let js=Buffer.from(JSON.stringify(J),'utf8');js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);
const hd=Buffer.alloc(12);hd.writeUInt32LE(0x46546C67,0);hd.writeUInt32LE(2,4);hd.writeUInt32LE(28+js.length+bin.length,8);
const c0=Buffer.alloc(8);c0.writeUInt32LE(js.length,0);c0.writeUInt32LE(0x4E4F534A,4);const c1=Buffer.alloc(8);c1.writeUInt32LE(bin.length,0);c1.writeUInt32LE(0x004E4942,4);
fs.writeFileSync(OUT,Buffer.concat([hd,c0,js,c1,bin]));
const MF=OUT+'.meta',M=JSON.parse(fs.readFileSync(MF,'utf8'));for(const k in M.subMetas)if(/\.mesh$/.test(M.subMetas[k].name))M.subMetas[k].userData.triangleCount=IDX.length/3;
fs.writeFileSync(MF,JSON.stringify(M,null,2)+'\n');
stats.bytes=[old.length,fs.statSync(OUT).size];console.log(JSON.stringify(stats));
