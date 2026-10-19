// r4 land fill (VB, Grok Bot approved): an extra flat fill (builtin-standard emissive x emissiveScale, linear) on the LANDFORM GLBs
// only, day/night values from the ONE shared source lakesideModeLighting(mode).landFill*, written by the board (applyDir) and the
// journey (day/night listener) through the same code. Locks: single source; land only - water, bridge, buildings, props,
// vegetation never get it (by code path: only land copies are registered, the writer only touches registered copies); night cool.
// r5 per-part (VB): the fill copies sample a 16x16 per-palette-swatch mask (USE_EMISSIVE_MAP, built in code from
// lakesideFillMaskBytes, its own per mode) so roofs / door frames / trunks / cliffs get none; pavilion joins walls; reeds / flowers
// (plant) and small props (prop) get their own class; the journey copy scales the fill by the atmosphere blend weight.
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
 // r4 prop fill: foliage / wall / rock / cloud, same single source (day = P, night = its own), values locked
 const PF={foliageFillLinear:[[0.019,0.065,0],[0.0006,0.0058,0.0029]],wallFillLinear:[[0.023,0.02,0.017],[0.0085,0.013,0.0232]],rockFillLinear:[[0.079,0.079,0.079],[0.0049,0.0116,0.0356]],cloudFillLinear:[[0.33,0.24,0.218],[0.0078,0.0091,0.0145]],plantFillLinear:[[0.03,0.09,0.04],[0.016,0.048,0.052]],propFillLinear:[[0.06,0.045,0.035],[0.0015,0.016,0.026]]};
 for(const k of Object.keys(PF)){assert.equal(Dy[k],P[k],k+' day = P');assert.equal(N[k],D.LAKESIDE_NIGHT_LIGHT_PARAMS[k],k+' night own');assert.deepEqual(Array.from(P[k]),PF[k][0],k+' day');assert.deepEqual(Array.from(N[k]),PF[k][1],k+' night');}
 const CK={near:'landFillNearLinear',far:'landFillFarLinear',foliage:'foliageFillLinear',wall:'wallFillLinear',rock:'rockFillLinear',cloud:'cloudFillLinear',plant:'plantFillLinear',prop:'propFillLinear'};
 for(const md of ['day','night'])for(const c of Object.keys(CK)){const v=D.lakesideFillLinear(md,c);assert.equal(v,D.lakesideModeLighting(md)[CK[c]],md+' '+c+' via lakesideFillLinear');assert(v.every(x=>x>=0),md+' '+c+' no negative emissive');}
 const all=fs.readdirSync(path.join(A,'scripts'),{recursive:true}).filter(f=>String(f).endsWith('.ts')&&/Lakeside|RegionJourney/.test(String(f))); // the lakeside paths (other scenes have their own emissive uses)
 for(const f of all){const src=fs.readFileSync(path.join(A,'scripts',String(f)),'utf8');
  if(String(f).replace(/\\/g,'/')!=='region/LakesideBoardBackground.ts')assert(!/setProperty\('emissive(Scale|Map)?'/.test(src),f+': no second land-fill writer');
  if(String(f).replace(/\\/g,'/')!=='region/LakesideSceneData.ts')assert(!/(landFill(Near|Far)|foliageFill|wallFill|rockFill|cloudFill|plantFill|propFill)Linear\s*:\s*\[/.test(src),f+': no second copy of the fill values');}
 const bg=fs.readFileSync(S+'LakesideBoardBackground.ts','utf8');assert.equal((bg.match(/setProperty\('emissiveScale'/g)||[]).length,1);assert.equal((bg.match(/setProperty\('emissive'/g)||[]).length,1);
 assert.equal((bg.match(/setProperty\('emissiveMap'/g)||[]).length,1);
 assert.match(bg,/const c=lakesideFillLinear\(mode,cls\),k=lakesideFillWeight\(weight\);m\.setProperty\('emissiveScale',new Vec3\(c\[0\]\*k,c\[1\]\*k,c\[2\]\*k\)\);/);});
run('land = the landform GLBs only (principled list), every other GLB in the bundle is not land',()=>{
 assert.deepEqual([...P.landFillNearGlbs],['LK_terrain.glb']);assert.deepEqual([...P.landFillFarGlbs],['LK_far_hills.glb','LK_far_shore.glb']);
 const glbs=fs.readdirSync(path.join(A,'bundles/region_lakeside/models')).filter(f=>f.endsWith('.glb'));assert(glbs.length>40);
 const WANT={'LK_terrain.glb':'near','LK_far_hills.glb':'far','LK_far_shore.glb':'far','LK_tree_conifer.glb':'foliage','LK_tree_round.glb':'foliage','LK_bush.glb':'foliage','LK_house_A.glb':'wall','LK_house_B.glb':'wall','LK_house_C.glb':'wall','LK_rock.glb':'rock','LK_cloud.glb':'cloud','LK_pavilion.glb':'wall'};
 const PLANT=['LK_reed_card.glb','LK_flower_clump.glb','LK_flowerpot.glb','LK_lotus.glb','LK_lilypad.glb'],PROP=['LK_chime_post.glb','LK_chime_raft.glb','LK_windchime.glb','LK_buoy_lantern.glb','LK_lantern.glb','LK_lantern_boat.glb','LK_paper_boat.glb','LK_barrel.glb','LK_porch_steps.glb','LK_clothesline.glb'];
 for(const g of PLANT)WANT[g]='plant';for(const g of PROP)WANT[g]='prop';
 assert.deepEqual(Array.from(P.plantFillGlbs),PLANT);assert.deepEqual(Array.from(P.propFillGlbs),PROP);
 assert.deepEqual(Array.from(P.foliageFillGlbs),['LK_tree_conifer.glb','LK_tree_round.glb','LK_bush.glb']);assert.deepEqual(Array.from(P.wallFillGlbs),['LK_house_A.glb','LK_house_B.glb','LK_house_C.glb','LK_pavilion.glb']);assert.deepEqual(Array.from(P.rockFillGlbs),['LK_rock.glb']);assert.deepEqual(Array.from(P.cloudFillGlbs),['LK_cloud.glb']);
 for(const g of Object.keys(WANT))assert(glbs.includes(g),g+' in the bundle');
 for(const g of glbs){const c=D.lakesideLandFillClass(g);assert.equal(c,WANT[g]??null,g+' fill class');}
 for(const g of [...P.waterGlbs,'LK_bridge.glb','LK_bridge_steps.glb'])assert.equal(D.lakesideLandFillClass(g),null);});
// behaviour: the real board functions (transpiled from LakesideBoardBackground.ts) on a stand-in scene sharing ONE palette material
const bg=fs.readFileSync(S+'LakesideBoardBackground.ts','utf8');
const grab=re=>{const mm=bg.match(re);assert(mm,String(re));return mm[0];};
const src=[grab(/export function enableLakesideInstancing\(root:Node\):Material\[\]\{[\s\S]*?\n\}\n/),grab(/const lakesideLandFillOf=[^\n]*\n/),grab(/export function lakesideLandFillMaterialClass[^\n]*\n/),
 grab(/function lakesideTopGlb[^\n]*\n/),grab(/function initLakesideLandFill[\s\S]*?writeLakesideLandFill\(m,cls,mode\);\}\n/),grab(/const lakesideFillMasks[^\n]*\n/),grab(/export function lakesideFillMaskTexture[\s\S]*?return null;\}\}\n/),grab(/const lakesideFillMaskMode=[^\n]*\n/),grab(/function writeLakesideLandFill[\s\S]*?\}\}\}\n/),grab(/export function applyLakesideLandFill[\s\S]*?return n;\}\n/)].join('');
