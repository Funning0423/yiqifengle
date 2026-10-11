/* Content-only validation. No storage, drawing, RNG or gameplay mutation. */
'use strict';
const REGION_KEYS=['tide','meadow','sky'],GOAL=/^(type[0-5]|moss|roots|lines|specials|beacons)$/;
const cell=i=>Number.isInteger(i)&&i>=0&&i<49,positive=n=>Number.isInteger(n)&&n>0;
function transform(i,mode){let r=Math.floor(i/7),c=i%7;if(mode>=4)c=6-c;for(let n=0;n<mode%4;n++){const x=r;r=c;c=6-x;}return r*7+c;}
function structuralFingerprint(stage){
 const c=stage.config||{},goalKinds=Object.keys(c.goals||{}).filter(k=>!k.startsWith('type')).sort(),typeGoals=Object.keys(c.goals||{}).filter(k=>k.startsWith('type')).length;
 const variants=[];for(let mode=0;mode<8;mode++){
  const rotate=mode%2===1,map=i=>transform(i,mode),route=(c.beacons||[]).map(map),typePattern=[],seen=new Map();
  for(const t of c.beaconTypes||[]){if(!seen.has(t))seen.set(t,seen.size);typePattern.push(seen.get(t));}
  const starters=(c.starters||[]).map(s=>[map(s.index),rotate?(s.special==='row'?'column':s.special==='column'?'row':s.special):s.special]).sort((a,b)=>a[0]-b[0]||a[1].localeCompare(b[1]));
  variants.push(JSON.stringify({moss:(c.moss||[]).map(map).sort((a,b)=>a-b),roots:(c.roots||[]).map(x=>[map(x.index),x.layers]).sort((a,b)=>a[0]-b[0]),route,typePattern,typeGoalMembership:(c.beaconTypes||[]).map(t=>Object.prototype.hasOwnProperty.call(c.goals||{},'type'+t)),starters,goalKinds,typeGoals}));
 }return variants.sort()[0];
}
function validateStage(stage,{themes,packId='c01',perRegion=12}={}){
 const errors=[];const fail=(code,detail)=>errors.push({code,detail});if(!stage||typeof stage!=='object')return [{code:'stage-object'}];
 const region=REGION_KEYS.indexOf(stage.region),expected=typeof stage.region==='string'&&typeof packId==='string'&&Number.isInteger(stage.ordinal)?stage.region+'-'+packId+'-'+String(stage.ordinal).padStart(3,'0'):null;
 if(region<0)fail('region','Must reuse tide/meadow/sky.');if(!Number.isInteger(stage.ordinal)||stage.ordinal<1||stage.ordinal>perRegion)fail('ordinal','Ordinal must fit this pack region size.');if(stage.id!==expected)fail('stable-id',expected);
 if(!['core','variant'].includes(stage.kind))fail('kind');if(typeof stage.coreId!=='string'||!stage.coreId)fail('core-id');
 if(!['warmup','strategy','challenge','breather'].includes(stage.difficultyIntent))fail('difficulty-intent');
 if(typeof stage.designIntent!=='string'||stage.designIntent.length<8)fail('design-intent');if(typeof stage.choiceTradeoff!=='string'||stage.choiceTradeoff.length<8)fail('choice-tradeoff');
 if(themes&&(typeof stage.theme!=='string'||!Object.prototype.hasOwnProperty.call(themes,stage.theme)))fail('theme','Must use an existing theme.');
 const c=stage.config;if(!c||typeof c!=='object')return errors.concat({code:'config'});
 if(!Number.isInteger(c.moves)||c.moves<8||c.moves>50)fail('moves','Candidate budget must be 8..50, not unlimited padding.');
 const goals=c.goals;if(!goals||typeof goals!=='object'||Array.isArray(goals)||!Object.keys(goals).length)fail('goals');else{
  if(Object.keys(goals).length>5)fail('hud-goals','Existing board HUD supports at most five targets.');
  for(const[k,v]of Object.entries(goals))if(!GOAL.test(k)||!positive(v))fail('goal-value',k);
 }
 const moss=Array.isArray(c.moss)?c.moss:[];
 if(!Array.isArray(c.moss)||!Array.from(c.moss).every(cell)||new Set(c.moss).size!==c.moss.length)fail('moss');
 const roots=Array.isArray(c.roots)?c.roots:[];
 if(!Array.isArray(c.roots)||!Array.from(c.roots).every(x=>x&&cell(x.index)&&Number.isInteger(x.layers)&&x.layers>=1&&x.layers<=3)||new Set((c.roots||[]).map(x=>x.index)).size!==(c.roots||[]).length)fail('roots');
 if(roots.filter(x=>x&&x.layers===3).length>1)fail('durability-grind','At most one deliberate three-layer center in this pack.');
 if(Number.isInteger(goals?.moss)&&goals.moss>moss.length)fail('impossible-moss');if(Number.isInteger(goals?.roots)&&goals.roots>roots.length)fail('impossible-roots');
 const route=Array.isArray(c.beacons)?c.beacons:[];if(c.beacons!==undefined&&!Array.isArray(c.beacons)||!Array.from(route).every(cell))fail('route');if((goals?.beacons||0)!==route.length)fail('route-goal');if(route.length>5)fail('route-length');
 if(c.beaconTypes!==undefined&&(!Array.isArray(c.beaconTypes)||!route.length||c.beaconTypes.length!==route.length||!Array.from(c.beaconTypes).every(t=>Number.isInteger(t)&&t>=0&&t<6)))fail('typed-route');
 if(c.starters!==undefined&&(!Array.isArray(c.starters)||c.starters.length>4||!Array.from(c.starters).every(s=>s&&cell(s.index)&&['row','column','bomb','color'].includes(s.special))||new Set(c.starters.map(s=>s.index)).size!==c.starters.length))fail('starters');
 if(Number.isInteger(goals?.lines)&&goals.lines>6||Number.isInteger(goals?.specials)&&goals.specials>6)fail('creation-grind');
 return errors;
}
function validateCatalog(stages,options={}){
 if(!Array.isArray(stages))return {valid:false,stageCount:0,counts:{tide:0,meadow:0,sky:0},coreCounts:{tide:0,meadow:0,sky:0},uniqueStructures:0,errors:[{code:'catalog-array'}]};
 const errors=[],ids=new Set(),fingerprints=new Map(),counts={tide:0,meadow:0,sky:0},coreCounts={tide:0,meadow:0,sky:0};
 for(const stage of stages||[]){if(!stage||typeof stage!=='object'){errors.push({code:'stage-object'});continue;}const local=validateStage(stage,options);for(const e of local)errors.push({id:stage?.id,...e});if(ids.has(stage.id))errors.push({id:stage.id,code:'duplicate-id'});ids.add(stage.id);if(typeof stage.region==='string'&&stage.region in counts){counts[stage.region]++;if(stage.kind==='core')coreCounts[stage.region]++;}
  if(!local.length){const fp=structuralFingerprint(stage);if(fingerprints.has(fp))errors.push({id:stage.id,code:'structural-duplicate',of:fingerprints.get(fp),detail:'Equivalent after rotation/mirror; ignores move count, target quantities and color relabeling.'});else fingerprints.set(fp,stage.id);}
 }
 for(const stage of stages){if(!stage)continue;const core=stages.find(s=>s&&s.id===stage.coreId);if(!core||core.kind!=='core'||core.region!==stage.region)errors.push({id:stage.id,code:'missing-core',coreId:stage.coreId});if(stage.kind==='core'&&stage.coreId!==stage.id)errors.push({id:stage.id,code:'core-self-reference'});}
 if(options.requireFirstBatch!==false)for(const core of stages.filter(s=>s&&s.kind==='core')){const count=stages.filter(s=>s&&s.kind==='variant'&&s.coreId===core.id).length;if(count!==(options.variantsPerCore||3))errors.push({id:core.id,code:'variant-count',actual:count,expected:options.variantsPerCore||3});}
 if(options.requireFirstBatch!==false)for(const region of REGION_KEYS){if(counts[region]!==(options.perRegion||12))errors.push({region,code:'region-count',actual:counts[region],expected:options.perRegion||12});if(coreCounts[region]!==(options.corePerRegion||3))errors.push({region,code:'core-count',actual:coreCounts[region],expected:options.corePerRegion||3});}
 return {valid:!errors.length,stageCount:(stages||[]).length,counts,coreCounts,uniqueStructures:fingerprints.size,errors};
}
module.exports={REGION_KEYS,validateStage,validateCatalog,structuralFingerprint};
