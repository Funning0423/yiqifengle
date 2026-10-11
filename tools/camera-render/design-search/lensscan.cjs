const dir=process.argv[2];process.chdir(dir);
const S=require(dir+'/flow_sim.cjs'),G=require(dir+'/glb_geometry.cjs'),T9=require(dir+'/t9_props.cjs'),L=require(dir+'/lens_rays.cjs'),K=require(dir+'/metrics.cjs');
(async()=>{const env=S.create();const run=await S.run(env);const F=run.frames;const base=await G.decode(),geo=await T9.merged(base)||base,I=G.index(geo);
 const t0=Date.now();const bySeg={};let worst=[];const xo=F.findIndex(f=>f.state==='crossing-out');
 F.forEach((f,i)=>{const s=L.sample(env.C,I,f.cam,586/1266);const k=f.state;const b=bySeg[k]||(bySeg[k]={frames:0,nearPropFrames:0,nearArchFrames:0,maxCover:0,maxCoverProps:0,meshes:{}});b.frames++;
  if(s.nearProps){b.nearPropFrames++;worst.push({i,t:+(f.t-F[xo].t).toFixed(3),state:k,near:s.near,cov:+s.cover.toFixed(2)});}if(s.nearArch)b.nearArchFrames++;
  b.maxCover=Math.max(b.maxCover,+s.cover.toFixed(3));b.maxCoverProps=Math.max(b.maxCoverProps,+s.coverProps.toFixed(3));for(const m in s.near)b.meshes[m]=(b.meshes[m]||0)+1;});
 console.log(JSON.stringify(bySeg,null,0));console.log('ms',Date.now()-t0,'frames',F.length);
 const groups=[];for(const w of worst){const g=groups[groups.length-1];if(g&&w.i-g.last<=3){g.last=w.i;g.t1=w.t;g.n++;Object.assign(g.near,w.near);g.maxCov=Math.max(g.maxCov,w.cov);}else groups.push({first:w.i,last:w.i,t0:w.t,t1:w.t,state:w.state,n:1,near:{...w.near},maxCov:w.cov});}
 console.log(JSON.stringify(groups));
 const ev=run.cameraEvents;console.log('events',JSON.stringify(ev.map(e=>[e.kind,e.place||'',+(e.t-F[xo].t).toFixed(3)])));
 console.log('states',JSON.stringify(run.states.map(s=>[s.state,+(s.frame/60-F[xo].t).toFixed(3)])));
})();