class Vec3{constructor(x,y,z){Object.assign(this,{x,y,z});}}class Color{constructor(r,g,b,a){Object.assign(this,{r,g,b,a});}}
class Texture2D{reset(o){this.info=o;}setFilters(a,b){this.f=[a,b];}setMipFilter(m){this.mip=m;}setWrapMode(a,b){this.w=[a,b];}uploadData(d){this.data=d;}}
Texture2D.PixelFormat={RGBA8888:35};Texture2D.Filter={NONE:0,NEAREST:1};Texture2D.WrapMode={CLAMP_TO_EDGE:2};
class Material{constructor(){this.props={};this.defines={};this.passes=[{getHandle:k=>['emissive','emissiveScale'].includes(k)||(k==='emissiveMap'&&this.defines.USE_EMISSIVE_MAP)?1:0}];}copy(s,o){this.src=s;this.defines=o?.defines||{};}setProperty(k,v){this.props[k]=v instanceof Vec3?[v.x,v.y,v.z]:v instanceof Color?[v.r,v.g,v.b,v.a]:v;}}
const glbOf=new WeakMap();let mode='day';
const F=new Function('Material','MeshRenderer','Color','Vec3','Texture2D','isValid','lakesideGlbOf','lakesideLandFillClass','lakesideFillLinear','lakesideFillMaskBytes','lakesideFillWeight','lakesideModeLighting','lakesideDayNightMode','exports',tsjs(src)+'\nreturn {enableLakesideInstancing,applyLakesideLandFill,lakesideLandFillMaterialClass,lakesideFillMaskTexture};')(
 Material,{},Color,Vec3,Texture2D,o=>!!o,glbOf,D.lakesideLandFillClass,D.lakesideFillLinear,D.lakesideFillMaskBytes,D.lakesideFillWeight,D.lakesideModeLighting,()=>mode,{});
