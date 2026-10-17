const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
for(const [w,h] of [[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024],[1024,768]]){const s=J.standFor(w,h);const b=s.boxPt;
console.log(w+'x'+h,'d',s.distanceM.toFixed(2),'clear',s.clear,'gap',s.gapPt.toFixed(1),'inFL',s.inFrameLimits,'box x',b.l.toFixed(0)+'-'+b.r.toFixed(0),'y',b.t.toFixed(0)+'-'+b.b.toFixed(0));}
