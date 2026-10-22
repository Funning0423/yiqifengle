'use strict';
/* 场景特效bot r5 S3: scatter the existing LK_grass_tuft / LK_flower_clump / LK_rock over the bare near lawn that the free camera
 * sees at azimuths 135-270 (it looks south / south-east / east from the landing pivots), as LK_scatter_* instances in
 * scene_r5h_slim_transforms.json.  Same glTF material + land-fill class as the existing tufts / flowers / rocks, so they join
 * the existing static-merge chunks: no new draw call.  Kept off (lake-local):
 *  - the skycity walk / balloon-boarding lines (lakeside_skycity_mask.json route) within 12 m; under the rest of the deck
 *    footprint (skycity -> lakeside journey layout) an item is only kept, if need be smaller, when its top stays 5 cm under the deck,
 *  - the home island + the former island-bridge span, the S6/landing walk to the bank (x 1.2, z 24.5..60),
 *  - the lake board (grid x +-3.85, z 8.15..15.85) and the board camera's view (so the board background is unchanged),
 *  - the free-camera orbit ring (5.5-9.8 m around the landing pivots L0-L2), so no tuft fills the lens,
 *  - water / the sand rim (inside the lake plane, ground y < 0.25), slopes, and anything already standing there (first hit from above must be the ground).
 * Idempotent: earlier LK_scatter_* entries are replaced.  Deterministic (seeded).
 *   node tools/scene-fx/lakeside_near_scatter.cjs [--dry] */
const fs=require('fs'),path=require('path');
const LKS=require(path.join(__dirname,'../journey-integration/lakeside/lakeside-scene.cjs'));
const TF=LKS.B+'scene_r5h_slim_transforms.json',T=JSON.parse(fs.readFileSync(TF,'utf8'));
const SKY=JSON.parse(fs.readFileSync(path.join(__dirname,'lakeside_skycity_mask.json'),'utf8'));
const ROUTE=SKY.route,DECK=new Map(SKY.deck.map(c=>[Math.floor(c[0]/SKY.cell)+','+Math.floor(c[1]/SKY.cell),c[2]]));
const UNDER=new Map(SKY.under.map(c=>[c[0]+','+c[1],c[2]]));
const underSky=(x,z,r)=>{let m=null;for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++)for(let j=Math.floor(z-r);j<=Math.floor(z+r);j++){const v=UNDER.get(i+','+j);if(v!==undefined&&(m===null||v<m))m=v;}return m;};
const LAKE=[-50,50,-53,37],HGT={'LK_grass_tuft.glb':0.36,'LK_flower_clump.glb':0.296,'LK_rock.glb':0.30};
const HOME=[-14.5,10.1,50.1,75.4];
const BOARD={pos:[2.9448,3.58,31.1638],halfH:Math.atan(Math.tan(57.35/2*Math.PI/180)*390/844)};
let seed=20261018;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const C=2;
function grid(t){const G=new Map();for(let k=0;k<t.length;k+=9){const xs=[t[k],t[k+3],t[k+6]],zs=[t[k+2],t[k+5],t[k+8]];
 for(let i=Math.floor(Math.min(...xs)/C);i<=Math.floor(Math.max(...xs)/C);i++)for(let j=Math.floor(Math.min(...zs)/C);j<=Math.floor(Math.max(...zs)/C);j++){const key=i+','+j;if(!G.has(key))G.set(key,[]);G.get(key).push(k);}}return G;}
function topAt(objs,x,z){let best=null;for(const o of objs){const L=o.G.get(Math.floor(x/C)+','+Math.floor(z/C));if(!L)continue;const t=o.tris;
 for(const k of L){const ax=t[k],az=t[k+2],bx=t[k+3],bz=t[k+5],cx=t[k+6],cz=t[k+8],den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-12)continue;
  const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,c=1-a-b;if(a<-1e-9||b<-1e-9||c<-1e-9)continue;
  const y=a*t[k+1]+b*t[k+4]+c*t[k+7];if(y<25&&(!best||y>best.y)){const e1=[t[k+3]-t[k],t[k+4]-t[k+1],t[k+5]-t[k+2]],e2=[t[k+6]-t[k],t[k+7]-t[k+1],t[k+8]-t[k+2]];
   const n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],l=Math.hypot(...n);best={y,o,ny:Math.abs(n[1])/l};}}}return best;}
