'use strict';
/** Seated ratchet (b21, 运镜bot; Grok Bot option C, 2026-10-31).
 *  NOTE: sit_down, sit_hold, stand_up and the boat/balloon runtime segment from sit_down to the end of the 'ride' scenario
 *  (stand_up -> walk_start -> walk_loop -> walk_stop_bodyL crossfade) carry PRE-EXISTING seated skirt issues from 773c061e
 *  (thigh through the back/right panels while seated, shin behind the front panel early in sit_down, front hem flip near the end of
 *  stand_up).  They were NOT introduced by the front-hem re-bake; the seated fix is separate follow-up work (option A).
 *  Lift items use only the runtime frames of that segment that involve a seated clip (base or crossfade source); the walk-off
 *  frames stay on the strict lift limits.  Penetration items use the whole segment.
 *  Until then these items may not get worse than the 773c061e values registered in fixtures/seated_baseline_773c061e.json:
 *  per item and dt mode - lift, below-knee, apron, flare, max single vertex (thigh <= 30 deg rows only) and penetration hit count +
 *  max depth per cloth panel.  Everything else stays on the strict limits. */
const fs=require('fs'),path=require('path');
const SEATED=/^(sit_down|sit_hold|stand_up)$/;const BASE=path.join(__dirname,'fixtures/seated_baseline_773c061e.json');
const EPS=1e-5;
/** marks runtime rows of the ratchet segment: scenario 'ride' from its first sit_down frame on */
function markRuntime(rows){const on={};for(const r of rows){if(r.scenario==='ride'&&(r.clip==='sit_down'||r.out==='sit_down'))on[r.scenario+'/'+r.mode]=true;r.ratchet=!!on[r.scenario+'/'+r.mode];r.seatedRow=SEATED.test(r.clip)||!!(r.out&&SEATED.test(r.out));}return rows;}
const itemOf=(kind,name,mode)=>kind+':'+name+'/'+mode;
/** lift metrics of non-skipped rows -> {lift,belowKnee,apron,flare,vert} worst */
function liftAgg(rows){const o={frames:0};for(const r of rows){if(r.skip)continue;o.frames++;const v={lift:r.dress.lift,belowKnee:r.dress.belowKnee,apron:r.apron.lift,flare:Math.max(r.dress.flare,r.apron.flare),vert:Math.max(r.dress.maxVertLift,r.apron.maxVertLift)};
  for(const k in v){if(o[k]===undefined)o[k]=v[k];else o[k]=k==='belowKnee'?Math.min(o[k],v[k]):Math.max(o[k],v[k]);}}for(const k in o)if(k!=='frames')o[k]=+o[k].toFixed(5);return o;}
/** skirt.front.low and skirt.front.low.mid are ONE physical panel: the re-bake only split its skin weights between the two joints
 *  (low.mid is identity in the seated clips), which moves hit attribution but not the cloth - they are one region here. */
const panelKey=k=>k.replace('skirt.front.low.mid','skirt.front.low');
function penAgg(rows){const o={frames:rows.length,hits:0,panels:{}};for(const r of rows){if(!r.pen||!r.pen.count)continue;o.hits+=r.pen.count;for(const [k0,e] of Object.entries(r.pen.panels||{})){const k=panelKey(k0);const p=o.panels[k]||(o.panels[k]={n:0,maxCm:0});p.n+=e.n;p.maxCm=Math.max(p.maxCm,+(e.max*100).toFixed(3));}}return o;}
function loadBase(){return JSON.parse(fs.readFileSync(BASE,'utf8'));}
/** compare current aggregates with baseline; returns list of regressions */
function compareLift(item,cur,base){const out=[];if(!base)return [{item,why:'no baseline registered'}];for(const k of ['lift','apron','flare','vert','belowKnee']){if(cur[k]===undefined)continue;if(base[k]===undefined){out.push({item,k,cur:cur[k],why:'metric not in baseline'});continue;}
  const worse=k==='belowKnee'?cur[k]<base[k]-EPS:cur[k]>base[k]+EPS;if(worse)out.push({item,k,cur:cur[k],base:base[k]});}return out;}
function comparePen(item,cur,base){const out=[];if(!base)return [{item,why:'no baseline registered'}];if(cur.hits>base.hits)out.push({item,k:'hits',cur:cur.hits,base:base.hits});
  for(const [p,e] of Object.entries(cur.panels)){const b=base.panels[p];if(!b){out.push({item,k:'panel '+p,cur:e,base:null});continue;}if(e.maxCm>b.maxCm+0.001)out.push({item,k:'depth '+p,cur:e.maxCm,base:b.maxCm});if(e.n>b.n)out.push({item,k:'hits '+p,cur:e.n,base:b.n});}return out;}
module.exports={SEATED,BASE,markRuntime,itemOf,liftAgg,penAgg,loadBase,compareLift,comparePen};
