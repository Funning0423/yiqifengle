'use strict';
/* P2 lakeside gate (Grok Bot 2026-10-29): no LK_* node visible to the skycity walk camera before the door.
 * finstart 19bd812a frames 62–116: lease.show(true) at the set-off activated the whole RegionJourney-lakeside rig, so the
 * LakesideJourneyScene (LK_terrain / LK_far_hills at deck height, land fill weight 0) was the walk background (dark green).
 * 1) behavioural: the real lease show/openLake code, driven with fake nodes: after show(true) + after_draw the rig is on, the
 *    lake model is off; it turns on only at openLake (door / touchdown / skip) and stays mounted (no reload) throughout.
 * 2) openLake is called at the door mark (boardIn), touchdown and skip only - never at ride-start.
 * 3) the [QF_P2_SCENE] probe lives in CamTraceLog behind camLog.on; the adapter calls it only inside `if(camLog.on)`. */
const fs=require('fs'),path=require('path');
const S=process.env.P2GATE_SCRIPTS||path.join(__dirname,'../../creator-build-project/assets/scripts/');
const src=fs.readFileSync(path.join(S,'region/RegionJourneyAdapter.ts'),'utf8'),log=fs.readFileSync(path.join(S,'region/CamTraceLog.ts'),'utf8');
let fail=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fail++;};
const grab=re=>{const m=src.match(re);return m?m[0]:null;};
const gate=grab(/let lakeOpen=false;const openLake=\(\)=>\{[^\n]*\};/),show=grab(/const showScene=\(s:number\)=>\{[^\n]*?\};/);
ok(!!gate&&!!show,'gate + showScene found');
if(gate&&show){
 const mk=n=>({name:n,active:true});const rig=mk('RegionJourney-lakeside'),lakeModel=mk('LakesideJourneyScene');rig.active=false;
 const env={dead:false,showSerial:1,shown:false,lakeModel,rig,isValid:()=>true};
 const f=new Function('env',`let {dead,showSerial,shown,lakeModel,rig,isValid}=env;${gate.replace(/^let /,'var ')}${show.replace("(s:number)","(s)")}
  return {showScene,openLake,st:()=>({shown,lakeOpen})};`)(env);
 f.showScene(1);ok(rig.active===true&&lakeModel.active===false,'after set-off show: rig on, LK model off (walk camera sees skycity sky)');
 f.showScene(1);ok(lakeModel.active===false,'re-show before the door keeps LK off');
 f.openLake();ok(lakeModel.active===true,'door: LK model on (same mounted node, no reload)');
 f.showScene(1);ok(lakeModel.active===true,'re-show after the door keeps LK on');}
const rs=src.indexOf("arrivalMark('ride-start')"),line=src.slice(rs,src.indexOf('\n',rs));
ok(rs>0&&!/openLake\(\)/.test(line),'ride-start does not open the lake');
ok(/const boardIn=async\(\)=>\{legClock\.mark\('door'\);openLake\(\);/.test(src),'door mark opens the lake');
ok(/openLake\(\);if\(camLog\.on\)camProbeLake\(null,'landed'\);pub\(R\.T,true\);arrivalMark\('touchdown'/.test(src),'touchdown opens the lake (fallback)');
ok(/arrivalMark\('skip'\);openLake\(\);/.test(src),'skip opens the lake');
ok((src.match(/openLake\(\)/g)||[]).length===3,'openLake called exactly at door/touchdown/skip');
const calls=src.match(/[^\n;{]{0,20}camProbeLake\(/g)||[];ok(calls.length>=1&&calls.every(c=>/if\(camLog\.on\)camProbeLake\($/.test(c)||/import/.test(c)),'adapter calls camProbeLake only inside if(camLog.on)');
ok(/export function camProbeLake\([^)]*\):void\{if\(!camLog\.on\)return;/.test(log)&&/function probeSceneFrame[^\n]*\n if\(!camLog\.on\|\|/.test(log),'probe bodies gated by camLog.on');
ok(!/QF_P2_SCENE/.test(src),'no [QF_P2_SCENE] literal outside CamTraceLog');
if(fail){console.error('p2-lakeside-gate: FAIL '+fail);process.exit(1);}console.log('p2-lakeside-gate: PASS');
