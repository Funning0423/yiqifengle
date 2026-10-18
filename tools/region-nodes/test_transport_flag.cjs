'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {load,ROOT}=require('./load.cjs');
const T=load('region/JourneyTransport.ts');
assert.equal(T.JOURNEY_TRANSPORT['island-meadow'],'sail');
assert.equal(T.JOURNEY_TRANSPORT['meadow-skycity'],'bridge');
assert.equal(T.JOURNEY_TRANSPORT['island-lakeside'],'bridge');
assert.equal(T.transportFor('island','meadow',null),'sail');
assert.equal(T.transportFor('meadow','skycity',null),'bridge');
assert.equal(T.transportFor('island','lakeside',null),'bridge');
const regions=['island','meadow','skycity','lakeside'];
for(const a of regions)for(const b of regions){
 if(a==='island'&&b==='meadow')continue;
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
assert.ok(committed.equals(fs.readFileSync(file)),'adapter bytes drifted from HEAD');
console.log('transport-flag PASS',crypto.createHash('sha256').update(src).digest('hex').slice(0,12));
