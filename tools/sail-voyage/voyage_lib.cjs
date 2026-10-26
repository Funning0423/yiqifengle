'use strict';
/** sail-voyage (NOT_ENGINE): CPU z-buffer of the sail-copy meadow + sailboat + an opaque sea plane at SAIL_SEA_Y,
 *  so only above-water meadow counts. Scenario transforms let the scene team's three options be previewed:
 *  {dz} farther island, {scale} scaled stand-in about the M0 mouth, {occluder:{z,h,w}} headland/horizon wall. */
const L=require('../transitions/sail_farsea_lib.cjs');const leg=L.leg;
const SEA=-0.91;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function meadowTris(sc={}){
 const m0=leg.sailM0World(),k=sc.scale||1,dz=sc.dz||0,out=[];
 for(const n of L.scene().meadow){const t=n.tris,o=new Float64Array(t.length);for(let i=0;i<t.length;i+=3){o[i]=m0[0]+(t[i]-m0[0])*k;o[i+1]=SEA+(t[i+1]-SEA)*k;o[i+2]=m0[2]+(t[i+2]-m0[2])*k+dz;}out.push(o);}
 return out;
}
const E_CACHE={};
const E_DEF={center:[-11.6,-0.91,492.0],scale:0.7,sinkZ:45,sinkY:-1.3};
function eScene(e){
 const o={...E_DEF,...e},key=JSON.stringify([o.center,o.scale,o.sinkZ,o.sinkY]);if(E_CACHE[key])return E_CACHE[key];
 const root=leg.sailMeadowRoot(),real=[],imp=[];
 for(const n of L.scene().meadow){const t=n.tris,r=new Float64Array(t),m=new Float64Array(t.length),mill=n.mill,sink=/^meadow_(terrain|river_bank|river)$/.test(n.name)/* river added: its sheet sits 0.13 m above the sea at z<45 (request to 场景设计部) */;
  for(let i=0;i<t.length;i+=3){if(sink&&t[i+2]<o.sinkZ)r[i+1]=Math.min(t[i+1],o.sinkY);
   m[i]=o.center[0]+(t[i]-root[0])*o.scale;m[i+1]=o.center[1]+(t[i+1]-root[1])*o.scale;m[i+2]=o.center[2]+(t[i+2]-root[2])*o.scale;}
  real.push({t:r,mill,name:n.name});imp.push({t:m,mill,name:n.name});}
 return E_CACHE[key]={real,imp,def:o};
}
function quad(a,b,c,d){return [...a,...b,...c,...a,...c,...d];}
function raster(cam,screen,v,sc={},res=4){
 const W=Math.round(screen.w/res),H=Math.round(screen.h/res),asp=screen.w/screen.h,{fw,r,up,th}=L.basis(cam),o=cam.position,near=0.2;
 const zb=new Float32Array(W*H).fill(Infinity),id=new Uint8Array(W*H);
 const toCam=p=>{const d=sub(p,o);return [dot(d,r),dot(d,up),dot(d,fw)];};
 const fill=(A,B,C,code)=>{const minx=Math.max(0,Math.floor(Math.min(A[0],B[0],C[0]))),maxx=Math.min(W-1,Math.ceil(Math.max(A[0],B[0],C[0]))),miny=Math.max(0,Math.floor(Math.min(A[1],B[1],C[1]))),maxy=Math.min(H-1,Math.ceil(Math.max(A[1],B[1],C[1])));if(minx>maxx||miny>maxy)return;const ar=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);if(Math.abs(ar)<1e-9)return;
  for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){const px=x+.5,py=y+.5,w0=((B[0]-px)*(C[1]-py)-(B[1]-py)*(C[0]-px))/ar,w1=((C[0]-px)*(A[1]-py)-(C[1]-py)*(A[0]-px))/ar,w2=1-w0-w1;if(w0<0||w1<0||w2<0)continue;const z=1/(w0*A[2]+w1*B[2]+w2*C[2]),k=y*W+x;if(z<zb[k]){zb[k]=z;id[k]=code;}}};
 const tri=(a,b,c,code)=>{let poly=[a,b,c],q=[];for(let i=0;i<3;i++){const P=poly[i],Q=poly[(i+1)%3],pi=P[2]>=near,qi=Q[2]>=near;if(pi)q.push(P);if(pi!==qi){const k=(near-P[2])/(Q[2]-P[2]);q.push([P[0]+(Q[0]-P[0])*k,P[1]+(Q[1]-P[1])*k,near]);}}if(q.length<3)return;const s=q.map(p=>[((p[0]/(p[2]*th*asp))+1)/2*W,(1-(p[1]/(p[2]*th)))/2*H,1/p[2]]);for(let i=1;i+1<s.length;i++)fill(s[0],s[i],s[i+1],code);};
 const soup=(t,code,xf)=>{for(let i=0;i<t.length;i+=9){const P=j=>xf?xf([t[i+j],t[i+j+1],t[i+j+2]]):[t[i+j],t[i+j+1],t[i+j+2]];tri(toCam(P(0)),toCam(P(3)),toCam(P(6)),code);}};
 if(sc.E){
  // Option E (场景设计部 PROPOSAL §3, Grok Bot approved): real meadow hidden until the swap, south lowland (world z<45) sunk to
  // y≤−1.3 for the sail; far stand-in = sail-copy meadow scaled 0.7 about its root, root moved to the stand-in centre.
  const E=eScene(sc.E);if(sc.E.real!==false)for(const it of E.real)soup(it.t,it.mill?2:1);if(sc.E.impostor!==false)for(const it of E.imp)soup(it.t,it.mill?7:6);
 }else for(const t of meadowTris(sc))soup(t,1);
 // sea: concentric rings so near-plane clipping stays accurate
 const cx=o[0],cz=o[2];for(const [r0,r1] of [[0,20],[20,120],[120,2000]])for(let a=0;a<32;a++){const a0=a/32*Math.PI*2,a1=(a+1)/32*Math.PI*2,P=(rr,aa)=>[cx+Math.sin(aa)*rr,SEA,cz+Math.cos(aa)*rr];soup(quad(P(r0,a0),P(r1,a0),P(r1,a1),P(r0,a1)),4);}
 if(sc.occluder){const {z,h,w}=sc.occluder;soup(quad([-w,SEA,z],[w,SEA,z],[w,SEA+h,z],[-w,SEA+h,z]),5);}
 if(v&&!sc.noBoat)for(const m of L.scene().boat)soup(m.tris,3,p=>L.boatWorld(v,p));
 const cls=c=>sc.E?(c===1||c===2||c===6||c===7):c===1;
 let mill7=null;{let a=1e9,b=-1,l=1e9,rr=-1,k=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=id[y*W+x];if(c===7||(!sc.E&&c===2)){k++;a=Math.min(a,y);b=Math.max(b,y);l=Math.min(l,x);rr=Math.max(rr,x);}}if(k)mill7={hPx:(b+1-a)*res,wPx:(rr+1-l)*res,px:k*res*res};}
 const counts=new Map();for(let i=0;i<W*H;i++)counts.set(id[i],(counts.get(id[i])||0)+1);const dominant=Math.max(...counts.values())/(W*H);
 let n=0,y0=1e9,y1=-1,horizon=null;for(let y=0;y<H;y++){let seaRow=false;for(let x=0;x<W;x++){const c=id[y*W+x];if(cls(c)){n++;if(y<y0)y0=y;if(y>y1)y1=y;}if(c===4)seaRow=true;}if(seaRow&&horizon==null)horizon=y/H;}
 let sea=0;for(let i=0;i<W*H;i++)if(id[i]===4)sea++;
 const head=v?toCam(L.boatWorld(v,L.GIRL.head)):null,ndc=head&&head[2]>0?[head[0]/(head[2]*th*asp),head[1]/(head[2]*th)]:null;
 return {mill:mill7,dominant,realPx:[...counts].filter(([c])=>c===1||c===2).reduce((a,[,v])=>a+v,0),impPx:[...counts].filter(([c])=>c===6||c===7).reduce((a,[,v])=>a+v,0),islandBox:n?[y0/H,(y1+1)/H]:null,islandH:n?(y1+1-y0)/H:0,islandArea:n/(W*H),seaArea:sea/(W*H),horizon,headNdc:ndc};
}
module.exports={L,leg,raster,meadowTris,SEA,eScene,E_DEF};
