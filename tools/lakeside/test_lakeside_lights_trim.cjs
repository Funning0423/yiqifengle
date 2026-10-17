// L1: lights trim fallback - 0.08 sun dropped (folded into ambient), the others at 20 m / range 40 covering the board; variant switch.
const fs=require('fs'),path=require('path'),assert=require('assert');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const A=path.join(__dirname,'../../creator-build-project/assets'),F=path.join(A,'scripts/region/LakesideSceneData.ts');
const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(F,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText)(m,m.exports,require);
const D=m.exports,T=D.LAKESIDE_LIGHT_TRIM,B=D.LAKESIDE_BOARD_BOUNDS;
assert.deepEqual({e:T.enabled,r:T.range,d:T.distance,k:T.keepMainFull,f:T.ambientFold},{e:true,r:40,d:20,k:false,f:0.08});
const P=D.lakesideLightPlacements();
assert.deepEqual(P.map(p=>p.light.name),['Sun','SUN_dusk_side'],'0.08 sun and MTN_RECV sun not placed');
const corners=[[B.min[0],0,B.min[2]],[B.max[0],0,B.min[2]],[B.min[0],0,B.max[2]],[B.max[0],0,B.max[2]]];
const win=(d,r)=>Math.pow(Math.max(0,1-Math.pow(d/r,4)),2);
for(const p of P){
  assert.equal(p.range,40);assert(p.position[1]>0,'above the water');
  const ds=corners.map(c=>Math.hypot(c[0]-p.position[0],c[1]-p.position[1],c[2]-p.position[2]));
  assert(Math.max(...ds)<0.7*p.range,p.light.name+' board corners well inside range '+ds.map(x=>x.toFixed(1)));
  // same light at the board centre as the 220 m / 600 original (inverse square x window)
  const before=12*p.light.ratio/220/220*win(220,600),after=p.luminanceScale/20/20*win(20,40);
  assert(Math.abs(after/before-1)<0.01,'centre illuminance kept '+(after/before).toFixed(3));
  const c=B.center,dir=[c[0]-p.position[0],c[1]-p.position[1],c[2]-p.position[2]],n=Math.hypot(...dir),f=p.light.forward,fn=Math.hypot(...f);
  for(let i=0;i<3;i++)assert(Math.abs(dir[i]/n-f[i]/fn)<1e-3,'same direction');
}
const V=D.lakesideLightPlacements({...T,keepMainFull:true});
assert.deepEqual(V.map(p=>[p.light.name,p.range]),[['Sun',600],['SUN_dusk_side',40]],'variant: main sun full range');
assert.deepEqual(V[0].position,D.lakesideLightPosition(V[0].light));
const O=D.lakesideLightPlacements({...T,enabled:false});
assert.deepEqual(O.map(p=>[p.light.name,p.range]),[['Sun',600],['Sun.001',600],['SUN_dusk_side',600]],'disabled: original three');
const bg=fs.readFileSync(path.join(A,'scripts/region/LakesideBoardBackground.ts'),'utf8');
assert(/for\(const pl of lakesideLightPlacements\(\)\)/.test(bg)&&/s\.range=pl\.range;s\.size=30;s\.luminance\*=pl\.luminanceScale;/.test(bg),'lease uses placements');
assert(/amb\.skyIllum=ambientSaved!\*\(1\+T\.ambientFold\)/.test(bg)&&/foldAmbient\(value\)/.test(bg)&&/dispose=\(\)=>\{if\(dead\)return;foldAmbient\(false\);/.test(bg),'ambient fold on show, restored on hide/dispose');
console.log('lakeside lights trim OK');
