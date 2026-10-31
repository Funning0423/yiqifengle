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
/** compiled output keeps the identifier; the minifier may write true as !0 */
function check(dir){const hits=walk(dir).filter(f=>/\.js$/.test(f)&&/QF_DEVICE_PREVIEW\s*=\s*(?:true|!0)/.test(fs.readFileSync(f,'utf8')));return hits.map(f=>path.relative(dir,f));}
module.exports={flip,stage,check,OFF,ON,REL};
if(require.main===module){const a=process.argv.slice(2);try{
  if(a[0]==='--stage'){console.log('PASS preview-flavor stage '+stage(path.resolve(a[1])));}
  else if(a[0]==='--check'){const h=check(path.resolve(a[1]));console.log(`${h.length?'PASS':'FAIL'} preview-flavor check files=${h.join(',')||'-'}`);process.exit(h.length?0:1);}
  else{console.error('usage: --stage DIR | --check BUILD_DIR');process.exit(2);}}catch(e){console.log('FAIL '+e.message);process.exit(1);}}
