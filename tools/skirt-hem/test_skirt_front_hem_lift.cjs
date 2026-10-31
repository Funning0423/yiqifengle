'use strict';
/** Gate skirt-front-hem-lift (b21, 运镜bot; thresholds approved by Grok Bot 2026-10-31):
 *   dress front-hem lowest point: lift <= 3.0 cm vs rest AND always >= 4.5 cm below the knee; apron hem lift <= 3.0 cm;
 *   forward flare <= 28 cm; any single hem vertex lift <= 5 cm.  Seated clips (sit_down, sit_hold, stand_up) only while the thigh
 *   is within 30 deg of vertical.  Every clip x 60 fps, 30 fps, uneven dt (LCG [1/90,1/45]) sampled directly, AND the real
 *   CharacterMotion/AnimRig runtime (crossfades + wind_flutter layer + morph weights, runtime_eval.cjs) at the same three rates.
 *   Negatives: the 773c061e front curves of walk_loop and door_reach (fixtures/front_curves_773c061e.json) must FAIL.
 *   node tools/skirt-hem/test_skirt_front_hem_lift.cjs [--glb path] [--json out]   (QF_TYPESCRIPT_MODULE for the runtime path) */
const fs=require('fs'),path=require('path'),H=require('./hem_lib.cjs'),RT=require('./runtime_eval.cjs');
const args=process.argv.slice(2),arg=(n,d)=>args.includes(n)?args[args.indexOf(n)+1]:d;const GLB=path.resolve(arg('--glb',H.GLB));
const LIM={lift:0.030,belowKnee:0.045,apron:0.030,flare:0.28,vert:0.05};const SEATED=/^(sit_down|sit_hold|stand_up)$/;const MODES=[60,30,'uneven'];
function judge(rows){const w={lift:null,belowKnee:null,apron:null,flare:null,vert:null};let n=0;const fails=[];
  for(const r of rows){if(r.skip)continue;n++;const v={lift:r.dress.lift,belowKnee:r.dress.belowKnee,apron:r.apron.lift,flare:Math.max(r.dress.flare,r.apron.flare),vert:Math.max(r.dress.maxVertLift,r.apron.maxVertLift)};
    for(const k in v){const worse=k==='belowKnee'?(w[k]===null||v[k]<w[k].v):(w[k]===null||v[k]>w[k].v);if(worse)w[k]={v:+v[k].toFixed(4),at:r.at};}
    for(const k in v){const bad=k==='belowKnee'?v[k]<LIM[k]:v[k]>LIM[k];if(bad)fails.push({k,v:+v[k].toFixed(4),at:r.at});}}
  return {frames:n,worst:w,failCount:fails.length,fails:fails.slice(0,12)};}
function clipRows(R,S,M,clips,mode){const rows=[];for(const clip of clips)for(const t of H.times(R.clips[clip].duration,mode,clip.length*31+7)){H.applyClip(R,clip,t);const m=H.hemMetrics(R,S,H.clipMorph(M,clip,t));
  rows.push({at:clip+'@'+t.toFixed(4)+'/'+mode,skip:SEATED.test(clip)&&m.thighDeg>30,dress:m.dress,apron:m.apron});}return rows;}
const runtimeRows=(glb,mode,patch)=>RT.run(glb,mode,{penetration:false,patch}).map(r=>({at:r.scenario+'@'+r.T.toFixed(3)+' '+r.clip+(r.out?'<'+r.out+':'+r.fade.toFixed(2):'')+'/'+mode,skip:r.seatedSkip,dress:r.dress,apron:r.apron}));
const results=[];const check=(name,fn)=>{try{const info=fn();results.push({name,ok:info.ok,info});}catch(e){results.push({name,ok:false,error:String(e&&e.stack||e)});}};
const R=H.load(GLB),S=H.sets(R),M=H.loadMeta(path.join(path.dirname(GLB),'anim_meta.json'));const clips=Object.keys(R.clips).filter(c=>!/wind_flutter/.test(c));
for(const mode of MODES)check('clips '+mode,()=>{const j=judge(clipRows(R,S,M,clips,mode));return {ok:j.failCount===0,...j};});
for(const mode of MODES)check('runtime '+mode,()=>{const j=judge(runtimeRows(GLB,mode));return {ok:j.failCount===0,...j};});
const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/front_curves_773c061e.json'),'utf8'));
for(const clip of ['walk_loop','door_reach'])check('negative: 773c061e '+clip+' front curves must FAIL',()=>{const R2=H.load(GLB),S2=H.sets(R2);H.overrideChannels(R2,{[clip]:fx.clips[clip]});
  const out={};for(const mode of MODES){const j=judge(clipRows(R2,S2,M,[clip],mode));out[mode]=j.failCount;if(!j.failCount)return {ok:false,why:'old curves passed at '+mode,j};}
  const jr=judge(runtimeRows(GLB,30,R3=>H.overrideChannels(R3,{[clip]:fx.clips[clip]})));out.runtime30=jr.failCount;if(!jr.failCount)return {ok:false,why:'old curves passed at runtime',jr};return {ok:true,failCounts:out};});
const failed=results.filter(r=>!r.ok);const rep={gate:'skirt-front-hem-lift',status:failed.length?'FAIL':'PASS',glb:path.relative(H.ROOT,GLB),limits:LIM,results};
if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(rep,null,1));
console.log(JSON.stringify({...rep,results:results.map(r=>({name:r.name,ok:r.ok,frames:r.info&&r.info.frames,failCount:r.info&&r.info.failCount,worst:r.info&&r.info.worst,fails:r.info&&r.info.fails&&r.info.fails.slice(0,4),failCounts:r.info&&r.info.failCounts,error:r.error}))},null,1));
process.exitCode=failed.length?1:0;