const MD=F.lakesideFillMaskTexture('day');
const palette={name:'M_LK_palette'};
const mk=glb=>{const top={name:glb,parent:null},r={node:{parent:top},sharedMaterials:[palette],setSharedMaterial(x,k){this.sharedMaterials[k]=x;}};top.parent=root;glbOf.set(top,glb);return r;};
const root={parent:null,getComponentsInChildren:()=>rs};
const names=['LK_terrain.glb','LK_far_hills.glb','LK_far_shore.glb','LK_bridge.glb','LK_bridge_steps.glb','LK_lake.glb','LK_tree_round.glb','LK_house_A.glb','LK_rock.glb','LK_cloud.glb'],rs=names.map(mk);
run('instancing: land copies carry the day fill, water / bridge / everything else the plain copy (no emissive at all)',()=>{
 const out=F.enableLakesideInstancing(root);assert.equal(out.length,7,'plain + near + far + foliage + wall + rock + cloud');
 const by=Object.fromEntries(names.map((n,i)=>[n,rs[i].sharedMaterials[0]]));
 assert.equal(F.lakesideLandFillMaterialClass(by['LK_terrain.glb']),'near');assert.equal(F.lakesideLandFillMaterialClass(by['LK_far_hills.glb']),'far');assert.equal(by['LK_far_shore.glb'],by['LK_far_hills.glb']);
 assert.deepEqual(by['LK_terrain.glb'].props,{emissive:[255,255,255,255],emissiveScale:[...P.landFillNearLinear],emissiveMap:MD});assert.deepEqual(by['LK_far_hills.glb'].props,{emissive:[255,255,255,255],emissiveScale:[...P.landFillFarLinear],emissiveMap:MD});
 assert.deepEqual(by['LK_terrain.glb'].defines,{USE_INSTANCING:true,USE_EMISSIVE_MAP:true});assert.deepEqual(by['LK_bridge.glb'].defines,{USE_INSTANCING:true},'plain copy: no emissive map');
 const PC={'LK_tree_round.glb':['foliage','foliageFillLinear'],'LK_house_A.glb':['wall','wallFillLinear'],'LK_rock.glb':['rock','rockFillLinear'],'LK_cloud.glb':['cloud','cloudFillLinear']};
 for(const n of Object.keys(PC)){assert.equal(F.lakesideLandFillMaterialClass(by[n]),PC[n][0]);assert.deepEqual(by[n].props,{emissive:[255,255,255,255],emissiveScale:Array.from(P[PC[n][1]]),emissiveMap:MD},n+' day fill');assert.notEqual(by[n],by['LK_bridge.glb']);}
 for(const n of ['LK_bridge.glb','LK_bridge_steps.glb','LK_lake.glb']){assert.equal(by[n],by['LK_bridge.glb'],n+' plain copy');assert.deepEqual(by[n].props,{},n+' untouched');assert.equal(F.lakesideLandFillMaterialClass(by[n]),null);}
 assert.notEqual(by['LK_terrain.glb'],by['LK_bridge.glb']);});
