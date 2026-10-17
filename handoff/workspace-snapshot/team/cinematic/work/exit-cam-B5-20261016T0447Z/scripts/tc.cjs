const path=require('path');const S=require(path.join(process.argv[2],'tools/camera-frame-test/flow_sim.cjs'));const env=S.create();const c=env.cfg;
console.log(JSON.stringify({a:c.walkDuration(c.outCrossing),b:c.walkDuration(c.toIsland)}));
