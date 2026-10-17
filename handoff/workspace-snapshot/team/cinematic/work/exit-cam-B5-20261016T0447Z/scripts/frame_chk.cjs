const path=require('path');const wt=process.argv[2];const S=require(path.join(wt,'tools/camera-frame-test/flow_sim.cjs')),K=require(path.join(wt,'tools/camera-frame-test/metrics.cjs'));
(async()=>{const env=S.create(),run=await S.run(env,{script:['leaveHome'],fps:60}),F=run.frames,C=env.C;const o=F.filter(f=>f.state==='crossing-out'),t0=o[0].t;let prev=null;
for(const f of o){const m=K.framing(C,f);const mm=m.behind?-1:Math.min(m.topMargin,m.bottomMargin,m.sideMargin);const bad=mm<0;
 if(bad!==prev){console.log((f.t-t0).toFixed(3),bad?'OUT':'in',JSON.stringify({top:+m.topMargin.toFixed(3),bot:+m.bottomMargin.toFixed(3),side:+m.sideMargin.toFixed(3),behind:m.behind}));prev=bad;}}})();
