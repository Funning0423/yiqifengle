// r4 land fill (VB, Grok Bot approved): an extra flat fill (builtin-standard emissive x emissiveScale, linear) on the LANDFORM GLBs
// only, day/night values from the ONE shared source lakesideModeLighting(mode).landFill*, written by the board (applyDir) and the
// journey (day/night listener) through the same code. Locks: single source; land only - water, bridge, buildings, props,
// vegetation never get it (by code path: only land copies are registered, the writer only touches registered copies); night cool.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const A=path.join(__dirname,'../../creator-build-project/assets'),S=path.join(A,'scripts/region/');
const tsjs=src=>ts.transpileModule(src,{compilerOptions:{module:1,target:7}}).outputText;
const m={exports:{}};new Function('module','exports','require',tsjs(fs.readFileSync(S+'LakesideSceneData.ts','utf8')))(m,m.exports,require);
const D=m.exports,P=D.LAKESIDE_DIR_LIGHT_PARAMS,run=(n,f)=>{f();console.log('PASS',n);};
run('single source: day = LAKESIDE_DIR_LIGHT_PARAMS.landFill*, night its own, both via lakesideModeLighting',()=>{
 const Dy=D.lakesideModeLighting('day'),N=D.lakesideModeLighting('night');
 assert.equal(Dy.landFillNearLinear,P.landFillNearLinear);assert.equal(Dy.landFillFarLinear,P.landFillFarLinear);
 assert.equal(N.landFillNearLinear,D.LAKESIDE_NIGHT_LIGHT_PARAMS.landFillNearLinear);assert.equal(N.landFillFarLinear,D.LAKESIDE_NIGHT_LIGHT_PARAMS.landFillFarLinear);
 assert.deepEqual([...P.landFillNearLinear],[0.104,0.196,0.025]);assert.deepEqual([...P.landFillFarLinear],[0.043,0.087,0.107]);
 const all=fs.readdirSync(path.join(A,'scripts'),{recursive:true}).filter(f=>String(f).endsWith('.ts')&&/Lakeside|RegionJourney/.test(String(f))); // the lakeside paths (other scenes have their own emissive uses)
 for(const f of all){const src=fs.readFileSync(path.join(A,'scripts',String(f)),'utf8');
  if(String(f).replace(/\\/g,'/')!=='region/LakesideBoardBackground.ts')assert(!/setProperty\('emissive(Scale)?'/.test(src),f+': no second land-fill writer');
  if(String(f).replace(/\\/g,'/')!=='region/LakesideSceneData.ts')assert(!/landFill(Near|Far)Linear\s*:\s*\[/.test(src),f+': no second copy of the fill values');}
 const bg=fs.readFileSync(S+'LakesideBoardBackground.ts','utf8');assert.equal((bg.match(/setProperty\('emissiveScale'/g)||[]).length,1);assert.equal((bg.match(/setProperty\('emissive'/g)||[]).length,1);
 assert.match(bg,/const M=lakesideModeLighting\(mode\),c=cls==='near'\?M\.landFillNearLinear:M\.landFillFarLinear;/);});
run('land = the landform GLBs only (principled list), every other GLB in the bundle is not land',()=>{
 assert.deepEqual([...P.landFillNearGlbs],['LK_terrain.glb']);assert.deepEqual([...P.landFillFarGlbs],['LK_far_hills.glb','LK_far_shore.glb']);
 const glbs=fs.readdirSync(path.join(A,'bundles/region_lakeside/models')).filter(f=>f.endsWith('.glb'));assert(glbs.length>40);
 for(const g of glbs){const c=D.lakesideLandFillClass(g);if(['LK_terrain.glb'].includes(g))assert.equal(c,'near');else if(['LK_far_hills.glb','LK_far_shore.glb'].includes(g))assert.equal(c,'far');else assert.equal(c,null,g+' is not land');}
 for(const g of [...P.waterGlbs,'LK_bridge.glb','LK_bridge_steps.glb'])assert.equal(D.lakesideLandFillClass(g),null);});
// behaviour: the real board functions (transpiled from LakesideBoardBackground.ts) on a stand-in scene sharing ONE palette material
const bg=fs.readFileSync(S+'LakesideBoardBackground.ts','utf8');
const grab=re=>{const mm=bg.match(re);assert(mm,String(re));return mm[0];};
const src=[grab(/export function enableLakesideInstancing\(root:Node\):Material\[\]\{[\s\S]*?\n\}\n/),grab(/const lakesideLandFillOf=[^\n]*\n/),grab(/export function lakesideLandFillMaterialClass[^\n]*\n/),
 grab(/function lakesideTopGlb[^\n]*\n/),grab(/function initLakesideLandFill[\s\S]*?\n function writeLakesideLandFill|function initLakesideLandFill[\s\S]*?writeLakesideLandFill\(m,cls,mode\);\}\n/),grab(/function writeLakesideLandFill[\s\S]*?\}\n/),grab(/export function applyLakesideLandFill[\s\S]*?return n;\}\n/)].join('');
class Vec3{constructor(x,y,z){Object.assign(this,{x,y,z});}}class Color{constructor(r,g,b,a){Object.assign(this,{r,g,b,a});}}
class Material{constructor(){this.props={};this.passes=[{getHandle:k=>['emissive','emissiveScale'].includes(k)?1:0}];}copy(s,o){this.src=s;this.defines=o?.defines;}setProperty(k,v){this.props[k]=v instanceof Vec3?[v.x,v.y,v.z]:v instanceof Color?[v.r,v.g,v.b,v.a]:v;}}
const glbOf=new WeakMap();let mode='day';
const F=new Function('Material','MeshRenderer','Color','Vec3','lakesideGlbOf','lakesideLandFillClass','lakesideModeLighting','lakesideDayNightMode','exports',tsjs(src)+'\nreturn {enableLakesideInstancing,applyLakesideLandFill,lakesideLandFillMaterialClass};')(
 Material,{},Color,Vec3,glbOf,D.lakesideLandFillClass,D.lakesideModeLighting,()=>mode,{});
const palette={name:'M_LK_palette'};
const mk=glb=>{const top={name:glb,parent:null},r={node:{parent:top},sharedMaterials:[palette],setSharedMaterial(x,k){this.sharedMaterials[k]=x;}};top.parent=root;glbOf.set(top,glb);return r;};
const root={parent:null,getComponentsInChildren:()=>rs};
const names=['LK_terrain.glb','LK_far_hills.glb','LK_far_shore.glb','LK_bridge.glb','LK_bridge_steps.glb','LK_lake.glb','LK_tree_round.glb','LK_house_A.glb','LK_rock.glb','LK_cloud.glb'],rs=names.map(mk);
run('instancing: land copies carry the day fill, water / bridge / everything else the plain copy (no emissive at all)',()=>{
 const out=F.enableLakesideInstancing(root);assert.equal(out.length,3,'plain + near + far');
 const by=Object.fromEntries(names.map((n,i)=>[n,rs[i].sharedMaterials[0]]));
 assert.equal(F.lakesideLandFillMaterialClass(by['LK_terrain.glb']),'near');assert.equal(F.lakesideLandFillMaterialClass(by['LK_far_hills.glb']),'far');assert.equal(by['LK_far_shore.glb'],by['LK_far_hills.glb']);
 assert.deepEqual(by['LK_terrain.glb'].props,{emissive:[255,255,255,255],emissiveScale:[...P.landFillNearLinear]});assert.deepEqual(by['LK_far_hills.glb'].props,{emissive:[255,255,255,255],emissiveScale:[...P.landFillFarLinear]});
 for(const n of names.slice(3)){assert.equal(by[n],by['LK_bridge.glb'],n+' plain copy');assert.deepEqual(by[n].props,{},n+' untouched');assert.equal(F.lakesideLandFillMaterialClass(by[n]),null);}
 assert.notEqual(by['LK_terrain.glb'],by['LK_bridge.glb']);});
run('day/night writer: night values on land only; water material and bridge untouched; journey and board use it',()=>{
 const water=new Material();water.setProperty('waterTint',new Vec3(1,1,1));rs[5].sharedMaterials[0]=water;const before=JSON.stringify(water.props),bridge=rs[3].sharedMaterials[0];
 mode='night';assert.equal(F.applyLakesideLandFill(root,'night'),2);const N=D.lakesideModeLighting('night');
 assert.deepEqual(rs[0].sharedMaterials[0].props.emissiveScale,[...N.landFillNearLinear]);assert.deepEqual(rs[1].sharedMaterials[0].props.emissiveScale,[...N.landFillFarLinear]);
 assert.equal(JSON.stringify(water.props),before);assert.deepEqual(bridge.props,{});
 assert.match(bg,/if\(waterMat\)applyLakesideWaterMode\(waterMat,mode\);\n  if\(scenery&&isValid\(scenery,true\)\)applyLakesideLandFill\(scenery,mode\);/,'board applyDir');
 const ad=fs.readFileSync(S+'RegionJourneyAdapter.ts','utf8');assert.match(ad,/batching=applyLakesideJourneyBatching\(model,\{instancing:enableLakesideInstancing,/,'journey land copies from the same instancing');
 assert.match(ad,/offLand=onDayNightChange\(\(\)=>\{if\(!dead\)applyLakesideLandFill\(model,lakesideDayNightMode\(\)\);\}\);/);assert.match(ad,/dead=true;offWater\(\);offLand\(\);/);});
run('night land fill is cool and small (no brown)',()=>{const N=D.lakesideModeLighting('night'),Dy=D.lakesideModeLighting('day');
 for(const k of ['landFillNearLinear','landFillFarLinear']){const c=N[k];assert(c[2]>=c[1]&&c[1]>=c[0]&&c[2]>c[0],'night '+k+' blue >= green >= red');assert(Math.max(...c)<Math.max(...Dy[k])*0.5,'night '+k+' far below day');}});
run('skyDomeColor = the clear colour per mode (not the reflected-sky inputs)',()=>{for(const m of ['day','night']){const L=D.lakesideModeLighting(m);
 assert.equal(L.skyDomeColor,L.clearColor,m+' sky dome = clear colour');}
 assert.equal(D.lakesideModeLighting('day').skyDomeColor,D.lakesideDayClearColor());assert.equal(D.lakesideModeLighting('night').skyDomeColor,D.LAKESIDE_NIGHT_LIGHT_PARAMS.clearColor);
 const hx=h=>[1,3,5].map(i=>parseInt(String(h).slice(i,i+2),16));assert.deepEqual(hx(D.lakesideModeLighting('day').skyDomeColor),[28,143,184],'day sky dome 28/143/184');assert.deepEqual(hx(D.lakesideModeLighting('night').skyDomeColor),[28,39,64],'night sky dome = #1c2740');
 const sd=fs.readFileSync(S+'LakesideSceneData.ts','utf8');assert.equal((sd.match(/skyDomeColor\s*:\s*['"#]/g)||[]).length,0,'skyDomeColor is derived from the clear colour, never a literal');});
console.log('lakeside land fill OK');
