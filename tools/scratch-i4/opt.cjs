// usage: I3='[x,y,z]' node opt.cjs NAME '[via34|null]' ; bakes with committed de236c06 I4 + routeAvoid
const L=require('./lib.cjs'),{bake}=require('./eval.cjs'),{clipCheck}=require('./clipchk.cjs'),fs=require('fs');
const E0=L.J.H.load(L.J.S+'region/ExploreCameraCore.ts');const lu=E0.followLookUp('island',99);
const AV=[[3.04,2.64,1.45],[4.6,3.8,0.35],[3.85,4.8,0.3],[4.8,7.9,0.9],[7.6,7.2,0.75],[2.1,3.5,0.5]];const name=process.argv[2],via=JSON.parse(process.argv[3]);
const E=bake([3.9,0.089,3.9],via,AV);const nodes=JSON.parse(fs.readFileSync('../region-nodes/region-nodes.json')).island.nodes;const I3=nodes.find(n=>n.key=='I3').at;
const head=p=>{const o=[];const Lt=L.plen(p);for(let s=0;s<=Lt;s+=0.1){const g=L.along(p,s);const up=L.J.blockers(L.occ,[g[0],g[1]+1.75,g[2]],[g[0],g[1]+3.25,g[2]]);if(up.length)o.push([+s.toFixed(1),up]);}return o;};
const legs={};for(const k of ['I2-I3','I3-I4']){const e=E[k];legs[k]={graph:e.lengthM,poly:+L.plen(e.path).toFixed(3),s:+(L.plen(e.path)/1.2).toFixed(2),cutToday:e.lengthM>9.6,trunk:L.trunkClear(e.path),clip:clipCheck(e.path),headroomHits:head(e.path),path:e.path};}
const p=E['I3-I4'].path;
// follow camera along I3->I4 (390x844), face+chest blocked
const fol=[];const Lt=L.plen(p);for(let k=0;k*0.12<=Lt+1e-9;k++){const s=k*0.12,g=L.along(p,s),a=L.along(p,Math.max(0,s-0.3)),b=L.along(p,Math.min(Lt,s+0.3));const yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);const cp=E0.followPose(g,yaw,390,844,lu);const o=L.occl(cp.position,g);if(o.hf>0)fol.push([+(k/10).toFixed(1),Math.round(o.hf),Object.keys(o.who)]);}
const st=L.leanEp(p);
const out={name,I3,via,legs,stand_I3:{push:L.occl(L.P0,I3),board:L.occl(L.BOARD,I3)},pushin_lean:st.ep,pushin_series_t_hf_lean_body:st.series,follow_headface_blocked:fol};
fs.writeFileSync(process.env.OUT+'/'+name+'.json',JSON.stringify(out,null,1));
console.log(name,'I3',JSON.stringify(I3),JSON.stringify(Object.fromEntries(Object.entries(legs).map(([k,v])=>[k,[v.graph,v.poly,v.s,v.cutToday,Math.min(...Object.entries(v.trunk).filter(([n])=>!/rear/.test(n)).map(x=>x[1])),Object.entries(v.clip).filter(([n,c])=>c.clip).map(x=>x[0]).join()||'noclip',v.headroomHits.length]]))),'stand',JSON.stringify(out.stand_I3),'lean',JSON.stringify(st.ep),'follow',JSON.stringify(fol));
