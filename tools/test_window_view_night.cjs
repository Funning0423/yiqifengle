'use strict';
// Window day/night: every window backdrop (sky dome, cloud layer and the painted view card behind the
// small window beside the door) must follow the night switch. Extracts the actual bindUnlitBackdrop
// and createWorld wiring from WorldFlowComponent.ts; mocks only Cocos material/renderer objects.
// Run from repo root: node tools/test_window_view_night.cjs   (QF_TYPESCRIPT_MODULE may point at typescript)
const fs=require('node:fs'),assert=require('node:assert/strict');
const ts=require('./qf-env.cjs').typescript();
const src=fs.readFileSync('creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts','utf8');
const checks=[];
const start=src.indexOf('function srgbToLinearChannel('),end=src.indexOf('/** Add to a NEW, identity scene-root sibling.');
assert(start>0&&end>start,'bindUnlitBackdrop boundaries must exist');
const js=ts.transpileModule(src.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
class Vec4{constructor(x=0,y=0,z=0,w=0){Object.assign(this,{x,y,z,w});}}
const makeMaterial=(effectName='builtin-unlit')=>{const m={effectName,color:new Vec4(1,1,1,1),passes:[]};
  m.passes=[{getHandle:n=>n==='mainColor'?1:0,getUniform:(h,out)=>Object.assign(out,m.color)}];
  m.setProperty=(n,v)=>{assert.equal(n,'mainColor');m.color=new Vec4(v.x,v.y,v.z,v.w);};return m;};
const makeRenderer=(name,effect)=>{const shared=makeMaterial(effect);let render=shared,instance=null;
  return {node:{name},shared,getSharedMaterial:()=>shared,getRenderMaterial:()=>render,
    getMaterialInstance(){if(!instance){instance=makeMaterial(effect);render=instance;}return instance;},
    setSharedMaterial(m){render=m;instance=null;},get instance(){return instance;},get render(){return render;}};};
const logs=[];
const bind=new Function('Vec4','isValid','console',js+';return bindUnlitBackdrop;')(Vec4,o=>!!o,{info:(...a)=>logs.push(a),warn:(...a)=>logs.push(a)});

const card=makeRenderer('env_window_blind_cards'),dome=makeRenderer('env_sky_dome');
const bc=bind(card),bd=bind(dome);
bc.setNight(true);bd.setNight(true);
assert.deepEqual(card.instance.color,new Vec4(.18,.24,.46,1));
assert.deepEqual(card.instance.color,dome.instance.color,'view card uses the same night tint as the sky dome');
assert.deepEqual(card.shared.color,new Vec4(1,1,1,1),'shared imported material untouched');
checks.push('night: window view card tinted with sky-dome night colour on its own instance; shared material unchanged');
bc.setNight(false);assert.deepEqual(card.instance.color,new Vec4(1,1,1,1));
checks.push('day: view card restored to authored white');
bc.release();assert.equal(card.render,card.shared);
checks.push('release restores the shared material');
assert.throws(()=>bind(makeRenderer('env_window_blind_cards','builtin-standard')),/Unexpected unlit backdrop material/);
assert.throws(()=>bind(makeRenderer('env_some_other_mesh')),/Unexpected unlit backdrop material/);
checks.push('non-unlit card or unrelated mesh is refused (no other materials touched)');

// Wiring: createWorld registers the card after the six strict backdrops, non-fatally, exactly once.
const wire=src.slice(src.indexOf("const backdropNames=["),src.indexOf("const palm=renderers.get('env_rear_window_palm')"));
assert.match(wire,/filter\(r=>r\.node\.name==='env_window_blind_cards'\)/);
assert.match(wire,/viewCards\.length!==1/);
assert.match(wire,/try\{this\.unlitBackdrops\.set\(viewCards\[0\],bindUnlitBackdrop\(viewCards\[0\]\)\);\}catch/);
// ES5 (运镜bot T2+): Cocos loose ES5 does not iterate a Map in for-of, so the loop is Array.from(map.entries()).forEach.
// applyDayNight drives EVERY registered backdrop through setWeight (the 0.8 s blend), not a hard setNight.
assert.match(src,/Array\.from\(this\.unlitBackdrops\.entries\(\)\)\.forEach\(\(\[r,b\]\)=>\{if\(isValid\(r,true\)\)b\.setWeight\(k\);\}\)/);
checks.push('createWorld registers env_window_blind_cards in unlitBackdrops; applyDayNight drives every registered backdrop');

// Device getUniform returns linear even though setProperty stored sRGB. That mismatch used to throw and release the night instance.
const lin=c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
const sky=makeRenderer('env_sky_dome');
const origGet=sky.getMaterialInstance.bind(sky);
sky.getMaterialInstance=function(){const inst=origGet();if(!inst._lin){inst._lin=true;const pass=inst.passes[0],raw=pass.getUniform.bind(pass);
  pass.getUniform=(h,out)=>{raw(h,out);out.x=lin(out.x);out.y=lin(out.y);out.z=lin(out.z);return out;};}return inst;};
const warns=[];
const bindLinear=new Function('Vec4','isValid','console',js+';return bindUnlitBackdrop;')(Vec4,o=>!!o,{info:()=>{},warn:(...a)=>warns.push(a.map(String).join(' '))});
const nightSky=bindLinear(sky);
assert.doesNotThrow(()=>nightSky.setWeight(1));
assert.deepEqual(sky.instance.color,new Vec4(.18,.24,.46,1),'written uniform stays the sRGB night tint');
assert.notEqual(sky.render,sky.shared,'linear readback does not release the night instance');
assert.equal(warns.length,0,'linear readback is within the colour-space tolerance');
checks.push('linear uniform readback keeps the sRGB night colour and does not throw');

const bad=makeRenderer('env_cloud_layer');
const origBad=bad.getMaterialInstance.bind(bad);
bad.getMaterialInstance=function(){const inst=origBad();inst.passes[0].getUniform=(h,out)=>{out.x=0;out.y=0;out.z=0;out.w=0;return out;};return inst;};
const badWarns=[];
const bindBad=new Function('Vec4','isValid','console',js+';return bindUnlitBackdrop;')(Vec4,o=>!!o,{info:()=>{},warn:(...a)=>badWarns.push(a.map(String).join(' '))});
const broken=bindBad(bad);
assert.doesNotThrow(()=>broken.setNight(true));
assert.equal(bad.render,bad.instance,'a failed postcondition warns and keeps the instance');
assert(badWarns.some(w=>w.includes('Backdrop day/night uniform postcondition failed')));
assert.equal(src.includes("throw Error('Backdrop day/night uniform postcondition failed')"),false);
checks.push('backdrop day/night postcondition is warn-only and never throws');
console.log(JSON.stringify({status:'PASS',checks},null,1));
