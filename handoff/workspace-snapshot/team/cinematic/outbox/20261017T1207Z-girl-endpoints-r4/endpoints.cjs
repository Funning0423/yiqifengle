const J=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/journey-scene.cjs');
const g=require('/workspace/tmp-lkcam/wt-r4/tools/journey-integration/girl-frame.cjs');
const r3=v=>v.map(x=>Math.round(x*1000)/1000),deg=(a,b)=>{let y=Math.atan2(b[0]-a[0],b[2]-a[2])*180/Math.PI;return Math.round(y*10)/10;};
const scr=[[390,844],[414,896],[360,780],[375,667],[390,520],[320,568],[768,1024],[1024,768]];
const meadow=scr.map(([w,h])=>{const s=J.standFor(w,h),p=s.path,e=p.at(-1),pr=p.at(-2),je=J.meadowSrc.map.toJourney(e),jp=J.meadowSrc.map.toJourney(pr),gr=g.find(r=>r.region==='meadow'&&r.screen===w+'x'+h);
 return {screen:w+'x'+h,stopAlongStandLineM:Math.round(s.distanceM*100)/100,clear:s.clear,tsYawDeg:s.yawDeg,tsLocal:r3(s.local),
  model:{position:r3(e),yawDeg:deg(pr,e),forwardXZ:r3([(e[0]-pr[0]),(e[2]-pr[2])].map((v,_,a)=>v/Math.hypot(...a)))},
  journeyWorld:{position:r3(je),yawDeg:deg(jp,je)},
  walkFromSpawnM:Math.round(p.slice(1).reduce((a,q,i)=>a+Math.hypot(q[0]-p[i][0],q[2]-p[i][2]),0)*100)/100,
  pathModel:p.map(r3),
  visibility:gr&&{visible:gr.visible,cropped:gr.cropped,coveredBy3ToolUi:gr.coveredBy3ToolUi,gapPt:gr.gapPt,boxPt:gr.boxPt,widthFrac:gr.widthFrac,inFrameLimits:gr.inFrameLimits}};});
console.log(JSON.stringify({sha:'2665429bcc6c6229faad2d2f08368731fb588e7d',branch:'cine/region-hooks-meadow-r4-ggkeepout',alternative:{sha:'95d3eeed53e6c67a85ac05e47b9105672976fde7',branch:'cine/region-hooks-meadow-skycity-r4',note:'O5/F7b pass but 390x844/414x896 stop overlaps the hint line, 360x780 edge'},conventions:{model:'meadow GLB local = board copy local (meadowScenePose frame); y = terrain top under feet',journeyWorld:'island-journey world (meadow placed yaw 180 + offset)',yawDeg:'atan2(dx,dz) of her last walk segment, 0=+Z, +90=+X; GGbot copies her actual landed transform so no constant needs to be hard-coded',ui:'boardLayout + toolSlots(lay,3) icons +2 pt sides/top +4 pt bottom, hint toast band 36 pt full width (portrait), goals 4, boardSafeInsets; independently checked against GGbot toolbar rects + hint line'},
 meadow,
 skycity:{status:'BLOCKED - needs reviewer decision',currentArrivalJourneyWorld:[-42.26,-4.71,60.32],visibleOnAnyScreen:false,
  inFrameCandidatesWorld:{'390x844/414x896/360x780':[-0.8,-0.2,44.6],'375x667':[-1,-0.18,43.5],'390x520':[-2,-0.1,40]},
  blockers:['only walkable link terminus->court is the cloud bridge (anchor_cloudbridge_end -> _start); static deck missing 12.5-15.1 m (broken-bridge state)','state_bridge_before plank floats 1.7-2.5 m above deck => head clip; both bridge states are in the GLB with nothing toggling them (engine-side hiding not verified)','walk arrival->court front ~61 m (~+50 s at 1.2 m/s) breaks O5 (<=3 s) and O4'],
  options:{A:'walk over the cloud bridge: needs bridge state decision (show after-state only) + waive O5 (+~50 s)',B:'re-layout so the rainbow bridge lands on the court front rim (flat y -0.25, z~48.5, x~-1); ~5-10 m walk, duration ~unchanged; changes O4 real-entrance decision + lens/occlusion retune',C:'change skycity board camera composition to include the current arrival (09 plaza files SHA-frozen; design decision)'}}},null,1));
