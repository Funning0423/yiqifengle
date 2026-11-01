'use strict';
/** Gate skirt-front-hem-lift (b21, 运镜bot; thresholds approved by Grok Bot 2026-10-31):
 *   dress front-hem lowest point: lift <= 3.0 cm vs rest AND always >= 4.5 cm below the knee; apron hem lift <= 3.0 cm;
 *   forward flare <= 28 cm; any single hem vertex lift <= 5 cm.  Seated clips (sit_down, sit_hold, stand_up) only while the thigh
 *   is within 30 deg of vertical.  Every clip x 60 fps, 30 fps, uneven dt (LCG [1/90,1/45]) sampled directly, AND the real
 *   CharacterMotion/AnimRig runtime (crossfades + wind_flutter layer + morph weights, runtime_eval.cjs) at the same three rates.
 *   Strict seated (Grok Bot 2026-10-31, after approving the c40de312 look): the strict limits apply to EVERY clip incl. sit_down /
 *   sit_hold / stand_up and to EVERY runtime frame incl. the boat/balloon 'ride' seated segment (sit_hold->stand_up crossfade).
 *   No ratchet / exemption.  fixtures/seated_baseline_773c061e.json is kept only as a negative.
 *   Negatives: the 773c061e front curves of walk_loop and door_reach (fixtures/front_curves_773c061e.json) must FAIL; the 773c061e
 *   stand_up curves + morph state (fixtures/stand_up_773c061e.json, seat_fix_* muted) must FAIL strict; the registered 773c061e
 *   seated values must FAIL strict; sit_down with the front panel pitched 5 deg further up must FAIL strict.
 *   --write-baseline (run on the 773c061e GLB only) registers the lift items.
 *   node tools/skirt-hem/test_skirt_front_hem_lift.cjs [--glb path] [--json out]   (QF_TYPESCRIPT_MODULE for the runtime path) */
const fs=require('fs'),path=require('path'),H=require('./hem_lib.cjs'),RT=require('./runtime_eval.cjs'),SR=require('./seated_ratchet.cjs');
const args=process.argv.slice(2),arg=(n,d)=>args.includes(n)?args[args.indexOf(n)+1]:d;const GLB=path.resolve(arg('--glb',H.GLB));
const LIM={lift:0.030,belowKnee:0.045,apron:0.030,flare:0.28,vert:0.05};const SEATED=/^(sit_down|sit_hold|stand_up)$/;const MODES=[60,30,'uneven'];
function judge(rows){const w={lift:null,belowKnee:null,apron:null,flare:null,vert:null};let n=0;const fails=[];
  for(const r of rows){if(r.skip)continue;n++;const v={lift:r.dress.lift,belowKnee:r.dress.belowKnee,apron:r.apron.lift,flare:Math.max(r.dress.flare,r.apron.flare),vert:Math.max(r.dress.maxVertLift,r.apron.maxVertLift)};
    for(const k in v){const worse=k==='belowKnee'?(w[k]===null||v[k]<w[k].v):(w[k]===null||v[k]>w[k].v);if(worse)w[k]={v:+v[k].toFixed(4),at:r.at};}
    for(const k in v){const bad=k==='belowKnee'?v[k]<LIM[k]:v[k]>LIM[k];if(bad)fails.push({k,v:+v[k].toFixed(4),at:r.at});}}
  return {frames:n,worst:w,failCount:fails.length,fails:fails.slice(0,12)};}
function clipRows(R,S,M,clips,mode){const rows=[];for(const clip of clips)for(const t of H.times(R.clips[clip].duration,mode,clip.length*31+7)){H.applyClip(R,clip,t);const m=H.hemMetrics(R,S,H.clipMorph(M,clip,t));
  rows.push({at:clip+'@'+t.toFixed(4)+'/'+mode,skip:SEATED.test(clip)&&m.thighDeg>30,dress:m.dress,apron:m.apron});}return rows;}
const runtimeRows=(glb,mode,patch)=>SR.markRuntime(RT.run(glb,mode,{penetration:false,patch})).map(r=>({ratchet:r.ratchet&&r.seatedRow,at:r.scenario+'@'+r.T.toFixed(3)+' '+r.clip+(r.out?'<'+r.out+':'+r.fade.toFixed(2):'')+'/'+mode,skip:r.seatedSkip,dress:r.dress,apron:r.apron}));
const results=[];const check=(name,fn)=>{try{const info=fn();results.push({name,ok:info.ok,info});}catch(e){results.push({name,ok:false,error:String(e&&e.stack||e)});}};
const R=H.load(GLB),S=H.sets(R),M=H.loadMeta(path.join(path.dirname(GLB),'anim_meta.json'));const clips=Object.keys(R.clips).filter(c=>!/wind_flutter/.test(c));
const strictClips=clips.filter(c=>!SR.SEATED.test(c)),seatClips=clips.filter(c=>SR.SEATED.test(c));
const liftItems=(R0,S0,mode,rtRows)=>{const o={};for(const c of seatClips)o[SR.itemOf('clip',c,mode)]=SR.liftAgg(clipRows(R0,S0,M,[c],mode));if(rtRows)o[SR.itemOf('runtime','ride-seated',mode)]=SR.liftAgg(rtRows.filter(r=>r.ratchet));return o;};
if(args.includes('--write-baseline')){const B=fs.existsSync(SR.BASE)?SR.loadBase():{};B.source='773c061e '+path.basename(GLB);B.note='pre-existing seated issues from 773c061e, not introduced by the front-hem re-bake';B.lift={};
  for(const mode of MODES)Object.assign(B.lift,liftItems(R,S,mode,runtimeRows(GLB,mode)));fs.writeFileSync(SR.BASE,JSON.stringify(B,null,1)+'\n');console.log('baseline lift items',Object.keys(B.lift).length);process.exit(0);}
