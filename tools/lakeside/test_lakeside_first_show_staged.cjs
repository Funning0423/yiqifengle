// r4.2 (Mac r4 warning 6: lake first-appearance frame 135-153 ms, same on f3d3614). The lakeside journey's first show under the set-off
// black is staged: fog switch + tiny water draw on the first frame, the scene on the next drawn frame (still under ~95 % black); a hide
// in between cancels it; later shows are immediate. Runs the real show() text from RegionJourneyAdapter on stubs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ad=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/RegionJourneyAdapter.ts'),'utf8');
const a=ad.indexOf('  let showSerial=0,shown=false;'),b=ad.indexOf('progress(d){',a);assert(a>0&&b>a);
const snippet=ad.slice(a,b).replace(/const lease:JourneySceneLease=\{route,/,'const lease={')+'};return lease;';
function make(){const ev=[],after=[],timers=[];const ctx={rig:{_a:false,set active(v){ev.push('rig:'+v);this._a=v;},get active(){return this._a;}},atmosphere:{prime:()=>ev.push('prime')},warmWater:()=>ev.push('warm'),dead:false,
  director:{once:(e,f)=>after.push(f)},setTimeout:(f)=>timers.push(f)};
 const js=ts.transpileModule('function f(rig,atmosphere,warmWater,director,setTimeout){let dead=false;'+snippet+'}',{compilerOptions:{target:7}}).outputText;
 const lease=vm.runInNewContext(js+';f',{})(ctx.rig,ctx.atmosphere,ctx.warmWater,ctx.director,ctx.setTimeout);return {lease,ev,after,timers,ctx};}
const run=(n,f)=>{f();console.log('PASS',n);};
run('first show: prime + water draw now, the scene on the next drawn frame',()=>{const x=make();x.lease.show(true);assert.deepEqual(x.ev,['prime','warm']);assert.equal(x.ctx.rig.active,false);
 x.after.splice(0).forEach(f=>f());assert.equal(x.ctx.rig.active,true);x.timers.forEach(f=>f());assert.deepEqual(x.ev,['prime','warm','rig:true'],'fallback timer does not double-fire');});
run('hide before the frame cancels the deferred activation',()=>{const x=make();x.lease.show(true);x.lease.show(false);x.after.splice(0).forEach(f=>f());x.timers.forEach(f=>f());assert.equal(x.ctx.rig.active,false);});
run('paused game: the 50 ms fallback still shows it; later shows are immediate',()=>{const x=make();x.lease.show(true);x.timers.splice(0).forEach(f=>f());assert.equal(x.ctx.rig.active,true);
 x.lease.show(false);assert.equal(x.ctx.rig.active,false);x.lease.show(true);assert.equal(x.ctx.rig.active,true,'resume: at once');});
