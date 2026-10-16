'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHarness}=require('./harness.cjs');
const H=createHarness(), {flowTestLayout, flowTestBannerVisible}=H.load('world-r2/FlowTestLayout');let samples=0;
for(const [w,h]of [[320,568],[390,844],[844,390],[568,320],[320,320],[750,1624]])for(const scale of [1,2]){
 const ww=w/scale,hh=h/scale,host={windowWidth:ww,windowHeight:hh,safeArea:{left:0,right:ww,top:20/scale,bottom:hh-20/scale},capsule:{left:ww-90/scale,right:ww-6/scale,top:30/scale,bottom:66/scale}},l=flowTestLayout(w,h,host);assert(l.supported);
 const boxes=[l.mark,l.entry,...l.stages,l.exit];for(const box of boxes){const top=h/2-box.y-box.height/2;assert(top>=66+12);assert(top+box.height<=h-20);assert(box.x-box.width/2>=-w/2+12);assert(box.x+box.width/2<=w/2-12);}
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2);}
 samples++;
}
assert.equal(flowTestBannerVisible(false, true, true), false, 'closed debug menu hides the banner on the island shell');
assert.equal(flowTestBannerVisible(true, false, true), false, 'meadow and other play screens never show 独立测试进度');
assert.equal(flowTestBannerVisible(true, true, false), false);
assert.equal(flowTestBannerVisible(true, true, true), true, 'banner only inside the open debug menu');
const boot=fs.readFileSync(path.resolve(__dirname,'../../creator-build-project/assets/scripts/WorldIntegrationBoot.ts'),'utf8');
assert(boot.includes('flowTestBannerVisible(this.flowTestMenu, outside, testLayout.supported)'));
assert(boot.includes('this.flowTestMark.node.parent!.active=false'));
assert(!boot.includes('plate.active=testLayout.supported'));
console.log(JSON.stringify({status:'PASS',samples,checks:['all marker/button bounds below complete WeChat capsule band','portrait/landscape and scaled host coordinates','checkpoint and exit hit regions do not overlap','独立测试进度 banner only while the debug menu is open on the home/island shell'],scope:'Pure logical geometry, current native capsule/visual acceptance queued'},null,2));
