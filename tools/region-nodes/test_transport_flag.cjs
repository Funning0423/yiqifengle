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
assert.throws(()=>T.transportFor('island','lakeside',null),/journey-transport-unsupported/);
const regions=['island','meadow','skycity','lakeside'];
for(const a of regions)for(const b of regions){
 if((a==='island'&&b==='meadow')||(a==='meadow'&&b==='skycity')||(a==='skycity'&&b==='lakeside'))continue;
 assert.throws(()=>T.transportFor(a,b,null),/journey-transport-unsupported/,a+b);
}
assert.throws(()=>T.transportFor('home','island',null),/journey-transport-unsupported/);
assert.equal(T.usesRainbowBridge,undefined);
const file=path.join(ROOT,'creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts');
const src=fs.readFileSync(file,'utf8');
assert.ok(!/rainbowBridge|RainbowBridge/.test(src));
assert.ok(src.includes('transportFor'));
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const committed=cp.execFileSync('git',['show',head+':creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts'],{cwd:ROOT});
// b14-A intentionally changes only lakeside arrival and its pure helper import. Keep the byte guard
// on every earlier region/transport branch instead of requiring an impossible clean HEAD after an authorized edit.
const earlier=s=>s.slice(0,s.indexOf('async function prepareLakesideJourney')).replace(',lakesideBalloonMooring','');
assert.equal(earlier(src),earlier(committed.toString()),'non-lakeside adapter bytes drifted from HEAD');
assert.match(src,/if\(to==='lakeside'\)return prepareLakesideJourney\(/);
console.log('transport-flag PASS',crypto.createHash('sha256').update(src).digest('hex').slice(0,12));
