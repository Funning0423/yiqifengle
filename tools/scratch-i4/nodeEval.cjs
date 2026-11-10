// NODE=I5 AT='[x,z]' [AVOID=..] node nodeEval.cjs
const cp=require('child_process'),fs=require('fs'),ROOT=__dirname+'/../..',BK=ROOT+'/tools/region-nodes/bake-region-nodes.cjs';
let b=fs.readFileSync(__dirname+'/bake.orig.cjs','utf8');
const L0=require('./lib.cjs');const RW=L0.J.H.load(L0.J.S+'region/RegionWalkable.ts');
let at=null;if(process.env.AT){const [x,z]=JSON.parse(process.env.AT);const y=RW.walkFloorY('island',x,z);if(y==null||!isFinite(y)){console.log(JSON.stringify({err:'off-walk'}));process.exit(0);}at=[x,+y.toFixed(3),z];b=b.replace(new RegExp("\\{key:'"+process.env.NODE+"',at:\\[[^\\]]*\\]"),"{key:'"+process.env.NODE+"',at:"+JSON.stringify(at));}
if(process.env.AVOID)b=b.replace(/routeAvoid:\[\[3\.04,2\.64,1\.45\][^\n]*?\]\],/,'routeAvoid:'+process.env.AVOID+',');
if(process.env.VIA)b=b.replace("const EDGE_VIA={island:{","const EDGE_VIA={island:{"+process.env.VIA+",");
fs.writeFileSync(BK,b);
try{cp.execSync('node '+BK,{cwd:ROOT,stdio:'pipe'});}catch(e){console.log(JSON.stringify({err:String(e.stderr).split('\n').filter(x=>/Error/.test(x))[0]}));process.exit(0);}
const L=L0,{clipCheck}=require('./clipchk.cjs');const E0=L.J.H.load(L.J.S+'region/ExploreCameraCore.ts'),lu=E0.followLookUp('island',99);
const N=JSON.parse(fs.readFileSync(ROOT+'/tools/region-nodes/region-nodes.json')).island;
const AVC=(b.match(/routeAvoid:(\[\[3\.04[^\n]*?\]\]),/)||[])[1];const av=AVC?JSON.parse(AVC):[];
const node=N.nodes.find(n=>n.key===process.env.NODE);const out={node:node.key,at:node.at,faceDeg:node.faceDeg,stand:{push:L.occl(L.P0,node.at).hf,board:L.occl(L.BOARD,node.at).hf},legs:{}};
for(const e of N.edges){if(process.env.LEGS?!process.env.LEGS.split(',').includes(e.a+'-'+e.b):(e.a!==node.key&&e.b!==node.key))continue;const p=e.path,Lt=L.plen(p);
 const fol=[];for(let k=0;k*0.12<=Lt+1e-9;k++){const s=k*0.12,g=L.along(p,s),a=L.along(p,Math.max(0,s-0.3)),c2=L.along(p,Math.min(Lt,s+0.3));const c=E0.followPose(g,Math.atan2(c2[0]-a[0],c2[2]-a[2]),390,844,lu);const o=L.occl(c.position,g);if(o.hf>0)fol.push([+(k/10).toFixed(1),Math.round(o.hf),Object.keys(o.who).join('|')]);}
 const head=[];for(let s=0;s<=Lt;s+=0.1){const g=L.along(p,s);if(L.J.blockers(L.occ,[g[0],g[1]+1.75,g[2]],[g[0],g[1]+3.25,g[2]]).length)head.push(+s.toFixed(1));}
 let unw=0,inA=0,mA=99;for(let s=0;s<=Lt;s+=0.05){const g=L.along(p,s),y=RW.walkFloorY('island',g[0],g[2]);if(y==null||!isFinite(y))unw++;for(const [x,z,r] of av){const d=Math.hypot(g[0]-x,g[2]-z)-r;mA=Math.min(mA,d);if(d<0)inA++;}}
 const t=L.trunkClear(p),c=clipCheck(p);const mt=Object.entries(t).sort((x,y)=>x[1]-y[1])[0];
 out.legs[e.a+'-'+e.b]={len:e.lengthM,s:+(e.lengthM/1.2).toFixed(2),minTrunk:mt,tall01:t.env_prop_palm_tall_01,beachTall:t['beach_palm_tall#beach_palm_tall'],clip:Object.keys(c).filter(n=>c[n].clip),head:head.length,unw,inAvoid:inA,avoidMargin:+mA.toFixed(3),follow:fol,pushin:[]};}
console.log(JSON.stringify(out));
