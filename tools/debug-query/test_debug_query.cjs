#!/usr/bin/env node
'use strict';
/** full8: debug/capture flags readable from location.search, the WeChat launch/enter query (develop/trial only) and globalThis.__qfQuery;
 *  off by default; release WeChat never. CamTraceLog / CamTrace / SailVoyage / SailShot / SeaReveal all read through debugSearch. */
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const L=require('../transitions/sail_farsea_lib.cjs');
const Q=L.load('region/DebugQuery.ts',s=>s.includes('QaSkip')?L.load('world-r2/QaSkip.ts'):{});
const wx=(env,q,eq={})=>({getAccountInfoSync:()=>({miniProgram:{envVersion:env}}),getLaunchOptionsSync:()=>({query:q}),getEnterOptionsSync:()=>({query:eq})});
assert.equal(Q.debugSearch({}),'','default off');
assert.equal(Q.debugSearch({wx:wx('release',{camTrace:'1'})}),'','release launch query ignored');
const dev=Q.debugSearch({location:{search:'?contextName=game&id=2'},wx:wx('develop',{camTrace:'1',sailVoyage:'1',sailT:'17.4',w:'320',h:'568'})});
for(const k of ['camTrace=1','sailVoyage=1','sailT=17.4','w=320','h=568'])assert.ok(dev.includes(k),k);
assert.ok(Q.debugSearch({wx:wx('trial',{},{camTrace:'1'})}).includes('camTrace=1'),'enter query');
assert.equal(Q.debugSearch({__qfQuery:'?camTrace=1'}),'?camTrace=1');assert.equal(Q.debugSearch({__qfQuery:{sailVoyage:1}}),'?sailVoyage=1');
const R=path.join(__dirname,'../../creator-build-project/assets/scripts/region');
for(const f of ['CamTraceLog.ts','CamTrace.ts','SailVoyage.ts','SailShot.ts','SeaReveal.ts']){const s=fs.readFileSync(path.join(R,f),'utf8');
 assert.match(s,/from '\.\/DebugQuery'/,f+' imports DebugQuery');assert.doesNotMatch(s,/location(\?)?\.search/,f+' still reads location.search directly');}
console.log('PASS debug-query');
