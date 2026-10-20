// per pose: under rays split into front-facing (d.n<0: an up-slope / a ceiling seen from its front) and back-facing (d.n>0: the underside of a surface)
process.argv.push('--out','/tmp/cs/side');
const fs=require('fs'),path=require('path'),Module=require('module');const ROOT='/workspace/yiqifengle/work/fx-cloudsea-soft';
function load(b){process.env.EXPO_BUNDLES=b;let src=fs.readFileSync('/workspace/yiqifengle/work/运镜bot-freecam/tools/camera-frame-test/free_cam_audit.cjs','utf8');
 src=src.slice(0,src.indexOf('(async()=>{const t0=Date.now()')).replace("BUNDLES=path.join(ROOT,'creator-build-project/assets/bundles')","BUNDLES=process.env.EXPO_BUNDLES")+'\nmodule.exports={regions,buildIndex,frustumRays};';
 const fake=path.join(ROOT,'tools/camera-frame-test/free_cam_audit.cjs');const m=new Module(fake+Math.random(),module);m.filename=fake;m.paths=Module._nodeModulePaths(path.dirname(fake));m._compile(src,fake);return m.exports;}
const GROUND=/(terrain|island_main|rock_strata|static_palette|LK_terrain|floatingrocks)/i;
function hashTris(meshes){const H=new Map(),T=[];for(const n in meshes){if(!GROUND.test(n))continue;for(const t of meshes[n]){const e1=[t[1][0]-t[0][0],t[1][1]-t[0][1],t[1][2]-t[0][2]],e2=[t[2][0]-t[0][0],t[2][1]-t[0][1],t[2][2]-t[0][2]];
 const nn=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],l=Math.hypot(...nn)||1;const i=T.push({t,n:nn.map(x=>x/l)})-1;
 const lo=[0,1,2].map(k=>Math.floor(Math.min(t[0][k],t[1][k],t[2][k]))),hi=[0,1,2].map(k=>Math.floor(Math.max(t[0][k],t[1][k],t[2][k])));
 for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const k=x+','+y+','+z;if(!H.has(k))H.set(k,[]);H.get(k).push(i);}}}return {H,T};}
function rayTri(o,d,t){const e1=[t[1][0]-t[0][0],t[1][1]-t[0][1],t[1][2]-t[0][2]],e2=[t[2][0]-t[0][0],t[2][1]-t[0][1],t[2][2]-t[0][2]];const p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]];const det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)return -1;const inv=1/det,s=[o[0]-t[0][0],o[1]-t[0][1],o[2]-t[0][2]];const u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])*inv;if(u<-1e-6||u>1+1e-6)return -1;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]];const v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;if(v<-1e-6||u+v>1+1e-6)return -1;return (e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;}
function facing(HT,o,d,t){const p=[o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t],k=p.map(Math.floor).join(',');let best=null,bd=1e9;for(const i of HT.H.get(k)||[]){const tt=rayTri(o,d,HT.T[i].t);if(tt>0&&Math.abs(tt-t)<bd){bd=Math.abs(tt-t);best=HT.T[i];}}
 if(!best||bd>0.05)return '?';const bk=(d[0]*best.n[0]+d[1]*best.n[1]+d[2]*best.n[2])>0;if(bk&&global.COLLECT)global.COLLECT.set(best.t.map(v=>v.map(x=>x.toFixed(4)).join(',')).join(';'),best);return bk?'back':'front';}
async function prep(b,extra){const A=load(b),R=(await A.regions()).find(r=>r.id==='skycity');if(extra){const X=JSON.parse(fs.readFileSync(extra,'utf8')).skycity;for(const n in X)R.meshes[n]=(R.meshes[n]||[]).concat(X[n]);}return {A,I:A.buildIndex(R.meshes,1),HT:hashTris(R.meshes)};}
function count(G,s){const f=[s.look[0]-s.cam[0],s.look[1]-s.cam[1],s.look[2]-s.cam[2]],l=Math.hypot(...f);const RR=G.A.frustumRays(f.map(x=>x/l),48,0.75,8,14);let fr=0,bk=0,q=0,v=0;
 for(const d of RR){const h=G.I.ray(s.cam,d,400,1);if(h&&h.under){const w=facing(G.HT,s.cam,d,h.t);if(w==='back')bk++;else if(w==='front')fr++;else q++;}else if(!h&&d[1]<-0.03)v++;}return {front:fr/RR.length,back:bk/RR.length,unk:q/RR.length,void:v/RR.length};}
(async()=>{const [Bb,Bres,Nb,Nres,extra,out]=process.argv.slice(2);const G0=await prep(Bb),G1=await prep(Nb,extra==='-'?null:extra);
 const S0=JSON.parse(fs.readFileSync(Bres)).regions.skycity.samples,S1=JSON.parse(fs.readFileSync(Nres)).regions.skycity.samples,K=s=>[s.pv,s.a,s.p,s.d].join('|'),BM=new Map(S0.map(s=>[K(s),s]));
 const real=x=>x.back+x.unk>0.02||x.void>0.02,sc=x=>Math.max(x.back+x.unk,x.void),cnt={};
 function tally(tag,G,S){const c={poses:S.length,real:0,realBack:0,realVoid:0,frontOnly:0},m=new Map();for(const s of S){const bad=s.under>0.02||s.void>0.02||s.shell>0.02;if(!bad)continue;const a=count(G,s);m.set(K(s),a);
   if(real(a)){c.real++;if(a.back+a.unk>0.02)c.realBack++;if(a.void>0.02)c.realVoid++;}else c.frontOnly++;}cnt[tag]=c;return m;}
 const M0=tally('base',G0,S0),M1=tally('soft',G1,S1);let nw=0,wr=0;
 for(const s of S1){const a=M1.get(K(s));if(!a||!real(a))continue;const b=M0.get(K(s));if(!b||!real(b))nw++;else if(sc(a)>=sc(b)+0.05)wr++;}
 cnt.vsBase={realNew:nw,realWorse:wr};fs.writeFileSync(out,JSON.stringify(cnt,null,1));console.log(JSON.stringify(cnt));})();