const all=LKS.instances().filter(o=>!/^LK_scatter_/.test(o.name)&&!/cloud/.test(o.glb));
for(const o of all)o.G=grid(o.tris);
const ground=all.find(o=>o.name==='LK_terrain_i');
const deckTop=(x,z,r)=>{let m=null;for(let i=Math.floor((x-r)/SKY.cell);i<=Math.floor((x+r)/SKY.cell);i++)for(let j=Math.floor((z-r)/SKY.cell);j<=Math.floor((z+r)/SKY.cell);j++){const v=DECK.get(i+','+j);if(v!==undefined&&(m===null||v<m))m=v;}return m;};
const routeDist=(x,z)=>{let m=1e9;for(const p of ROUTE){const d=(p[0]-x)**2+(p[1]-z)**2;if(d<m)m=d;}return Math.sqrt(m)-1.0;};
const rectDist=(x,z,R)=>Math.hypot(Math.max(R[0]-x,0,x-R[1]),Math.max(R[2]-z,0,z-R[3]));
function boardSees(x,y,z){const dz=BOARD.pos[2]-z;if(dz<=0.3)return false;return Math.abs(x-BOARD.pos[0])<dz*Math.tan(BOARD.halfH)+2.0;}
function ok(x,z){
 if(!(z>=14||x>=12))return null;                                      // the south / east lawn (free-camera azimuths 135-270)
 if(Math.hypot(x,z+10)>66)return null;                                 // near ground only
 if(routeDist(x,z)<=12)return null;
 if(rectDist(x,z,HOME)<=5)return null;
 if(Math.abs(x-1.2)<=3.5&&z>=21&&z<=62)return null;                    // landing / bridge walk
 if(Math.abs(x)<=6.5&&z>=5&&z<=19)return null;                         // lake board
 for(const pz of [36,30,24.5]){const d=Math.hypot(x-1.2,z-pz);if(d>=5.5&&d<=9.8)return null;}   // free-camera orbit (pivots L0-L2, lens ~7.4 m out): nothing in the lens' face
 const h=topAt(all,x,z);if(!h||h.o!==ground||h.ny<0.9||h.y<-1)return null;
 if(h.y<0.25&&x>LAKE[0]-2&&x<LAKE[1]+2&&z>LAKE[2]-2&&z<LAKE[3]+2)return null;
 if(boardSees(x,h.y,z))return null;
 for(const o of all){const b=o.box;if(o===ground||b[1][0]-b[0][0]>10||b[1][2]-b[0][2]>10)continue;  // terrain-sized pieces (lake, foam, far hills, bridge) are not 'props'
 if(x>b[0][0]-0.7&&x<b[1][0]+0.7&&z>b[0][2]-0.7&&z<b[1][2]+0.7&&b[0][1]<h.y+3)return null;}
 return h.y;}
// patch centres: Poisson-disk over valid candidates
const cand=[];for(let x=-60;x<=62;x+=1.5)for(let z=-20;z<=60;z+=1.5){const y=ok(x,z);if(y!==null)cand.push([x,z]);}
for(let i=cand.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[cand[i],cand[j]]=[cand[j],cand[i]];}
const centres=[];for(const c of cand){if(centres.every(p=>Math.hypot(p[0]-c[0],p[1]-c[1])>=5.5))centres.push(c);}
const out=[],placed=[];const q=yaw=>[0,+Math.sin(yaw/2).toFixed(5),0,+Math.cos(yaw/2).toFixed(5)];
function put(glb,x,z,s,tag){const y=ok(x,z);if(y===null)return false;
 // room under the skycity floor (its lowest surface over the item's footprint + 0.5 m), with the item's own y scale; a floor
 // surface below the lake ground there (rock strata dipping into it) rules the spot out
 const f=0.9+0.25*rnd(),us=underSky(x,z,0.5*s+0.5);if(us!==null){if(us<y)return false;const room=(us-0.05-y)/(HGT[glb]*f);if(room<0.6)return false;s=Math.min(s,room);}
 if(placed.some(p=>Math.hypot(p[0]-x,p[1]-z)<(glb==='LK_rock.glb'?1.0:0.45)))return false;
 placed.push([x,z]);const sy=s*f;out.push({name:'LK_scatter_'+tag+'_'+String(out.length).padStart(3,'0'),glb,group:'bg',pos:[+x.toFixed(4),+(y-(glb==='LK_rock.glb'?0.06:0.02)).toFixed(4),+z.toFixed(4)],
  rot_quat_xyzw:q(rnd()*Math.PI*2),scale:[+s.toFixed(4),+sy.toFixed(4),+s.toFixed(4)],animated:false});return true;}
centres.forEach((c,ci)=>{const nT=4+Math.floor(rnd()*4),nF=(ci%3===0)?1:0,rock=ci%4===2;  // flowers (104 tris) sparingly, tufts (9 tris) carry the patch
 const tryN=(glb,n,sMin,sMax,R,tag)=>{let k=0,a=0;while(k<n&&a++<30){const r=R*Math.sqrt(rnd()),t=rnd()*Math.PI*2;if(put(glb,c[0]+r*Math.cos(t),c[1]+r*Math.sin(t),sMin+(sMax-sMin)*rnd(),tag))k++;}};
 if(rock)tryN('LK_rock.glb',1,0.55,0.9,1.2,'rock');tryN('LK_flower_clump.glb',nF,1.3,1.8,1.6,'flower');tryN('LK_grass_tuft.glb',nT,1.5,2.3,2.4,'tuft');});
const cnt={};for(const o of out)cnt[o.glb]=(cnt[o.glb]||0)+1;
console.log(JSON.stringify({candidates:cand.length,patches:centres.length,placed:out.length,byGlb:cnt}));
if(process.argv.includes('--dry')){fs.writeFileSync('/tmp/lkscat/scatter.json',JSON.stringify(out));return;}
// written by Python's json (the format lakeside_far_ring.py / the exporter use), so untouched entries stay byte-identical
const py="import json,sys\nT=json.load(open(sys.argv[1]))\nA=json.load(sys.stdin)\nT['instances']=[i for i in T['instances'] if not i['name'].startswith('LK_scatter_')]+A\nT['instance_count']=len(T['instances'])\nopen(sys.argv[1],'w').write(json.dumps(T,separators=(',',':'),ensure_ascii=False))\nprint('instances',T['instance_count'])";
process.stdout.write(require('child_process').execFileSync('python3',['-c',py,TF],{input:JSON.stringify(out)}));
