const L=require('./lib.cjs'),fs=require('fs');const E0=L.J.H.load(L.J.S+'region/ExploreCameraCore.ts'),lu=E0.followLookUp('island',99);
const {createHarness}=require('/workspace/tmp-exp/wt-nw/tools/board-ui/harness.cjs');const W=createHarness().load('region/NodeWalker.ts');
const N=JSON.parse(fs.readFileSync(__dirname+'/../region-nodes/region-nodes.json')).island;const at=k=>N.nodes.find(n=>n.key===k).at;
const paths={};for(const k of ['I4-I5','I5-I6','I4-I6']){const e=N.edges.find(x=>x.a+'-'+x.b===k);paths[k]=e.path;}
const via=[[4.9,-0.42,9.3],[3.7,-0.43,9.3],[3.3,-0.04,8.5],[2.8,0.01,7.5],[3.0,0.01,6.3],[4.3,0.02,5.3],[4.5,0.07,4.5]];
const pl=W.planChained([at('I3'),...via,at('I4')],[],via);paths['E_I3-I4']=pl.segments[0].path||pl.segments[0];if(!Array.isArray(paths['E_I3-I4']))paths['E_I3-I4']=paths['E_I3-I4'].path;
const out={};for(const [k,p] of Object.entries(paths)){const Lt=L.plen(p),rows=[];
 for(let i=0;i*0.12<=Lt+1e-9;i++){const s=i*0.12,g=L.along(p,s),a=L.along(p,Math.max(0,s-0.3)),b=L.along(p,Math.min(Lt,s+0.3));const yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);const c=E0.followPose(g,yaw,390,844,lu);const o=L.occl(c.position,g);
  const fl=Math.hypot(g[0]-3.805,g[2]-4.83);rows.push({t:+(s/1.2).toFixed(2),s:+s.toFixed(2),her:g.map(v=>+v.toFixed(3)),yawDeg:+(yaw*180/Math.PI).toFixed(1),cam:c.position.map(v=>+v.toFixed(3)),target:c.target.map(v=>+v.toFixed(3)),fov:c.fovVerticalDeg,headFacePct:Math.round(o.hf),bodyPct:Math.round(o.body),occluders:Object.keys(o.who),flowerDistM:+fl.toFixed(2)});}
 out[k]={lengthM:+Lt.toFixed(3),rows};}
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));
for(const [k,v] of Object.entries(out)){const bad=v.rows.filter(r=>r.headFacePct>0);console.log(k,v.lengthM,bad.map(r=>r.t+':'+r.headFacePct+':'+r.occluders.join('|')).join(' '));const fl=v.rows.filter(r=>r.flowerDistM<0.3);if(fl.length)console.log('  flower',fl.map(r=>r.t+'@'+r.flowerDistM).join(' '));}
