'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),Q=H.load('region/JourneyTransport.ts');
const J=require('./journey-scene.cjs');
// b16: the 08→09 walking leg is gone; the meadow/skycity placement the balloon flies between is pinned instead (unchanged from 69b9f74).
const hash=crypto.createHash('sha256').update(JSON.stringify({mOff:J.mOff,sOff:J.sOff,yaw:J.yaw})).digest('hex');
assert.equal(hash,'665b4edd4bd5a02481d343278b535fcbcc4b8abbd4185d8053ae643eca1e322a');
assert.equal(Q.transportFor('meadow','skycity',{}), 'balloon');
assert.equal(Q.transportFor('meadow','skycity',{__QF_TRANSPORT:'bridge'}),'balloon');
assert.equal(Q.transportFor('island','meadow',{__QF_TRANSPORT:'sail'}),'sail');
assert.equal(Q.transportFor('meadow','skycity',{wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'release'}})},__QF_TRANSPORT:'bridge'}),'balloon');
const ride=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/region/BalloonRide.ts'),'utf8');
const adapter=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts'),'utf8');
assert.ok(adapter.includes("transportFor(from,to)==='balloon'"),'adapter branches before the bridge body');
assert.ok(!/RainbowBridge|rainbowBridge/.test(adapter+ride),'rainbow bridge removed (b16)');
console.log(JSON.stringify({placement:hash,balloon:Q.JOURNEY_TRANSPORT['meadow-skycity'],sailKey:Q.JOURNEY_TRANSPORT['island-meadow']}));
