'use strict';
// b17r10: test-only level skip (?qfSkip=) for 全流程测试部 — off by default, never in WeChat release, no banner;
// lakeside target = all 12 mainline stages cleared in an isolated profile -> 风铃湖畔 entry gate opens.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHarness}=require('../board-ui/harness.cjs');
const S=p=>fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts',p),'utf8');
(async()=>{
 const H=createHarness({debug:false}),Q=H.load('world-r2/QaSkip');
 // gate
 assert.equal(Q.qaSkipTarget('',{}),null,'off by default (no param)');
 assert.equal(Q.qaSkipTarget('?foo=1',{}),null);
 assert.equal(Q.qaSkipTarget('?qfSkip=nope',{}),null,'unknown target');
 assert.equal(Q.qaSkipTarget('?qfSkip=lakeside',{}),'lakeside','web QA build');
 assert.equal(Q.qaSkipTarget('?a=1&qfSkip=skycity-finale&b=2',{}),'skycity-finale');
 const wx=env=>({wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:env}})}});
 assert.equal(Q.qaSkipTarget('?qfSkip=lakeside',wx('release')),null,'WeChat release: never');
 assert.equal(Q.qaSkipTarget(null,wx('release')),null);
 assert.equal(Q.qaSkipTarget('?qfSkip=lakeside',wx('trial')),'lakeside');
 assert.equal(Q.qaSkipTarget('?qfSkip=lakeside',{wx:{getAccountInfoSync:()=>{throw Error('x');}}}),null,'gate error -> closed');
 // no banner / no button: the boot only wires the API inside the gated branch and adds no label or button for it
 const boot=S('WorldIntegrationBoot.ts');
 assert.ok(/const skip=qaSkipTarget\(q\);if\(skip\)\{/.test(boot),'boot API behind qaSkipTarget');
 assert.ok(boot.split('\n').filter(l=>/qaSkip/i.test(l)).every(l=>/^import \{ qaSkipTarget(, qaHooksEnabled)? \}/.test(l)||/const skip=qaSkipTarget\(q\);if\(skip\)/.test(l)||/^\s*if\(skip!==null\|\|qaHooksEnabled\(q\)\)\(globalThis as any\)\.__qfBackToBoard=/.test(l)),'qaSkip only on the import + gated lines');
// p0drag9: ?qfHooks=1 test hooks — same host gate
if(Q.qaHooksEnabled){assert.equal(Q.qaHooksEnabled('',{}),false);assert.equal(Q.qaHooksEnabled('?qfHooks=1',{}),true,'web QA');assert.equal(Q.qaHooksEnabled('?qfHooks=1',wx('release')),false,'release never');assert.equal(Q.qaHooksEnabled('?qfHooks=1',wx('develop')),true);assert.equal(Q.qaHooksEnabled('?qfSkip=lakeside',{}),true);assert.equal(Q.qaHooksEnabled('?qfHooks=0',{}),false);}
 assert.ok(!/label\([^)]*(跳关|qfSkip|skip)/i.test(boot)&&!/button\('qa/i.test(boot),'no visible skip label/button');
 // composition refuses without the URL gate even when called directly
 const C=H.load('world-r2/WorldNativeComposition').WorldNativeComposition,c=new C();
 let state='island';c.world={commands:()=>({snapshot:()=>({state}),enterLevel:async()=>{state='level';return {ok:true};}})};
 delete globalThis.__QF_QA_SKIP_API;
 assert.equal((await c.qaSkip('lakeside')).reason,'qa-skip-disabled','direct call without ?qfSkip refused');
 // isolated profile, finish=true: all 12 cleared -> lakeside gate open
 const RF=H.load('world-r2/RegionFlowTest'),RC=require('../../creator-build-project/assets/scripts/mainline-r1/runtime/region-campaign.js');
 const p=RF.createRegionFlowCheckpoint(12,{allowQa:true,finish:true}),snap=p.mainline.createController().snapshot();
 assert.equal(snap.journey.records.filter(r=>r.bestStars>0).length,12,'12 stages registered');
 assert.ok(RC.canEnterRegion(snap.journey,'lakeside').ok,'lakeside unlocked');
 assert.ok(p.namespace.startsWith('dot-region-flow-test-'),'isolated namespace');
 const half=RF.createRegionFlowCheckpoint(12,{allowQa:true});assert.ok(!RC.canEnterRegion(half.mainline.createController().snapshot().journey,'lakeside').ok,'skycity-finale stays one move short');
 console.log('PASS qa-skip (off by default, release-gated, no banner, lakeside checkpoint unlocks 风铃湖畔)');
})().catch(e=>{console.error(e);process.exit(1);});
