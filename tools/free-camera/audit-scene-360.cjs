'use strict';
/** Static 360° cheat audit. No editor, no GPU. Reads glTF JSON (accessor bounds, materials, names). */
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
function readGlb(file){
 const raw=fs.readFileSync(file);
 if(raw.toString('utf8',0,4)!=='glTF')throw Error('not glb '+file);
 const jl=raw.readUInt32LE(12);
 return JSON.parse(raw.subarray(20,20+jl).toString());
}
function quatMat(q,s,t){
 const [x,y,z,w]=q,[sx,sy,sz]=s;
 const xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
 return [
  (1-2*(yy+zz))*sx,2*(xy+wz)*sx,2*(xz-wy)*sx,0,
  2*(xy-wz)*sy,(1-2*(xx+zz))*sy,2*(yz+wx)*sy,0,
  2*(xz+wy)*sz,2*(yz-wx)*sz,(1-2*(xx+yy))*sz,0,
  t[0],t[1],t[2],1];
}
function mul(A,B){const M=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)M[c*4+r]+=A[k*4+r]*B[c*4+k];return M;}
function nodeMat(n){
 if(n.matrix&&n.matrix.length===16)return n.matrix.slice();
 return quatMat(n.rotation||[0,0,0,1],n.scale||[1,1,1],n.translation||[0,0,0]);
}
function xf(M,v){return [M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];}
const FAKE=/card|billboard|impostor|imposter|far_|backdrop|canvas|blind|window_view|quad|plane|sprite|rainbow|decal/i;
const FX=/foam|wave|cloud|splash|shadow|reed|ripple|glint|halo|smoke|beam|gull|leaf_card|grass_card|tuft|lilypad|lily|paper_boat|drop/i;
const SKY=/sky|dome|stars|night_dome/i;
const LAND=/lighthouse|greattree|great_tree|windmill|robot_gardener|pavilion|starcourt|hut|cabin|wind_bell|windbell|chime_post/i;
function analyze(file,region){
 const doc=readGlb(file);
 const parent={};
 (doc.nodes||[]).forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i;}));
 const world=[];
 for(let i=0;i<(doc.nodes||[]).length;i++){
  let M=nodeMat(doc.nodes[i]);
  for(let k=parent[i];k!==undefined;k=parent[k])M=mul(nodeMat(doc.nodes[k]),M);
  world[i]=M;
 }
 const pathOf=i=>{const s=[];for(let k=i;k!==undefined;k=parent[k])s.push(doc.nodes[k].name||('node'+k));return s.reverse().join('/');};
 const mats=doc.materials||[];
 const items=[];
 const names=new Map();
 (doc.nodes||[]).forEach((n,i)=>{
  const name=n.name||'';
  if(name)names.set(name,(names.get(name)||0)+1);
  if(n.mesh===undefined)return;
  const mesh=doc.meshes[n.mesh];
  let thin=false,span=[0,0,0],doubleSided=null,alpha='',tris=0;
  for(const pr of mesh.primitives||[]){
   const acc=doc.accessors?.[pr.attributes?.POSITION];
   if(acc&&acc.min&&acc.max){
    const ext=[acc.max[0]-acc.min[0],acc.max[1]-acc.min[1],acc.max[2]-acc.min[2]];
    span=ext.map((v,k)=>Math.max(span[k],v));
    const mx=Math.max(ext[0],ext[1],ext[2]),mn=Math.min(ext[0],ext[1],ext[2]);
    if(mx>0.4&&mn<Math.max(0.12,mx*0.08))thin=true;
   }
   if(pr.material!==undefined){
    const m=mats[pr.material]||{};
    if(m.doubleSided)doubleSided=true;else if(doubleSided===null)doubleSided=false;
    if(m.alphaMode&&m.alphaMode!=='OPAQUE')alpha=m.alphaMode;
   }
   if(pr.mode===undefined||pr.mode===4)tris++;
  }
  const corners=[];
  const acc0=(mesh.primitives||[]).map(pr=>doc.accessors?.[pr.attributes?.POSITION]).find(a=>a&&a.min&&a.max);
  if(acc0){
   const [a,b]=[acc0.min,acc0.max];
   for(const x of [a[0],b[0]])for(const y of [a[1],b[1]])for(const z of [a[2],b[2]])corners.push(xf(world[i], [x,y,z]));
  }
  let wmin=null,wmax=null;
  for(const p of corners){if(!wmin){wmin=p.slice();wmax=p.slice();continue;}for(let k=0;k<3;k++){wmin[k]=Math.min(wmin[k],p[k]);wmax[k]=Math.max(wmax[k],p[k]);}}
  const label=name+' '+(mesh.name||'');
  let severity=null,why='';
  if(FAKE.test(label)||/RainbowBridge/i.test(label)){severity='high';why='名字就是给固定镜头用的面片、远景卡或桥带';}
  else if(SKY.test(label)){severity='medium';why='天空或穹顶，镜头在内部才成立';}
  else if(thin&&doubleSided===false){severity=FX.test(label)?'medium':'high';why='很扁且材质不是双面，转到背面会消失';}
  else if(FX.test(label)&&(thin||alpha==='BLEND'||doubleSided===false)){severity='medium';why='泡沫、云、影子或卡片效果，通常只朝一个镜头';}
  else if(doubleSided===false&&Math.max(...span)>2.5&&!/terrain|ground|sea|water|island/i.test(label)){severity='low';why='较大网格默认单面，绕到背面可能透';}
  if(!severity)return;
  items.push({region,file:path.relative(ROOT,file),node:pathOf(i),name,severity,why,thin,doubleSided,alpha,span:span.map(v=>+v.toFixed(2)),worldMin:wmin&&wmin.map(v=>+v.toFixed(1)),worldMax:wmax&&wmax.map(v=>+v.toFixed(1))});
 });
 const dups=[];
 for(const [name,n] of names)if(n>1&&LAND.test(name)&&!/night/i.test(name))dups.push({name,n});
 return {region,file:path.relative(ROOT,file),nodes:(doc.nodes||[]).length,items,dups};
}
const jobs=[
 ['home+island',path.join(ROOT,'creator-project/assets/firstslice/combined_visual_m.glb')],
 ['meadow',path.join(ROOT,'creator-build-project/assets/bundles/region_meadow/env_meadow.glb')],
 ['skycity',path.join(ROOT,'creator-build-project/assets/bundles/region_skycity/env_skycity.glb')],
];
const out=jobs.map(([r,f])=>analyze(f,r));
const lakeDir=path.join(ROOT,'creator-build-project/assets/bundles/region_lakeside/models');
const lake=fs.readdirSync(lakeDir).filter(n=>n.endsWith('.glb')).map(n=>analyze(path.join(lakeDir,n),'lakeside'));
const transitDir=path.join(ROOT,'creator-build-project/assets/bundles/region_transit_balloon');
const transit=fs.existsSync(transitDir)?fs.readdirSync(transitDir).filter(n=>n.endsWith('.glb')).map(n=>analyze(path.join(transitDir,n),'transit')):[];
const report={out,lake,transit};
fs.writeFileSync('/tmp/scene360.json',JSON.stringify(report));
function brief(list){
 const rows=list.flatMap(r=>r.items);
 const by={high:0,medium:0,low:0};
 for(const it of rows)by[it.severity]++;
 return {files:list.length,high:by.high,medium:by.medium,low:by.low,dups:list.flatMap(r=>r.dups)};
}
console.log(JSON.stringify({homeIsland:brief(out.filter(r=>r.region==='home+island')),meadow:brief(out.filter(r=>r.region==='meadow')),skycity:brief(out.filter(r=>r.region==='skycity')),lakeside:brief(lake),transit:brief(transit)},null,2));
const highs=report.out.concat(lake).flatMap(r=>r.items.filter(i=>i.severity==='high').map(i=>i.region+' '+i.node));
console.log('HIGHS',highs.length);
console.log(highs.slice(0,80).join('\n'));
