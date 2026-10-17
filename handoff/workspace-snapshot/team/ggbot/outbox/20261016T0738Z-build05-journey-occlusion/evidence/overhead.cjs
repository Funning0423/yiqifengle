const {build,place,rotY}=require('./scene.cjs'),{segHit,bbox}=require('./occl.cjs'),{L0,sample,len}=require('./analyse.cjs');const fs=require('fs');
const S=build(L0);
function up(objs,p){let best=null;for(const o of objs){if(!o.tris?.length)continue;o.bb??=bbox(o.tris);const[mn,mx]=o.bb;if(p[0]<mn[0]||p[0]>mx[0]||p[2]<mn[2]||p[2]>mx[2]||mx[1]<p[1])continue;const t=segHit(p,[0,1,0],80,o.tris);if(t!==null&&(!best||t<best.t))best={t,n:o.name};}return best;}
const rep=(tag,path,objs,T)=>{const rows=[];for(let d=0;d<=T;d+=.5){const p=sample(path,d),h=[p[0],p[1]+1.6,p[2]];const u=up(objs,h);rows.push([+d.toFixed(1),u?+u.t.toFixed(2):null,u?.n||'']);}
 const low=rows.filter(r=>r[1]!==null&&r[1]<8);console.log(tag,'T',T.toFixed(2),'samples with overhead <8m above head:',low.length);low.forEach(r=>console.log('  ',r.join(' ')));return rows;};
const b=S.leg2.path;rep('BEFORE 08-09',b,[...S.meadow,...S.sky],len(b));
const csv=fs.readFileSync('/workspace/wechat-game/team/ggbot/outbox/20261016T0738Z-build05-journey-occlusion/route-height-08-09.csv','utf8').trim().split('\n').slice(1).map(l=>l.split(','));
const yaw=-54.974,r0=csv[0],loc=[+r0[8],+r0[9],+r0[10]],rr=rotY(yaw,loc),off=[+r0[2]-rr[0],+r0[3]-rr[1],+r0[4]-rr[2]];
const g=require('./scene.cjs');const sky=place(require('./glb.cjs').load?require('./glb.cjs').load(__dirname+'/skycity_dec.glb'):null,{yaw,offset:off},'sky');
const chk=csv[98],q=rotY(yaw,[+chk[8],+chk[9],+chk[10]]);console.log('placement check err',Math.hypot(q[0]+off[0]-chk[2],q[1]+off[1]-chk[3],q[2]+off[2]-chk[4]).toFixed(4));
const ap=csv.map(r=>[+r[2],+r[3],+r[4]]);rep('AFTER 08-09',ap,[...S.meadow,...sky],len(ap));
