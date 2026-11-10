// usage: SP='[x,y,z]' I3='[x,y,z]' node dEval.cjs '<via json [[x,z],..]>'   (via y from walkFloorY)
const cp=require('child_process'),fs=require('fs'),ROOT=__dirname+'/../..';
const LAY=ROOT+'/creator-build-project/assets/scripts/world-r2/IslandPropsLayout.ts';
const BK=ROOT+'/tools/region-nodes/bake-region-nodes.cjs';
if(process.env.SP){let s=fs.readFileSync(LAY,'utf8');s=s.replace(/prefab: 'beach_palm_short', position: \[[^\]]*\]/,`prefab: 'beach_palm_short', position: ${process.env.SP}`);fs.writeFileSync(LAY,s);}
let b=fs.readFileSync(__dirname+'/bake.orig.cjs','utf8');if(process.env.I3)b=b.replace(/\{key:'I3',at:\[[^\]]*\]/,"{key:'I3',at:"+process.env.I3);if(process.env.AVOID)b=b.replace(/routeAvoid:\[\[3\.04,2\.64,1\.45\][^\n]*?\]\],/,'routeAvoid:'+process.env.AVOID+',');
if(process.env.VIA34)b=b.replace('const EDGE_VIA={}',"const EDGE_VIA={island:{'I3-I4':"+process.env.VIA34+"}}");fs.writeFileSync(BK,b);
try{cp.execSync('node tools/region-walkable/bake-region-walkable.cjs && node '+BK,{cwd:ROOT,stdio:'pipe'});}catch(e){console.log(JSON.stringify({err:String(e.stderr).split('\n').filter(x=>/Error/.test(x))[0]}));process.exit(0);}
const L=require('./lib.cjs'),{clipCheck}=require('./clipchk.cjs');
const {createHarness}=require('/workspace/tmp-exp/wt-nw/tools/board-ui/harness.cjs');const W=createHarness().load('region/NodeWalker.ts');
const RW=L.J.H.load(L.J.S+'region/RegionWalkable.ts'),E0=L.J.H.load(L.J.S+'region/ExploreCameraCore.ts'),lu=E0.followLookUp('island',99);
const N=JSON.parse(fs.readFileSync(ROOT+'/tools/region-nodes/region-nodes.json')).island;const at=k=>N.nodes.find(n=>n.key===k).at;const I3=at('I3'),I4=at('I4');
const _E0=N.edges.find(e=>e.a==='I3'&&e.b==='I4');const _vv=process.argv[2]==='BAKED'?_E0.path.slice(1,-1).map(q=>[q[0],q[2]]):JSON.parse(process.argv[2]||'[]');const via=_vv.map(([x,z])=>[x,+((RW.walkFloorY('island',x,z)??-9)).toFixed(3),z]);
let curve,poly,legs=null;const E={};for(const e of N.edges)E[e.a+'-'+e.b]=e;
if(via.length){poly=[I3,...via,I4];const pl=W.planChained(poly,[],via);curve=pl.segments[0].path||pl.segments[0];legs=pl.legs;}else{curve=E['I3-I4'].path;poly=curve;}
if(!Array.isArray(curve))curve=curve.path;
const Lt=L.plen(curve);const unw=[];for(let s=0;s<=Lt;s+=0.05){const g=L.along(curve,s),y=RW.walkFloorY('island',g[0],g[2]);if(y==null||!isFinite(y))unw.push([+g[0].toFixed(2),+g[2].toFixed(2)]);}
const fol=[];for(let k=0;k*0.12<=Lt+1e-9;k++){const s=k*0.12,g=L.along(curve,s),a=L.along(curve,Math.max(0,s-0.3)),b2=L.along(curve,Math.min(Lt,s+0.3));const yaw=Math.atan2(b2[0]-a[0],b2[2]-a[2]);const c=E0.followPose(g,yaw,390,844,lu);const o=L.occl(c.position,g);if(o.hf>0)fol.push([+(k/10).toFixed(1),Math.round(o.hf),Object.keys(o.who)]);}
const head=[];for(let s=0;s<=Lt;s+=0.1){const g=L.along(curve,s);const up=L.J.blockers(L.occ,[g[0],g[1]+1.75,g[2]],[g[0],g[1]+3.25,g[2]]);if(up.length)head.push([+s.toFixed(1),up]);}
const cl=clipCheck(curve);const e23=E['I2-I3'];const c23=clipCheck(e23.path);
const AVC=JSON.parse(process.env.AVC||'[]');let inAv=0,avMargin=99;for(let s=0;s<=Lt;s+=0.05){const g=L.along(curve,s);for(const [ax,az,ar] of AVC){const d=Math.hypot(g[0]-ax,g[2]-az)-ar;avMargin=Math.min(avMargin,d);if(d<0)inAv++;}}
const r={inAvoid:inAv,avoidMarginM:+avMargin.toFixed(3),SP:process.env.SP||null,I3,I4,via,polyM:+L.plen(poly).toFixed(3),legs,curveM:+Lt.toFixed(3),curveS:+(Lt/1.2).toFixed(2),unwalkable:unw.length,unwSample:unw.slice(0,4),
 trunk:L.trunkClear(curve),clip:Object.fromEntries(Object.entries(cl).filter(([n,x])=>x.clip)),headroom:head.length,headSample:head.slice(0,3),
 stand:{push:L.occl(L.P0,I3),board:L.occl(L.BOARD,I3)},leanPush:L.leanEp(curve).ep,follow:fol,
 I2I3:{len:e23.lengthM,s:+(e23.lengthM/1.2).toFixed(2),trunk:L.trunkClear(e23.path),clip:Object.keys(c23).filter(n=>c23[n].clip)},
 I4I6:E['I4-I6'].lengthM,curve:curve.filter((_,i)=>i%10==0).map(q=>q.map(v=>+v.toFixed(3)))};
console.log(JSON.stringify(r));
