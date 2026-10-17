'use strict';
// her route distance vs time = RegionJourneyCore.journeyDistanceAt(L, LAKESIDE_CAMERA_LAYOUT.timing, t) (the walk action's distanceAt), 60 Hz.
const fs=require('fs'),W='/workspace/wechat-game/work/wt-lk',{createHarness}=require(W+'/tools/board-ui/harness.cjs'),H=createHarness(),S=W+'/creator-build-project/assets/scripts/';
const Core=H.load(S+'world-r1/RegionJourneyCore.ts'),LK=H.load(S+'region/LakesideCameraLayout.ts'),dump=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),L=Core.routeLength(dump.path),TM=LK.LAKESIDE_CAMERA_LAYOUT.timing,fps=60;
const frames=[];for(let i=0;i/fps<=TM.durationS+2+1e-9;i++){const t=i/fps;frames.push({t,s:t>=TM.durationS?L:Core.journeyDistanceAt(L,TM,t)});}
fs.writeFileSync(process.argv[3],JSON.stringify({L,D:TM.durationS,fps,timing:TM,frames}));console.log('frames',frames.length);
