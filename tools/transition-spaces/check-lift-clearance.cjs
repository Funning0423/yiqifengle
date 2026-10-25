'use strict';
/* b19 balloon lift-off clearance checker (场景设计部 → 运镜bot). Sweeps the REAL balloon volume (basket walls r 0.96 m up to 1.25 m,
 * envelope radius profile from transport_balloon.glb balloon_envelope, 2.9–10.5 m over the basket floor) along a keyframed path
 * and reports the minimum gap to the skycity mesh (env_skycity.glb: tree canopy + cards, ruins, palette, island rock/vines,
 * floor seal, star ring before/after). Triangles are sampled on a ≤0.2 m barycentric grid (gap error ≤ ~0.1 m).
 *
 * usage:  node tools/transition-spaces/check-lift-clearance.cjs <keys.json> [--frame skycity|world] [--dt 0.05] [--min 0.5]
 *   keys.json: {"frame":"skycity"|"world", "keys":[{"t":0,"pos":[x,y,z],"yaw":deg}, ...]}   (or a bare array of keys)
 *     pos = transport_balloon root (basket floor top), t in seconds (screen time is fine), yaw is reported but the volume is
 *     treated as axisymmetric (square basket → circumscribed r 0.96). Keys are Catmull-Rom interpolated (clamped ends), like
 *     TransitionCamera.sampleShot. "world" = region journey world (skycity = CW_JSON yaw 241.165, origin 59.064,18.818,117.212).
 *   Output JSON: {pass, minGapM, atT, atPos (skycity-local), hit: mesh name, hitPoint, perKey:[{t,gap,hit}], samples}
 *   exit 0 if minGap ≥ --min (default 0.5), else 1.
 *   Ground under the basket is ignored while the root is within 5 cm of key 0 (moored); afterwards anything below the basket
 *   floor inside r 0.96 counts as a vertical gap.
 * needs /tmp/draco3d (same as dump-mesh.cjs); mesh crop cached in /tmp/b19ts/. */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const H=__dirname,BUN=path.join(H,'../../creator-build-project/assets/bundles/');
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d;};
const CW={yawDeg:241.165081,origin:[59.06373,18.818369,117.212135]};
const rot=(deg,p)=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
const skyL=w=>rot(-CW.yawDeg,[w[0]-CW.origin[0],w[1]-CW.origin[1],w[2]-CW.origin[2]]);
function dump(glbFile,box,re){fs.mkdirSync('/tmp/b19ts',{recursive:true});const out=`/tmp/b19ts/clr_${path.basename(glbFile)}_${box}_${re||''}.json`.replace(/[^A-Za-z0-9_./-]/g,'_');
 if(!fs.existsSync(out))cp.execFileSync('node',[path.join(H,'dump-mesh.cjs'),glbFile,box,out,...(re?[re]:[])],{stdio:'ignore'});return JSON.parse(fs.readFileSync(out,'utf8'));}
const SKIP=/instances|sky_dome|cloudsea|sea_surface|sea_foam|wave_line|surf_foam|anim_|far_hills|wet_sand/;
function envelopeProfile(){const d=dump(BUN+'region_transit_balloon/transport_balloon.glb','-50,-50,50,50','^balloon_envelope$');const T=Object.values(d).flat();const prof=(T=>{const prof=[];for(let y=2.9;y<=10.5+1e-6;y+=.1){let m=0;for(let k=0;k+9<=T.length;k+=9)for(const [a,b] of [[0,3],[3,6],[6,0]]){const ya=T[k+a+1],yb=T[k+b+1];if((ya-y)*(yb-y)>0||ya===yb){if(Math.abs(ya-y)<.05)m=Math.max(m,Math.hypot(T[k+a],T[k+a+2]));continue;}const u=(y-ya)/(yb-ya);m=Math.max(m,Math.hypot(T[k+a]+(T[k+b]-T[k+a])*u,T[k+a+2]+(T[k+b+2]-T[k+a+2])*u));}prof.push(m);}return prof;})(T);
 /* radius of the envelope surface at height y: max over triangle EDGES crossing y (vertex rings alone leave gaps) */
 return h=>{if(h<2.9||h>10.5)return 0;return prof[Math.min(prof.length-1,Math.round((h-2.9)/.1))];};}
