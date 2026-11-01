'use strict';
// Reads the current (d9423886+) code constants the stance data is built on, as JSON on stdout. No engine.
const {load}=require('../region-nodes/load.cjs');
const TL=load('region/TransportLeg.ts'),SL=load('region/SailLanding.ts'),BF=load('region/BalloonFlight.ts'),LC=load('region/LakesideCameraLayout.ts'),LB=load('region/LakesideBalloon.ts'),RN=load('region/RegionNodes.ts');
const sr=TL.sailRoute(),tl=TL.sailBeats(sr.length);
const v0=TL.sailVehicle(tl,sr.samples,0),vEnd=TL.sailVehicle(tl,sr.samples,tl.beats.find(b=>b.id==='S-e').t1);
const yr=d=>d*Math.PI/180,rot=(deg,p)=>{const c=Math.cos(yr(deg)),s=Math.sin(yr(deg));return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
const CW=BF.CW_JSON,skyToW=p=>{const r=rot(CW.yawDeg,p);return [r[0]+CW.origin[0],r[1]+CW.origin[1],r[2]+CW.origin[2]];},skyL=w=>rot(-CW.yawDeg,[w[0]-CW.origin[0],w[1]-CW.origin[1],w[2]-CW.origin[2]]);
const node=(r,k)=>RN.REGION_NODES[r].nodes.find(n=>n.key===k);
const S6=node('skycity','S6').at,L=LC.lakesideJourney(skyToW(S6)),lakeL=w=>rot(-L.yawDeg,[w[0]-L.root[0],w[1]-L.root[1],w[2]-L.root[2]]);
const K=LB.LAKESIDE_BALLOON_LANDING,shore=L.arrival[L.arrival.length-1],moored=LB.lakesideBalloonMooring(shore,L.toWorld);
const flight=require('../../creator-build-project/assets/bundles/region_transit_balloon/balloon_flightpath.json');
const r3=a=>a.map(v=>+(+v).toFixed(4));
console.log(JSON.stringify({
 sail:{I6:TL.SAIL_I6,berthX:TL.SAIL_BERTH_X,waterY:TL.SAIL_WATER_Y,boat0:{pos:r3(v0.pos),yawRad:v0.yaw},boatEnd:{pos:r3(vEnd.pos),yawRad:vEnd.yaw},meadowRoot:TL.sailMeadowRoot(),
  beats:tl.beats,build05S:tl.build05S,arrivalS:tl.arrivalS,landingStep:SL.SAIL_LANDING_STEP_LOCAL,landingBerth:SL.SAIL_LANDING_BERTH_LOCAL,landingWalk:SL.SAIL_LANDING_WALK_KEYS,M0:TL.SAIL_M0_LOCAL,M1:TL.SAIL_M1_LOCAL,deckLocal:SL.SAIL_LANDING_DECK_LOCAL},
 nodes:RN.REGION_NODES,
 balloon:{flight0:flight.keys[0],flightEnd:flight.keys[flight.keys.length-1],landT:BF.LAND_T,duration:BF.FLIGHT_DURATION,landSkyLocal:r3(skyL(BF.S0_GAME)),landYawSkyDeg:+(flight.keys[flight.keys.length-1].yawDeg-CW.yawDeg).toFixed(3),girlYawDeg:-76.6},
 lake:{yawDeg:L.yawDeg,root:L.root,skyYawDeg:CW.yawDeg,K:{mooringLocal:K.mooringLocal,launchLocal:K.launchLocal,walkLocal:K.walkLocal,exitStartLocal:K.exitStartLocal,exitIdleS:K.exitIdleS,doorContactS:K.doorContactS,doorOpenDeg:K.doorOpenDeg,doorOpenS:K.doorOpenS,walkStartAfterReachS:K.walkStartAfterReachS,exitWalkMps:K.exitWalkMps,basketFloorM:K.basketFloorM},
  launchSky:r3(skyL(L.toWorld(K.launchLocal))),walkSky:K.walkLocal.map(p=>r3(skyL(L.toWorld(p)))),
  moored:{mooringLake:r3(lakeL(moored.mooring)),startLake:r3(lakeL(moored.start)),walkLake:moored.walk.map(p=>r3(lakeL(p))),doorYawDeg:moored.doorYawDeg,startYawDegLake:+(moored.startYawRad*180/Math.PI-L.yawDeg).toFixed(3),length:moored.length,walkS:moored.walkS,T0:moored.T0,doorAt:moored.doorAt,walkStartAt:moored.walkStartAt,mps:moored.mps}},
 stepdown:{durationS:LB.LAKESIDE_STEPDOWN.durationS,forwardEnd:LB.LAKESIDE_STEPDOWN.forwardEnd,dropM:Math.min(...LB.LAKESIDE_STEPDOWN.y)},standup:{durationS:LB.LAKESIDE_STANDUP.durationS,forwardEnd:LB.LAKESIDE_STANDUP.forwardEnd},
}));
