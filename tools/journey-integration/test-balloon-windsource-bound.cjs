'use strict';
// Regression: BalloonTransit ride() pulled actor.setWindSource off the actor and called it unbound;
// with FlowReferenceStandin (class method, strict mode) that throws
// "Cannot set properties of undefined (setting 'windSource')" and the meadow->skycity journey fails.
const fs=require('fs'),path=require('path'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
const calls=[...src.matchAll(/setWind(\.call\(actor,)?\(?/g)].filter(m=>/^setWind(\.call|\()/.test(m[0]));
assert(calls.length>=2,'expected setWind calls');
for(const m of calls)assert(m[0].startsWith('setWind.call(actor,'),'unbound setWind( call: '+m[0]);
class Standin{constructor(){this.windSource=null;}setWindSource(fn){this.windSource=fn;}}
const a=new Standin();const setWind=a.setWindSource;
assert.throws(()=>setWind(()=>0.35),/windSource/);
setWind.call(a,()=>0.35);assert.strictEqual(a.windSource(),0.35);
console.log('PASS balloon-windsource-bound ('+calls.length+' bound calls)');
