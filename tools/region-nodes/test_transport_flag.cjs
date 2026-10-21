'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {load,ROOT}=require('./load.cjs');
const T=load('region/JourneyTransport.ts');
assert.equal(T.JOURNEY_TRANSPORT['island-meadow'],'sail');
assert.equal(T.JOURNEY_TRANSPORT['meadow-skycity'],'balloon');
assert.equal(T.JOURNEY_TRANSPORT['island-lakeside'],undefined);
assert.equal(T.JOURNEY_TRANSPORT['skycity-lakeside'],'balloon');
assert.equal(T.transportFor('island','meadow',null),'sail');
assert.equal(T.transportFor('meadow','skycity',null),'balloon');
assert.equal(T.transportFor('skycity','lakeside',null),'balloon');
assert.equal(T.transportFor('island','lakeside',null),'bridge');
const regions=['island','meadow','skycity','lakeside'];
for(const a of regions)for(const b of regions){
 if((a==='island'&&b==='meadow')||(a==='meadow'&&b==='skycity')||(a==='skycity'&&b==='lakeside'))continue;
 assert.equal(T.transportFor(a,b,null),'bridge',a+b);
}
assert.equal(T.transportFor('home','island',null),'bridge');
assert.equal(T.usesRainbowBridge('bridge'),true);
assert.equal(T.usesRainbowBridge('sail'),false);
assert.equal(T.usesRainbowBridge('balloon'),false);
const file=path.join(ROOT,'creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts');
const src=fs.readFileSync(file,'utf8');
assert.ok(src.includes('function rainbowBridge'));
assert.ok(src.includes('transportFor'));
assert.ok(src.includes('function rainbowBridge'));
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const committed=cp.execFileSync('git',['show',head+':creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts'],{cwd:ROOT});
// b14-A intentionally changes only lakeside arrival and its pure helper import. Keep the byte guard
// on every earlier region/transport branch instead of requiring an impossible clean HEAD after an authorized edit.
const earlier=s=>s.slice(0,s.indexOf('async function prepareLakesideJourney')).replace(',lakesideBalloonMooring','');
assert.equal(earlier(src),earlier(committed.toString()),'non-lakeside adapter bytes drifted from HEAD');
assert.match(src,/if\(to==='lakeside'\)return prepareLakesideJourney\(/);
console.log('transport-flag PASS',crypto.createHash('sha256').update(src).digest('hex').slice(0,12));
