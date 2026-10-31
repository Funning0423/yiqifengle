'use strict';
/** Gate skirt-leg-penetration (b21, 运镜bot; Grok Bot 2026-10-31): in every clip and frame no leg / knee / shoe vertex of her BODY
 *  may be through the dress or the apron - penetration depth 0 (hem_lib.penetration: the cloth may never lie between a leg vertex
 *  and the centre line of its own limb segment).  Every clip x 60 fps, 30 fps, uneven dt sampled directly AND through the real
 *  CharacterMotion/AnimRig runtime (crossfades, wind layer, morph weights).
 *  Pass-through (run 4): with the thigh within 30 deg of vertical a leg vertex must also reach her hips' vertical axis without
 *  crossing cloth (hem_lib.axisHits) - cloth swung wholly behind a shin is caught too.
 *  Negatives: walk_loop with the front skirt joints pinned to rest (no clearance solve) must FAIL; the 773c061e stand_up skirt
 *  curves (thigh.R through the back panel while seated) must FAIL; walk_loop with the front panel swung 12 deg back through the
 *  forward shin must FAIL through the pass-through test.
 *  node tools/skirt-hem/test_skirt_leg_penetration.cjs [--glb path] [--json out] */
const fs=require('fs'),path=require('path'),H=require('./hem_lib.cjs'),RT=require('./runtime_eval.cjs');
const args=process.argv.slice(2),arg=(n,d)=>args.includes(n)?args[args.indexOf(n)+1]:d;const GLB=path.resolve(arg('--glb',H.GLB));const MODES=[60,30,'uneven'];
function judge(rows){let n=0,count=0,max=0,worst=null;const by={};for(const r of rows){n++;if(r.pen.count){count+=r.pen.count;const k=r.clip;by[k]=(by[k]||0)+r.pen.count;if(r.pen.maxDepth>max){max=r.pen.maxDepth;worst={at:r.at,...r.pen.worst};}}}
  return {frames:n,hits:count,maxDepthCm:+(max*100).toFixed(2),worst,byClip:by};}
function clipRows(R,S,M,clips,mode){const rows=[];for(const clip of clips)for(const t of H.times(R.clips[clip].duration,mode,clip.length*31+7)){H.applyClip(R,clip,t);const p=H.penetration(R,S,H.clipMorph(M,clip,t));rows.push({at:clip+'@'+t.toFixed(4)+'/'+mode,clip,pen:p});}return rows;}
const results=[];const check=(name,fn)=>{try{const info=fn();results.push({name,ok:info.ok,info});}catch(e){results.push({name,ok:false,error:String(e&&e.stack||e)});}};
const R=H.load(GLB),S=H.sets(R),M=H.loadMeta(path.join(path.dirname(GLB),'anim_meta.json'));const clips=Object.keys(R.clips).filter(c=>!/wind_flutter/.test(c));
for(const mode of MODES)check('clips '+mode,()=>{const j=judge(clipRows(R,S,M,clips,mode));return {ok:j.hits===0,...j};});
for(const mode of MODES)check('runtime '+mode,()=>{const j=judge(RT.run(GLB,mode).map(r=>({at:r.scenario+'@'+r.T.toFixed(3)+' '+r.clip+'/'+mode,clip:r.clip,pen:r.pen})));return {ok:j.hits===0,...j};});
check('negative: walk_loop with the front skirt pinned to rest must FAIL',()=>{const R2=H.load(GLB),S2=H.sets(R2);H.restChannels(R2,'walk_loop',['skirt.front','skirt.front.low','skirt.front.low.mid']);const j=judge(clipRows(R2,S2,M,['walk_loop'],30));return {ok:j.hits>0,...j};});
check('negative: 773c061e stand_up skirt curves (thigh.R through skirt.back while seated) must FAIL',()=>{const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/stand_up_773c061e.json'),'utf8'));const R2=H.load(GLB),S2=H.sets(R2);
  H.overrideChannels(R2,fx.clips);const j=judge(clipRows(R2,S2,M,['stand_up'],30));return {ok:j.hits>0&&j.worst&&/skirt\.back/.test(j.worst.cloth||''),...j};});
check('negative: walk_loop front panel swung back through the forward shin (pass-through) must FAIL',()=>{const R2=H.load(GLB),S2=H.sets(R2);const i=R2.byName['skirt.front'],q=R2.rest[i].q,h=-12*Math.PI/360,b=H.qmul([-Math.sin(h),0,0,Math.cos(h)],q);
  const C=R2.clips.walk_loop,c=C.channels.find(x=>x.path==='rotation'&&x.node===i);c.inp=Float64Array.from([0,C.duration]);c.out=Float64Array.from([...b,...b]);c.n=4;c.step=false;
  H.restChannels(R2,'walk_loop',['skirt.front.low','skirt.front.low.mid','skirt.front.mid']);let axis=0;const rows=[];for(const t of H.times(C.duration,30)){H.applyClip(R2,'walk_loop',t);const p=H.penetration(R2,S2,H.clipMorph(M,'walk_loop',t));axis+=p.by.axis||0;rows.push({at:'walk_loop@'+t.toFixed(4),clip:'walk_loop',pen:p});}
  const j=judge(rows);return {ok:j.hits>0&&axis>0,axisHits:axis,...j};});
const failed=results.filter(r=>!r.ok);const rep={gate:'skirt-leg-penetration',status:failed.length?'FAIL':'PASS',glb:path.relative(H.ROOT,GLB),results};
if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(rep,null,1));console.log(JSON.stringify({...rep,results:results.map(r=>({name:r.name,ok:r.ok,...(r.info||{}),error:r.error}))},null,1));process.exitCode=failed.length?1:0;
