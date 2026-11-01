#!/usr/bin/env node
'use strict';
/** journal r6 device-preview flavour (Funning's phone check). Text transform on a STAGED copy only (refuses a git worktree):
 *  flips the single `/*QF_PREVIEW_FLAG*\/false` in assets/scripts/world-r2/PreTransitionKeys.ts to true. The flag and everything it
 *  turns on (qfPre default journal-sky-gated, journey-book day/night button) live inside QF_PROBE regions, so any STRIP_PROBES=1
 *  build (trial or FORMAL_RELEASE=1) removes them; release-gates --probe-free proves it on the output.
 *  Usage: node preview-flavor.cjs --stage <copyOfCreatorProject>     |    --check <buildDir>  (preview output carries the flag = true) */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const REL='assets/scripts/world-r2/PreTransitionKeys.ts',OFF='/*QF_PREVIEW_FLAG*/false',ON='/*QF_PREVIEW_FLAG*/true';
function isRepoWorktree(dir){try{return !!cp.execFileSync('git',['rev-parse','--show-toplevel'],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return false;}}
function flip(text){const n=text.split(OFF).length-1;if(n!==1||text.includes(ON))throw Error('expected exactly one '+OFF+' (found '+n+')');return text.replace(OFF,ON);}
function stage(dir){if(isRepoWorktree(dir))throw Error('refusing to flip the preview flag inside a git worktree: '+dir+' (stage a copy first)');
  const p=path.join(dir,REL);fs.writeFileSync(p,flip(fs.readFileSync(p,'utf8')));return p;}
function walk(d,r=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,r);else r.push(p);}return r;}
/** J7 (204e4d83 preview build FAILED "flag not in the output"): Cocos emits a module's `export const` through the SystemJS
 *  exporter, e.g. `t("QF_DEVICE_PREVIEW",!0)` (same shape as `t("AMBIENCE_BED_REF",.4)` / `a("SEA_REVEAL_DEFAULT",!1)` in a real
 *  subpackages/main/game.js); the old scan only knew `QF_DEVICE_PREVIEW=true|!0`. The exported NAME is a string (module API, read
 *  by IslandJourneyOverlay's import), so the minifier cannot rename it. Accepts either shape; PASS only when at least one
 *  definition is true/!0 and none is false/!1 (missing, false, !1 or any other value → FAIL). */
const FLAG_DEF=/(?:\bQF_DEVICE_PREVIEW\s*=\s*|["']QF_DEVICE_PREVIEW["']\s*,\s*)(true|false|!0|!1)(?![\w$])/g;
function flagDefs(text){const out=[];let m;FLAG_DEF.lastIndex=0;while((m=FLAG_DEF.exec(text)))out.push(m[1]==='true'||m[1]==='!0');return out;}
function check(dir){const on=[],off=[];for(const f of walk(dir)){if(!/\.js$/.test(f))continue;const d=flagDefs(fs.readFileSync(f,'utf8'));
  if(d.some(v=>!v))off.push(path.relative(dir,f));else if(d.length)on.push(path.relative(dir,f));}
  return off.length?[]:on;}
module.exports={flip,stage,check,flagDefs,OFF,ON,REL};
if(require.main===module){const a=process.argv.slice(2);try{
  if(a[0]==='--stage'){console.log('PASS preview-flavor stage '+stage(path.resolve(a[1])));}
  else if(a[0]==='--check'){const h=check(path.resolve(a[1]));console.log(`${h.length?'PASS':'FAIL'} preview-flavor check files=${h.join(',')||'-'}`);process.exit(h.length?0:1);}
  else{console.error('usage: --stage DIR | --check BUILD_DIR');process.exit(2);}}catch(e){console.log('FAIL '+e.message);process.exit(1);}}