run('day/night writer: night values on land only; water material and bridge untouched; journey and board use it',()=>{
 const water=new Material();water.setProperty('waterTint',new Vec3(1,1,1));rs[5].sharedMaterials[0]=water;const before=JSON.stringify(water.props),bridge=rs[3].sharedMaterials[0];
 mode='night';assert.equal(F.applyLakesideLandFill(root,'night'),6,'near, far, foliage, wall, rock, cloud');const N=D.lakesideModeLighting('night');
 assert.deepEqual(rs[0].sharedMaterials[0].props.emissiveScale,[...N.landFillNearLinear]);assert.deepEqual(rs[1].sharedMaterials[0].props.emissiveScale,[...N.landFillFarLinear]);
 for(const [i,k] of [[6,'foliageFillLinear'],[7,'wallFillLinear'],[8,'rockFillLinear'],[9,'cloudFillLinear']])assert.deepEqual(rs[i].sharedMaterials[0].props.emissiveScale,Array.from(N[k]),k+' night');
 const MN=F.lakesideFillMaskTexture('night');assert.notEqual(MN,MD);for(const i of [0,1,6,7,8,9])assert.equal(rs[i].sharedMaterials[0].props.emissiveMap,MN,'night mask swapped in');
 assert.equal(JSON.stringify(water.props),before);assert.deepEqual(bridge.props,{});assert.deepEqual(rs[4].sharedMaterials[0].props,{},'bridge steps untouched');
 assert.match(bg,/if\(waterMat\)applyLakesideWaterMode\(waterMat,mode\);\n  if\(scenery&&isValid\(scenery,true\)\)applyLakesideLandFill\(scenery,mode\);/,'board applyDir');
 const ad=fs.readFileSync(S+'RegionJourneyAdapter.ts','utf8');assert.match(ad,/batching=applyLakesideJourneyBatching\(model,\{instancing:enableLakesideInstancing,/,'journey land copies from the same instancing');
 assert.match(ad,/  applyLakesideLandFill\(model,lakesideDayNightMode\(\),fillW\);\n  offLand=onDayNightChange\(\(\)=>\{if\(!dead\)applyLakesideLandFill\(model,lakesideDayNightMode\(\),fillW\);\}\);/,'journey: starts at weight 0, listener keeps the weight');
 assert.match(ad,/fillW=0;/);assert.match(ad,/if\(lakesideFillStep\(fillW,w\)\)\{fillW=w;applyLakesideLandFill\(model,lakesideDayNightMode\(\),w\);\}/,'journey: fill follows lakesideAtmosphereWeight');assert.match(ad,/dead=true;offWater\(\);offLand\(\);/);});
run('r5 weight: emissiveScale = class fill x clamp(weight); 0 = no fill, the board (no weight) = full',()=>{const N=D.lakesideModeLighting('night');
 assert.equal(F.applyLakesideLandFill(root,'night',0.5),6);assert.deepEqual(rs[0].sharedMaterials[0].props.emissiveScale,N.landFillNearLinear.map(x=>x*0.5));
 F.applyLakesideLandFill(root,'night',0);assert.deepEqual(rs[6].sharedMaterials[0].props.emissiveScale,[0,0,0]);
 F.applyLakesideLandFill(root,'night',7);assert.deepEqual(rs[6].sharedMaterials[0].props.emissiveScale,Array.from(N.foliageFillLinear),'clamped to 1');
 F.applyLakesideLandFill(root,'night');assert.deepEqual(rs[9].sharedMaterials[0].props.emissiveScale,Array.from(N.cloudFillLinear));
 assert.equal(D.lakesideFillWeight(NaN),1);assert.equal(D.lakesideFillWeight(-1),0);
 const MS2={exports:{}};const ad=fs.readFileSync(S+'RegionJourneyAdapter.ts','utf8');const stepSrc=ad.match(/export function lakesideFillStep[^\n]*\n/)[0];
 const step=new Function('exports',tsjs(stepSrc)+';return lakesideFillStep;')({});assert(!step(0,0.01));assert(step(0,0.02));assert(step(0.99,1));assert(!step(1,1));assert(step(0.005,0));});
run('r5 per-part mask: 16x16 RGBA, byte = round(255 sqrt(w)) per palette swatch; roofs / door frames / trunks / cliffs off by day',()=>{
 const M=D.LAKESIDE_FILL_PART_WEIGHT;assert.equal(D.LAKESIDE_PALETTE_CELLS.length,6);for(const r of D.LAKESIDE_PALETTE_CELLS)assert.equal(r.split(' ').length,16);
 for(const md of ['day','night']){for(const k of Object.keys(M[md])){const w=M[md][k];assert(w>=0&&w<=1,md+' '+k);assert(/^[0-9a-f]{6}$/.test(k),k);}
  const b=D.lakesideFillMaskBytes(md);assert.equal(b.length,16*16*4);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const i=(y*16+x)*4,hex=y>=D.LAKESIDE_PALETTE_CELL_ROW0?D.LAKESIDE_PALETTE_CELLS[y-D.LAKESIDE_PALETTE_CELL_ROW0].split(' ')[x]:null,w=hex?D.lakesideFillPartWeight(md,hex):1;
   assert.equal(b[i],Math.round(255*Math.sqrt(w)));assert.equal(b[i+1],b[i]);assert.equal(b[i+2],b[i]);assert.equal(b[i+3],255);assert(Math.abs((b[i]/255)**2-w)<0.01,'SRGBToLinear(byte) ~ w');}}
 for(const k of ['e2622f','d9862f','c9532a','5a3524','6a4630','8a5a3a','5e3b28'])assert.equal(D.lakesideFillPartWeight('day',k),0,k+' day off');
 for(const k of ['398f12','3f9a4a','8ccb4e','2c7a3e','fff1d6'])assert.equal(D.lakesideFillPartWeight('day','#'+k.toUpperCase()),1,k+' day on');
 for(const k of ['5b6835','77853e','2f6446','2f7a4a','4e9a5c'])for(const md of ['day','night'])assert(D.lakesideFillPartWeight(md,k)>=0.6,k+' '+md+' far hill base / conifer >= 0.6 (r5.1 near-black band)');
 assert.equal(D.lakesideFillPartWeight('day','123456'),1,'unlisted = 1');
 const t=F.lakesideFillMaskTexture('day');assert.deepEqual(t.info,{width:16,height:16,format:35});assert.deepEqual(t.f,[1,1]);assert.equal(t.mip,0);assert.deepEqual(t.w,[2,2]);assert.deepEqual(Array.from(t.data),Array.from(D.lakesideFillMaskBytes('day')));assert.equal(F.lakesideFillMaskTexture('day'),t,'cached');});
run('night land fill is cool and small (no brown)',()=>{const N=D.lakesideModeLighting('night'),Dy=D.lakesideModeLighting('day');
 for(const k of ['landFillNearLinear','landFillFarLinear']){const c=N[k];assert(c[2]>=c[1]&&c[1]>=c[0]&&c[2]>c[0],'night '+k+' blue >= green >= red');assert(Math.max(...c)<Math.max(...Dy[k])*0.5,'night '+k+' far below day');}});
run('skyDomeColor = the clear colour per mode (not the reflected-sky inputs)',()=>{for(const m of ['day','night']){const L=D.lakesideModeLighting(m);
 assert.equal(L.skyDomeColor,L.clearColor,m+' sky dome = clear colour');}
 assert.equal(D.lakesideModeLighting('day').skyDomeColor,D.lakesideDayClearColor());assert.equal(D.lakesideModeLighting('night').skyDomeColor,D.LAKESIDE_NIGHT_LIGHT_PARAMS.clearColor);
 const hx=h=>[1,3,5].map(i=>parseInt(String(h).slice(i,i+2),16));assert.deepEqual(hx(D.lakesideModeLighting('day').skyDomeColor),[28,143,184],'day sky dome 28/143/184');assert.deepEqual(hx(D.lakesideModeLighting('night').skyDomeColor),[28,39,64],'night sky dome = #1c2740');
 const sd=fs.readFileSync(S+'LakesideSceneData.ts','utf8');assert.equal((sd.match(/skyDomeColor\s*:\s*['"#]/g)||[]).length,0,'skyDomeColor is derived from the clear colour, never a literal');});
run('night prop fill is cool (red lowest, never brown) and dimmer than day',()=>{const N=D.lakesideModeLighting('night'),Dy=D.lakesideModeLighting('day'),lum=c=>0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
 for(const k of ['foliageFillLinear','wallFillLinear','rockFillLinear','cloudFillLinear','plantFillLinear','propFillLinear']){const c=N[k];assert(c[0]<=c[1]&&c[0]<=c[2]&&c[2]>c[0],'night '+k+' red lowest');assert(lum(c)<lum(Dy[k]),'night '+k+' below day');}});
run('draw calls: each fill class is its own merge group; lakeside background + board/UI stays <= 60',()=>{
 const MS={exports:{}};new Function('module','exports','require',tsjs(fs.readFileSync(S+'LakesideStaticMerge.ts','utf8')))(MS,MS.exports,require);const R=path.join(A,'bundles/region_lakeside');
 const tr=JSON.parse(fs.readFileSync(path.join(R,'scene_r5h_slim_transforms.json'),'utf8')),list=D.lakesideSceneInstances(tr.instances),info={},pieces=[];let singles=0;
 const glb=f=>{const b=fs.readFileSync(path.join(R,'models',f));const l=b.readUInt32LE(12);return JSON.parse(b.slice(20,20+l));};
 for(const i of list){if(P.waterGlbs.includes(i.glb))continue;const j=info[i.glb]||(info[i.glb]=glb(i.glb)),pr=j.meshes[0].primitives[0],mat=j.materials[pr.material];
  const key=JSON.stringify({...mat,name:undefined})+'#'+Object.keys(pr.attributes).sort().join('+')+'|fill='+(D.lakesideLandFillClass(i.glb)||'');
  if(mat.alphaMode==='BLEND'){singles++;continue;}pieces.push({group:key,vertices:j.accessors[pr.attributes.POSITION].count,indices:j.accessors[pr.indices].count});}
 const ch=MS.exports.lakesideMergePlan(pieces),bgDraws=ch.filter(c=>c.pieces.length>1).length+new Set(ch.filter(c=>c.pieces.length===1).map(c=>c.group)).size+singles+1;
 console.log('  background ~'+bgDraws+' draws, total ~'+(bgDraws+43)+' (merge groups '+new Set(pieces.map(p=>p.group)).size+')');assert(bgDraws+43<=60,'total draws '+(bgDraws+43));});
console.log('lakeside land fill OK');
