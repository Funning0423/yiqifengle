'use strict';
/** Gate skirt-leg-penetration (b21, 运镜bot; Grok Bot 2026-10-31): in every clip and frame no leg / knee / shoe vertex of her BODY
 *  may be through the dress or the apron - penetration depth 0 (hem_lib.penetration: the cloth may never lie between a leg vertex
 *  and the centre line of its own limb segment).  Every clip x 60 fps, 30 fps, uneven dt sampled directly AND through the real
 *  CharacterMotion/AnimRig runtime (crossfades, wind layer, morph weights).
 *  Negatives: walk_loop with the front skirt joints pinned to rest (no clearance solve) must FAIL; the 773c061e walk_loop
 *  front curves (pre-existing 1.2 cm shin poke) must FAIL.
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
check('negative: 773c061e walk_loop front curves must FAIL',()=>{const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/front_curves_773c061e.json'),'utf8'));const R2=H.load(GLB),S2=H.sets(R2);
  H.overrideChannels(R2,{walk_loop:fx.clips.walk_loop});const j=judge(clipRows(R2,S2,M,['walk_loop'],30));return {ok:j.hits>0,...j};});
const failed=results.filter(r=>!r.ok);const rep={gate:'skirt-leg-penetration',status:failed.length?'FAIL':'PASS',glb:path.relative(H.ROOT,GLB),results};
if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(rep,null,1));console.log(JSON.stringify({...rep,results:results.map(r=>({name:r.name,ok:r.ok,...(r.info||{}),error:r.error}))},null,1));process.exitCode=failed.length?1:0;
