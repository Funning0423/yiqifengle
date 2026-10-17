// node realwalk_speed.cjs <repoRoot> <out.json> : 60fps flow_sim with GGbot's REAL walk driver, outbound camera/walk speed.
const path=require('path');const S=require(path.join(process.argv[2],'tools/camera-frame-test/flow_sim.cjs'));
(async()=>{for(const real of [false,true]){const env=S.create({realWalk:real}),run=await S.run(env,{script:['leaveHome'],fps:60}),F=run.frames;
 const o=F.filter(f=>f.state==='crossing-out');const sp=[];for(let i=1;i<o.length;i++){const a=o[i-1],b=o[i],dt=b.t-a.t;
  sp.push({t:b.t,cam:Math.hypot(...b.cam.position.map((v,k)=>v-a.cam.position[k]))/dt,walk:Math.hypot(b.root[0]-a.root[0],b.root[2]-a.root[2])/dt,pos:b.cam.position});}
 const cr=sp.filter(s=>s.cam>0.85*Math.max(...sp.map(s=>s.cam)));const m=cr.reduce((a,s)=>a+s.cam,0)/cr.length;
 const wk=sp.filter(s=>s.walk>0.05);
 console.log(JSON.stringify({realWalk:real,camMax:Math.max(...sp.map(s=>s.cam)),cruiseMean:m,cruiseFrom:cr[0].t,cruiseTo:cr[cr.length-1].t,
   walkMean:wk.reduce((a,s)=>a+s.walk,0)/wk.length,walkMax:Math.max(...wk.map(s=>s.walk)),outboundSeconds:o[o.length-1].t-o[0].t,final:o[o.length-1].cam}));
 require('fs').writeFileSync(process.argv[3].replace('.json',real?'_realwalk.json':'_const.json'),JSON.stringify(sp));}})();
