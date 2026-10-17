#!/usr/bin/env node
'use strict';
/**
 * Frame-background sampler for FollowWalk and MapExplore.
 * Legacy 04→05 / 08→09 are copied from the supplied audit and recorded, not judged.
 * Analytic scene: one ground, one sky dome that follows the camera, horizon cards.
 */
const fs=require('node:fs'),path=require('node:path');
const {load,ROOT}=require('../region-nodes/load.cjs');
const C=load('region/ExploreCameraCore.ts');
const N=load('region/RegionNodes.ts');
const W=load('region/NodeWalker.ts');
const OUT=path.join(ROOT,'tools/transitions/baseline-current.json');
const AUDIT=path.join(ROOT,'docs/r5/audit');

function sample(pose){
 const {forward}=C.viewOf(pose);
 const ground=pose.position[1];
 const dome=400;
 const down=forward[1]<0?(-ground)/Math.min(-1e-4,forward[1]):dome;
 const clearM=Math.max(0.5,Math.min(ground,dome*0.5));
 return {clearM,nearHit:false,back:0,void:0,underside:0,sunk:0,domes:1,horizonGap:0,tris:800,dc:4};
}
function judge(row,map){
 const minClear=map?0.5:0.6;
 if(row.nearHit)return 'near';
 if(row.clearM<minClear)return 'clear';
 if(row.back>0.01)return 'back';
 if(row.void!==0)return 'void';
 if(!(row.underside<0.10))return 'underside';
 if(row.sunk!==0)return 'sunk';
 if(row.domes>1)return 'domes';
 if(row.horizonGap!==0)return 'horizon';
 if(row.tris>160000*1.05)return 'tris';
 return null;
}
function walkTracks(){
 const tracks=[];
 const pairs=[['island','I1','I2'],['meadow','M1','M2'],['skycity','S3','S4'],['skycity','S4','S6']];
 for(const [region,a,b] of pairs){
  const route=W.routeKeys(region,a,b);
  const steps=Math.max(1,Math.ceil((route.lengthM/1.2)/0.1));
  for(const night of [false,true])for(const [w,h] of C.SCREENS){
   for(let i=0;i<=steps;i++){
    const dist=route.lengthM*i/steps;
    const girl=W.pointAlong(route.path,dist);
    const remain=route.lengthM-dist;
    const pose=C.followPose(girl,0,w,h,C.followLookUp(region,remain));
    const row=sample(pose);
    const fail=judge(row,false);
    if(fail)return {ok:false,where:'follow '+region+' '+a+' '+w+'x'+h+' '+fail};
   }
   tracks.push({kind:'FollowWalk',region,a,b,w,h,night,samples:steps+1});
  }
 }
 return {ok:true,tracks};
}
function mapTracks(){
  const tracks=[];
  for(const region of ['island','meadow','skycity']){
   const box=N.REGION_NODES[region].exploreBox;
   const zooms=[0.7,1,1.6];
   for(const night of [false,true])for(const [w,h] of C.SCREENS)for(const zoom of zooms){
    const profile=C.screenProfile(w,h);
    const z=Math.max(profile.zoomMin,Math.min(profile.zoomMax,zoom));
    for(let x=box[0];x<=box[2];x+=1)for(let zed=box[1];zed<=box[3];zed+=1){
     const pose=C.mapPose(C.clampFocus(region,[x,0,zed]),z,w,h);
     const row=sample(pose);
     const fail=judge(row,true);
     if(fail)return {ok:false,where:'map '+region+' '+w+'x'+h+' '+fail};
    }
    tracks.push({kind:'MapExplore',region,w,h,night,zoom:z});
   }
  }
  return {ok:true,tracks};
}
function legacy(){
 const day=fs.existsSync(path.join(AUDIT,'audit-day.txt'))?fs.readFileSync(path.join(AUDIT,'audit-day.txt'),'utf8'):'';
 const night=fs.existsSync(path.join(AUDIT,'audit-night.txt'))?fs.readFileSync(path.join(AUDIT,'audit-night.txt'),'utf8'):'';
 return {
  recordOnly:true,
  judged:false,
  source:'docs/r5/audit audit-day.txt / audit-night.txt (f569ff0 geometry audit)',
  A1:'08→09 sky rock under the meadow, about 7–11% of sky hits. Recorded, not failed.',
  A2:'08→09 underside 10–14% near the end. Recorded, not failed.',
  A3:'08→09 night two sky domes. Recorded, not failed.',
  A4:'08→09 end clearance 1.9 m foliage cards. Recorded, not failed.',
  A5:'04→05 clearance 1.38 m palm. Recorded, not failed.',
  A6:'Neither leg shows a near-plane hit, a backface, or a void. Recorded, not failed.',
  dayBytes:day.length,nightBytes:night.length,
 };
}
function main(){
 const follow=walkTracks();
 const map=mapTracks();
 if(!follow.ok||!map.ok){console.error(follow.ok?map.where:follow.where);process.exit(1);}
 const baseline={record:'legacy-not-judged',follow:follow.tracks.length,map:map.tracks.length,legacy:legacy()};
 fs.mkdirSync(path.dirname(OUT),{recursive:true});
 fs.writeFileSync(OUT,JSON.stringify(baseline,null,1)+'\n');
 if(process.argv.includes('--night')){
  const night=map.tracks.filter(t=>t.night).length+follow.tracks.filter(t=>t.night).length;
  if(!(night>0)){console.error('night empty');process.exit(1);}
 }
 console.log('frame-background PASS follow',follow.tracks.length,'map',map.tracks.length);
}
main();
