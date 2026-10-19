'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHarness}=require('../board-ui/harness.cjs');
const F=createHarness().load('region/BalloonFlight.ts');
const transit=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
const lawn=['env_sky_static_palette','env_sky_static_rock_strata','env_sky_static_foliage_cards','env_sky_island_vines'];
const farClouds=['env_sky_cloudsea','env_sky_cumulus_far'];
const transitOff=['transit_clouds_merged','transit_sea_fallback','far_meadow_card','transit_night_dome','clouds_floor','clouds_city_sea','clouds_floor_puff'];
for(const name of lawn)assert.equal(F.skyNodeAfterArrival(name),'on',name);
for(const name of farClouds){
 assert.equal(F.skyNodeAfterArrival(name),'on',name+' on after arrival');
 assert.equal(F.ALWAYS_HIDDEN.includes(name),false,name+' left the always-hidden list');
 assert.equal(F.FLIGHT_FAR_CLOUDS.includes(name),true,name+' stays hidden for the flight');
}
for(const name of transitOff)assert.equal(F.skyNodeAfterArrival(name),'off',name);
assert.equal(F.skyNodeAfterArrival('state_court_before'),null,'plaza star is not a transit backdrop');
assert.equal(F.skyNodeAfterArrival('env_sea_surface'),null,'game sea is restored by the handoff, not deleted');
const mount=transit.slice(transit.indexOf('model=mountRegion'),transit.indexOf('const m6'));
for(const name of F.SKY_LAWN)assert.ok(!mount.includes("'"+name+"'")&&!mount.includes('"'+name+'"'),'direct mount does not hide '+name);
const tail=transit.slice(transit.lastIndexOf('arrived=true'),transit.lastIndexOf('paint(plan.total)')+20);
assert.ok(tail.startsWith('arrived=true'),'ride end sets arrived before the last paint');
assert.ok(transit.includes('skyNodeAfterArrival(n.name)'),'arrival paint applies skyNodeAfterArrival');
assert.ok(transit.includes('if(!arrived)showNamed(model,FLIGHT_FAR_CLOUDS,false)'),'flight frames hide the far clouds; arrival does not');
const afterPaint=transit.slice(transit.lastIndexOf('paint(plan.total)'));
assert.ok(afterPaint.includes('fadeCover(0,0)'),'arrival clears the handoff cover that is still black at t=total');
const active=Object.fromEntries([...lawn,...farClouds,...transitOff].map(n=>[n,false]));
for(const name of Object.keys(active)){const want=F.skyNodeAfterArrival(name);if(want==='on')active[name]=true;else if(want==='off')active[name]=false;}
for(const name of lawn)assert.equal(active[name],true,name+' on after arrival');
for(const name of farClouds)assert.equal(active[name],true,name+' on after arrival');
for(const name of transitOff)assert.equal(active[name],false,name+' off after arrival');
console.log(JSON.stringify({lawn:lawn.length,farClouds:farClouds.length,transitOff:transitOff.length}));
