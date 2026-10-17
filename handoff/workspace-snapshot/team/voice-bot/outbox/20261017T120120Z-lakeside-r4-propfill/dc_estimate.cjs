// DC estimate = the static-merge test's model + the fill class in the merge key (a filled copy differs in props -> own group)
const fs=require('fs'),path=require('path');const ts=require(process.env.QF_TYPESCRIPT_MODULE);
const W=process.argv[2],A=path.join(W,'creator-build-project/assets'),R=path.join(A,'bundles/region_lakeside');
const load=f=>{const m={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path.join(A,'scripts/region',f),'utf8'),{compilerOptions:{module:1,target:6}}).outputText)(m,m.exports,require);return m.exports;};
const M=load('LakesideStaticMerge.ts'),D=load('LakesideSceneData.ts');
const tr=JSON.parse(fs.readFileSync(path.join(R,'scene_r5h_slim_transforms.json'),'utf8')),list=D.lakesideSceneInstances(tr.instances);
const glb=f=>{const b=fs.readFileSync(path.join(R,'models',f));const l=b.readUInt32LE(12);return JSON.parse(b.slice(20,20+l));};
const water=new Set(D.LAKESIDE_DIR_LIGHT_PARAMS.waterGlbs);
for(const [label,cls] of [['467b36d (land fill only)',g=>['LK_terrain.glb'].includes(g)?'near':['LK_far_hills.glb','LK_far_shore.glb'].includes(g)?'far':null],['this commit',g=>D.lakesideLandFillClass(g)]]){
 const pieces=[],info={};let singles=0;
 for(const i of list){if(water.has(i.glb))continue;const j=info[i.glb]||(info[i.glb]=glb(i.glb));const p=j.meshes[0].primitives[0],mat=j.materials[p.material];
  const key=JSON.stringify({...mat,name:undefined})+'#'+Object.keys(p.attributes).sort().join('+')+'|fill='+(cls(i.glb)||'');
  if(mat.alphaMode==='BLEND'){singles++;continue;}pieces.push({group:key,vertices:j.accessors[p.attributes.POSITION].count,indices:j.accessors[p.indices].count});}
 const chunks=M.lakesideMergePlan(pieces),merged=chunks.filter(c=>c.pieces.length>1),lone=new Set(chunks.filter(c=>c.pieces.length===1).map(c=>c.group)).size;
 const bg=merged.length+lone+singles+1;console.log(label+': '+pieces.length+' pieces -> '+merged.length+' merged chunks + '+lone+' instanced kinds + '+singles+' blended + 1 water = '+bg+' background draws; + 43 board/UI = '+(bg+43));}