const BASE=SR.loadBase();
for(const mode of MODES)check('strict clips '+mode,()=>{const j=judge(clipRows(R,S,M,strictClips,mode));return {ok:j.failCount===0,...j};});
const rtCache={};for(const mode of MODES)check('strict runtime '+mode,()=>{const rows=rtCache[mode]=runtimeRows(GLB,mode);const j=judge(rows);return {ok:j.failCount===0,...j};});
const seatRows=(mode,rt)=>clipRows(R,S,M,seatClips,mode).concat(rt.filter(r=>r.ratchet));
for(const mode of MODES)check('strict seated '+mode+' (sit_down/sit_hold/stand_up clips + ride-seated runtime)',()=>{const j=judge(seatRows(mode,rtCache[mode]||runtimeRows(GLB,mode)));return {ok:j.failCount===0,items:liftItems(R,S,mode,rtCache[mode]),...j};});
const strictFail=v=>v&&v.frames>0&&(v.lift>LIM.lift||v.belowKnee<LIM.belowKnee||v.apron>LIM.apron||v.flare>LIM.flare||v.vert>LIM.vert);
check('negative: registered 773c061e seated values (stand_up + ride-seated, every dt) must FAIL strict',()=>{const bad=[];for(const mode of MODES)for(const it of [SR.itemOf('clip','stand_up',mode),SR.itemOf('runtime','ride-seated',mode)])if(!strictFail(BASE.lift[it]))bad.push(it);return {ok:bad.length===0,passedStrict:bad};});
check('negative: 773c061e stand_up curves + morph state must FAIL strict',()=>{const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/stand_up_773c061e.json'),'utf8'));const R2=H.load(GLB),S2=H.sets(R2);
  const M773=JSON.parse(JSON.stringify(M));for(const c in M773.clips){const cv=M773.clips[c].morph&&M773.clips[c].morph.curves;if(cv)for(const k of Object.keys(cv))if(/^seat_fix_/.test(k))delete cv[k];}
  H.overrideChannels(R2,fx.clips);const out={};for(const mode of MODES){const j=judge(clipRows(R2,S2,M773,['stand_up'],mode));out[mode]=j.failCount;if(!j.failCount)return {ok:false,why:'773 stand_up passed at '+mode,j};}return {ok:true,failCounts:out};});
const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/front_curves_773c061e.json'),'utf8'));
for(const clip of ['walk_loop','door_reach'])check('negative: 773c061e '+clip+' front curves must FAIL',()=>{const R2=H.load(GLB),S2=H.sets(R2);H.overrideChannels(R2,{[clip]:fx.clips[clip]});
  const out={};for(const mode of MODES){const j=judge(clipRows(R2,S2,M,[clip],mode));out[mode]=j.failCount;if(!j.failCount)return {ok:false,why:'old curves passed at '+mode,j};}
  const jr=judge(runtimeRows(GLB,30,R3=>{H.overrideChannels(R3,{[clip]:fx.clips[clip]});}));out.runtime30=jr.failCount;if(!jr.failCount)return {ok:false,why:'old curves passed at runtime',jr};return {ok:true,failCounts:out};});
check('negative: sit_down front panel pitched 5 deg further up must FAIL strict',()=>{const R2=H.load(GLB),S2=H.sets(R2);const i=R2.byName['skirt.front'];const C=R2.clips.sit_down;const c=C.channels.find(x=>x.path==='rotation'&&x.node===i);
  const h=5*Math.PI/360,d=[-Math.sin(h),0,0,Math.cos(h)];if(c){for(let k=0;k<c.out.length;k+=4){const q=H.qmul(d,Array.from(c.out.slice(k,k+4)));c.out.set(q,k);}}else{const q=H.qmul(d,R2.rest[i].q);C.channels.push({node:i,path:'rotation',inp:Float64Array.from([0,C.duration]),out:Float64Array.from([...q,...q]),n:4,step:false});}
  const out={};for(const mode of [30,60]){const j=judge(clipRows(R2,S2,M,['sit_down'],mode));out[mode]=j.failCount;if(!j.failCount)return {ok:false,why:'worsened pose passed strict at '+mode,j};}return {ok:true,failCounts:out};});
const failed=results.filter(r=>!r.ok);const rep={gate:'skirt-front-hem-lift',status:failed.length?'FAIL':'PASS',glb:path.relative(H.ROOT,GLB),limits:LIM,results};
if(arg('--json'))fs.writeFileSync(arg('--json'),JSON.stringify(rep,null,1));
console.log(JSON.stringify({...rep,results:results.map(r=>({name:r.name,ok:r.ok,frames:r.info&&r.info.frames,failCount:r.info&&r.info.failCount,worst:r.info&&r.info.worst,fails:r.info&&r.info.fails&&r.info.fails.slice(0,4),failCounts:r.info&&r.info.failCounts,regressions:r.info&&r.info.regressions,items:r.info&&r.info.items,error:r.error}))},null,1));
process.exitCode=failed.length?1:0;