function sampler(keys){const n=keys.length;return t=>{if(n===1)return keys[0].pos;let i=0;while(i<n-2&&t>keys[i+1].t)i++;const a=keys[Math.max(0,i-1)],b=keys[i],c=keys[Math.min(n-1,i+1)],d=keys[Math.min(n-1,i+2)];
 const u=c.t>b.t?Math.max(0,Math.min(1,(t-b.t)/(c.t-b.t))):0,u2=u*u,u3=u2*u;return [0,1,2].map(j=>0.5*(2*b.pos[j]+(-a.pos[j]+c.pos[j])*u+(2*a.pos[j]-5*b.pos[j]+4*c.pos[j]-d.pos[j])*u2+(-a.pos[j]+3*b.pos[j]-3*c.pos[j]+d.pos[j])*u3));};}
function check(doc,{dt=0.05,min=0.5}={}){let keys=Array.isArray(doc)?doc:doc.keys;const frame=(Array.isArray(doc)?null:doc.frame)||opt('--frame','skycity');
 keys=keys.map(k=>({...k,pos:frame==='world'?skyL(k.pos):k.pos}));const P=sampler(keys),T0=keys[0].t,T1=keys[keys.length-1].t;
 let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let t=T0;t<=T1+1e-9;t+=dt){const p=P(t);x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[2]);z1=Math.max(z1,p[2]);}
 const M=12,box=[x0-M,z0-M,x1+M,z1+M].map(v=>Math.round(v)).join(',');const sky=dump(BUN+'region_skycity/env_skycity.glb',box);
 const pts=[],names=[];for(const [n,v] of Object.entries(sky)){if(SKIP.test(n))continue;for(let k=0;k+9<=v.length;k+=9){const t=v.slice(k,k+9);
  const e=Math.max(Math.hypot(t[3]-t[0],t[4]-t[1],t[5]-t[2]),Math.hypot(t[6]-t[0],t[7]-t[1],t[8]-t[2]),Math.hypot(t[6]-t[3],t[7]-t[4],t[8]-t[5])),m=Math.max(1,Math.ceil(e/.2));
  for(let a=0;a<=m;a++)for(let b=0;a+b<=m;b++){const u=a/m,w=b/m;pts.push(t[0]+(t[3]-t[0])*u+(t[6]-t[0])*w,t[1]+(t[4]-t[1])*u+(t[7]-t[1])*w,t[2]+(t[5]-t[2])*u+(t[8]-t[2])*w);names.push(n);}}}
 const envR=envelopeProfile(),k0=keys[0].pos;
 const gapAt=p=>{const moored=Math.hypot(p[0]-k0[0],p[1]-k0[1],p[2]-k0[2])<.05;let g=99,who=null,hp=null;
  for(let i=0,j=0;i<pts.length;i+=3,j++){const h=pts[i+1]-p[1];if(h>10.8)continue;const d=Math.hypot(pts[i]-p[0],pts[i+2]-p[2]);if(d>8)continue;let gap;
   if(h>.02){const r=Math.max(envR(h),h<1.25?.96:0);if(r<=0){/* between basket rim and envelope: ropes/burner zone r .5 */gap=d-.5;}else gap=d-r;}
   else{if(moored||d>.96)continue;gap=-h-.03;}
   if(gap<g){g=gap;who=names[j];hp=[pts[i],pts[i+1],pts[i+2]];}}return {g,who,hp};};
 let best={g:99},per=[],n=0;for(let t=T0;t<=T1+1e-9;t+=dt){const p=P(t),r=gapAt(p);n++;if(r.g<best.g)best={...r,t,p};}
 for(const k of keys){const r=gapAt(k.pos);per.push({t:k.t,gap:+r.g.toFixed(3),hit:r.who});}
 const r3=a=>a&&a.map(v=>+v.toFixed(3));
 return {pass:best.g>=min,minGapM:+best.g.toFixed(3),atT:+best.t.toFixed(3),atPos:r3(best.p),hit:best.who,hitPoint:r3(best.hp),min,frameIn:frame,samples:n,perKey:per};}
module.exports={check,sampler};
if(require.main===module){const f=args.find(a=>!a.startsWith('--')&&!/^[0-9.]+$/.test(a)&&a!=='skycity'&&a!=='world');if(!f){console.error('usage: node check-lift-clearance.cjs <keys.json> [--frame skycity|world] [--dt 0.05] [--min 0.5]');process.exit(2);}
 const r=check(JSON.parse(fs.readFileSync(f,'utf8')),{dt:+opt('--dt',0.05),min:+opt('--min',0.5)});console.log(JSON.stringify(r,null,1));process.exit(r.pass?0:1);}
