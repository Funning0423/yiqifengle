#!/usr/bin/env node
/** cand7: b19 dock-model runtime wiring. Pure checks (no cc): gangway extras in sync with sailboat.glb, basket-obstacle state
 *  machine, source contracts (no placeholder when the real model exists, ropes stowed, placeholders out of the night silhouette,
 *  no console.error in the new modules). */
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..'),S=p=>fs.readFileSync(path.join(root,'creator-build-project/assets/scripts',p),'utf8');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
let pass=0;const ok=(m)=>{pass++;console.log('PASS '+m);};
// 1 extras
const g=require('./gen-gangway-extras.cjs'),r=g.read();
assert(r.node&&r.node.extras,'sail_gangway_hinge extras missing in sailboat.glb');
assert.strictEqual(fs.readFileSync(g.out,'utf8'),g.render(r),'SailGangwayExtras.ts stale (re-run gen-gangway-extras.cjs)');
const e=r.node.extras;assert.deepStrictEqual([e.lengthM,e.stowedDeg,e.meadowDeployDeg,e.islandYawDeg,e.islandDeployDeg],[0.625,95,-16,180,23]);
ok('SailGangwayExtras.ts matches sailboat.glb hinge extras '+JSON.stringify(e));
// 2 obstacles
const src=S('region/BasketObstacles.ts'),js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
const m={exports:{}};new Function('module','exports','require',js)(m,m.exports,require);const B=m.exports;
B.resetBasketObstacles();
assert(!B.basketBlocked('skycity',5.4,43.8)&&!B.basketBlocked('skycity',-14.8,-38.8)&&!B.basketBlocked('meadow',3.6,-23.4));
B.basketObstacleEvent('node:M4');assert(B.basketBlocked('meadow',3.6,-23.4));B.basketObstacleEvent('balloon:B3-flight');assert(!B.basketBlocked('meadow',3.6,-23.4));
B.basketObstacleEvent('balloon:B4-settle');assert(B.basketBlocked('skycity',5.4,43.8));B.basketObstacleEvent('balloon:released');assert(!B.basketBlocked('skycity',5.4,43.8));
B.basketObstacleEvent('lakeside:C1-basket-in');assert(B.basketBlocked('skycity',-14.8,-37.4));B.basketObstacleEvent('lakeside:C3-flight');assert(!B.basketBlocked('skycity',-14.8,-38.8));
ok('basket obstacles: meadow M4→liftoff, landing settle→released, 5a basket-in→liftoff');
// 3 contracts
const adp=S('region/RegionJourneyAdapter.ts');
assert(!/plankBetween\(rig/.test(adp),'adapter still spawns raw plankBetween');assert(/placeholderPlank\(rig,'island_dock'/.test(adp)&&/dockReal\?null/.test(adp)&&/gangway\?null/.test(adp));
assert(/realModelArrived\('island_dock'/.test(S('world-r2/IslandProps.ts')),'IslandProps must announce island_dock');
assert(/onRealModel\('island_dock'/.test(S('region/SailArt.ts')),'transit_pier off when the dock exists');
assert(/isTransitionPlaceholder\(n\)\)return/.test(S('region/BalloonTransit.ts')),'placeholders skipped by dimCityNight');
assert(/setMooringRopes\(n,'landing',false\);setMooringRopes\(n,'5a',false\)/.test(S('region/RegionLoader.ts')));
assert(/setMooringRopes\(model,'landing',m\)/.test(S('region/BalloonTransit.ts'))&&/setMooringRopes\(director.getScene\(\),'5a',m\)/.test(adp));
assert(/gw\?\.swing\('island'/.test(S('region/SailRide.ts'))&&/gw\?\.swing\('meadow'/.test(S('region/SailRide.ts')));
ok('source contracts: real model > placeholder, late dock removes boxes, transit_pier off, ropes stowed, night dim skips placeholders, gangway driven');
for(const f of ['region/BasketObstacles.ts','region/SailGangway.ts','region/SailGangwayExtras.ts','region/SkyMooringRopes.ts'])assert(!/console\.error/.test(S(f)),f+' has console.error');
assert(!/console\.error/.test(S('region/TransitionProps.ts')));
ok('no console.error in the cand7 modules');
console.log(JSON.stringify({status:'PASS',passed:pass}));
