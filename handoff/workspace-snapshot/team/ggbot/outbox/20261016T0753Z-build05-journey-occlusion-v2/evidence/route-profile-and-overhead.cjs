const fs=require('fs'),{place,rotY}=require('./scene.cjs'),{load}=require('./glb.cjs'),{segHit,bbox}=require('./occl.cjs');
const R='/workspace/wechat-game/work/build05-occl/',rep=JSON.parse(fs.readFileSync(R+'tools/journey-integration/reports/journey-occlusion.json')),P=rep.placement,out=process.argv[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],f=v=>v.map(x=>x.toFixed(3));
const meadow=place(load(R+'creator-build-project/assets/bundles/region_meadow/env_meadow.glb').filter(n=>!/meadow_sky_dome|meadow_far_hills|meadow_clouds_near/.test(n.path)),{yaw:180,offset:P.meadowRootWorld},'meadow');
const sky=place(load(__dirname+'/skycity_dec.glb'),{yaw:P.skycityYawDeg,offset:P.skycityRootWorld},'sky');
function up(objs,p){let best=null;for(const o of objs){if(!o.tris?.length)continue;o.bb??=bbox(o.tris);const[mn,mx]=o.bb;if(p[0]<mn[0]||p[0]>mx[0]||p[2]<mn[2]||p[2]>mx[2]||mx[1]<p[1])continue;const t=segHit(p,[0,1,0],80,o.tris);if(t!==null&&(!best||t<best.t))best={t,n:o.name};}return best;}
let txt='';
for(const id of ['04-05','08-09']){const rows=rep.routeProfile[id].rows,ph=P.phases[id];let csv='d_m,phase,world_x,world_y,world_z,meadow_local_x,meadow_local_y,meadow_local_z'+(id==='08-09'?',sky_local_x,sky_local_y,sky_local_z,overhead_clear_above_head_m':'')+'\n';let low=0,minUp=1e9;
 for(const r of rows){const w=[r.x,r.y,r.z],phase=r.d<ph.bridgeStart?'approach':r.d<ph.bridgeEnd?'bridge':(id==='08-09'?'sky-deck/arrival':'arrival');const ml=rotY(-180,sub(w,P.meadowRootWorld));let line=[r.d.toFixed(2),phase,...f(w),...f(ml)];
  if(id==='08-09'){const sl=rotY(-P.skycityYawDeg,sub(w,P.skycityRootWorld));const u=up([...meadow,...sky],[w[0],w[1]+1.6,w[2]]);if(u){minUp=Math.min(minUp,u.t);if(u.t<8)low++;}line.push(...f(sl),u?u.t.toFixed(2):'open');}
  csv+=line.join(',')+'\n';}
 fs.writeFileSync(out+'/route-height-'+id.replace('-','-')+'.csv',csv);if(id==='08-09')txt+=`08-09 overhead (ray up from head, 0.5 m step, meadow+sky meshes): samples with geometry <8 m above head: ${low}; min overhead ${minUp===1e9?'none (open sky everywhere)':minUp.toFixed(2)+' m'}\n`;}
// windmill / meadow vs city overlap: meadow mesh vertices inside the city's bbox (xz) and height range
const cb=sky.reduce((b,o)=>{if(!o.tris?.length)return b;const [mn,mx]=bbox(o.tris);return [b[0].map((v,i)=>Math.min(v,mn[i])),b[1].map((v,i)=>Math.max(v,mx[i]))];},[[1e9,1e9,1e9],[-1e9,-1e9,-1e9]]);
const wm=meadow.filter(o=>/windmill/.test(o.name)&&o.tris?.length).map(o=>{const [mn,mx]=bbox(o.tris);return o.name+' bbox x'+mn[0].toFixed(1)+'..'+mx[0].toFixed(1)+' z'+mn[2].toFixed(1)+'..'+mx[2].toFixed(1)+' y'+mn[1].toFixed(1)+'..'+mx[1].toFixed(1);});
txt+='city world bbox x'+cb[0][0].toFixed(1)+'..'+cb[1][0].toFixed(1)+' z'+cb[0][2].toFixed(1)+'..'+cb[1][2].toFixed(1)+' y'+cb[0][1].toFixed(1)+'..'+cb[1][1].toFixed(1)+'\n'+wm.slice(0,4).join('\n')+'\n';
fs.writeFileSync(out+'/overhead-and-overlap.txt',txt);console.log(txt);
const solid=sky.filter(o=>o.tris?.length&&/static_palette|rock_strata|ruins|foliage/.test(o.name));const wmb=meadow.filter(o=>/windmill/.test(o.name)&&o.tris?.length).map(o=>bbox(o.tris));
const inter=(a,b)=>[0,1,2].every(i=>a[0][i]<=b[1][i]&&b[0][i]<=a[1][i]);let hits=[];for(const o of solid){const b=bbox(o.tris);if(wmb.some(w=>inter(w,b)))hits.push(o.name);}
const sb=solid.reduce((b,o)=>{const [mn,mx]=bbox(o.tris);return [b[0].map((v,i)=>Math.min(v,mn[i])),b[1].map((v,i)=>Math.max(v,mx[i]))];},[[1e9,1e9,1e9],[-1e9,-1e9,-1e9]]);
const t2='city solid (palette/strata/ruins/foliage) world bbox x'+sb[0][0].toFixed(1)+'..'+sb[1][0].toFixed(1)+' z'+sb[0][2].toFixed(1)+'..'+sb[1][2].toFixed(1)+' y'+sb[0][1].toFixed(1)+'..'+sb[1][1].toFixed(1)+'\nwindmill bbox ∩ city solid bboxes: '+(hits.length?hits.join(','):'none')+'\n';fs.appendFileSync(out+'/overhead-and-overlap.txt',t2);console.log(t2);
