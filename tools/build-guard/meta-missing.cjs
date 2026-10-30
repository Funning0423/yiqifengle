#!/usr/bin/env node
'use strict';
/** meta-missing gate (GGbot 2026-10-30, Grok Bot: widen the meta guard to bundles/**). Every git-tracked asset file under
 *  creator-build-project/assets/bundles/** and every directory on its path (below assets/bundles/<b>) needs its Creator .meta
 *  (path + '.meta'), except paths listed EXACTLY (one per line, no wildcards, '#' comments) in meta-pending-creator.txt —
 *  the metas Creator still has to generate on the Mac (MAC_STEPS). Stale list = FAIL: a pending entry that already has a .meta,
 *  that is not a tracked file/dir, or that contains a wildcard. The list must be empty after the Mac step. Exit 0 PASS / 1 FAIL. */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
function run(root){root=root||path.resolve(__dirname,'../..');const P='creator-build-project/assets/bundles/';
 const files=execFileSync('git',['-C',root,'ls-files','-z','--',P],{encoding:'utf8',maxBuffer:1<<28}).split('\0').filter(Boolean);
 const tracked=new Set(files),need=new Set();
 for(const f of files){if(f.endsWith('.meta'))continue;need.add(f);let d=path.posix.dirname(f);while(d.startsWith(P)&&d.length>P.length){need.add(d);d=path.posix.dirname(d);}}
 const listPath=path.join(__dirname,'meta-pending-creator.txt'),pending=new Set(),fail=[];
 const raw=fs.existsSync(listPath)?fs.readFileSync(listPath,'utf8').split('\n').map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')):[];
 for(const p of raw){if(/[*?\[\]]/.test(p)){fail.push('PENDING_WILDCARD '+p);continue;}if(pending.has(p)){fail.push('PENDING_DUPLICATE '+p);continue;}pending.add(p);
  if(!need.has(p))fail.push('PENDING_NOT_AN_ASSET '+p);else if(tracked.has(p+'.meta')||fs.existsSync(path.join(root,p+'.meta')))fail.push('PENDING_STALE (meta exists, remove from list) '+p);}
 let missing=0;for(const n of need){if(tracked.has(n+'.meta'))continue;if(pending.has(n)){missing++;continue;}fail.push('META_MISSING '+n);}
 return {checked:need.size,pending:pending.size,pendingMissing:missing,fail};}
module.exports={run};
if(require.main===module){const r=run(process.argv[2]);for(const l of r.fail)console.log('FAIL '+l);
 console.log(`${r.fail.length?'FAIL':'PASS'} meta-missing bundles/** checked=${r.checked} pendingCreator=${r.pending} fails=${r.fail.length}`);process.exit(r.fail.length?1:0);}
