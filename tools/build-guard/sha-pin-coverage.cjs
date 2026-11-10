#!/usr/bin/env node
'use strict';
/** sha-pin-coverage gate (GGbot, 2026-10-29, Grok Bot rule "no pins that nothing checks").
 *  Scans git-tracked creator-build-project/assets/scripts/** and tools/** (.ts .js .cjs .mjs .json .py .sh; not reports dirs) for
 *  sha-pin fields: a key ending in sha256/SHA256/Sha256/sha bound to a 64-hex string literal (`key: "…"`, `"key": "…"`, `KEY = '…'`).
 *  Every (file, key) found must be listed in tools/build-guard/sha-pin-registry.json (explicit, no globs), with the exact count:
 *   - kind "verified": checkedBy = a run-suite check id; the check's file (or one of `via`, e.g. the bake it spawns with --check)
 *     must exist and mention the pinned file's basename. kind "embedded": must be listed in frozen-production-inputs.json
 *     embeddedPins (frozen-inputs-pins hashes the target).
 *   - kind "record": a historical before/after hash in an evidence/scope record, not a pin of a current file (reason required).
 *   - kind "unchecked": known debt awaiting a verifying check; its values are frozen by valuesSha256 so they cannot change
 *     silently, and every one is printed as UNCHECKED. Exit 0 only if nothing is unregistered/stale/miscounted/changed.
 *  Usage: node tools/build-guard/sha-pin-coverage.cjs [--root DIR] [--registry FILE] [--strict]   (--strict: debt also fails)
 *  Root: --root | REPO_ROOT | git rev-parse --show-toplevel (cwd). Not the script directory. Zero scanned files is NO_TARGETS. */
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const {repoRoot}=require('./lib-gates.cjs');
const arg=(n,d)=>{const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;};
const RE=/["']?([A-Za-z0-9_]*(?:sha256|Sha256|SHA256|sha))["']?\s*[:=]\s*["']([0-9a-f]{64})["']/g;
const EXT=/\.(ts|js|cjs|mjs|json|py|sh)$/;
const vhash=vals=>crypto.createHash('sha256').update(vals.join('\n')).digest('hex');
function scan(root){const ls=cp.execFileSync('git',['ls-files','-z','--','creator-build-project/assets/scripts','tools'],{cwd:root,encoding:'utf8',maxBuffer:1<<26}).split('\0').filter(f=>f&&EXT.test(f)&&!/(^|\/)reports\//.test(f)&&f!=='tools/build-guard/sha-pin-registry.json');
  const found={};let scanned=0;for(const f of ls){const p=path.join(root,f);if(!fs.existsSync(p))continue;scanned++;const t=fs.readFileSync(p,'utf8');let m;RE.lastIndex=0;
    while((m=RE.exec(t))){const k=f+'#'+m[1];(found[k]=found[k]||{file:f,key:m[1],values:[]}).values.push(m[2]);}}
  return {found,scanned};}
function run(o={}){
  const root=repoRoot(o.root),reg=JSON.parse(fs.readFileSync(o.registry||path.join(__dirname,'sha-pin-registry.json'),'utf8'));
  const res={fail:[],debt:[],ok:0,found:0,scanned:0};const scanned=scan(root);const found=scanned.found;res.scanned=scanned.scanned;res.found=Object.keys(found).length;
  if(!res.scanned)res.fail.push('NO_TARGETS: sha-pin-coverage scanned 0 files');
  const entries={};for(const e of reg.pins){const k=e.file+'#'+e.key;if(entries[k])res.fail.push('DUP_REGISTRY '+k);entries[k]=e;}
  let suite='';try{suite=fs.readFileSync(path.join(root,'tools/journey-integration/run-suite.cjs'),'utf8');}catch(e){}
  let emb=[];try{emb=JSON.parse(fs.readFileSync(path.join(root,'tools/journey-integration/frozen-production-inputs.json'),'utf8')).embeddedPins||[];}catch(e){}
  for(const [k,f] of Object.entries(found)){const e=entries[k];
    if(!e){res.fail.push(`UNREGISTERED ${f.file} ${f.key} x${f.values.length} (add a verifying check, then a registry entry)`);continue;}
    if(e.count!==f.values.length){res.fail.push(`COUNT ${k} registry ${e.count} found ${f.values.length}`);continue;}
    if(e.kind==='verified'){const m=suite.match(new RegExp("\\['"+e.checkedBy+"','([^']+)'\\]"));
      if(!m){res.fail.push(`NOT_IN_SUITE ${k} checkedBy ${e.checkedBy}`);continue;}
      const files=[m[1],...(e.via||[])],base=path.basename(e.pinnedFile||e.file).replace(EXT,'');
      if(!files.some(x=>fs.existsSync(path.join(root,x))&&fs.readFileSync(path.join(root,x),'utf8').includes(base))){res.fail.push(`CHECK_DOES_NOT_READ ${k}: ${files.join(',')} never mention ${base}`);continue;}
      res.ok++;}
    else if(e.kind==='embedded'){if(!emb.some(x=>x.source===e.file&&x.key===e.key)){res.fail.push(`EMBEDDED_NOT_PINNED ${k}`);continue;}res.ok++;}
    else if(e.kind==='record'){if(!e.reason){res.fail.push('RECORD_NO_REASON '+k);continue;}res.ok++;}
    else if(e.kind==='unchecked'){if(e.valuesSha256!==vhash(f.values)){res.fail.push(`DEBT_PIN_CHANGED ${k}: an unchecked pin changed; give it a verifying check first`);continue;}res.debt.push(`UNCHECKED ${f.file} ${f.key} x${f.values.length}${e.note?' ('+e.note+')':''}`);}
    else res.fail.push('BAD_KIND '+k+' '+e.kind);}
  for(const k of Object.keys(entries))if(!found[k])res.fail.push('STALE_REGISTRY '+k+' (pin gone; remove the entry)');
  return res;}
module.exports={run,scan,vhash};
if(require.main===module){let r;try{r=run({root:arg('--root'),registry:arg('--registry')});}catch(e){if(e.code==='NO_ROOT'){console.error(e.message);process.exit(1);}throw e;}
  const strict=process.argv.includes('--strict');
  for(const l of r.fail)console.log('FAIL '+l);for(const l of r.debt)console.log(l);
  const pass=!r.fail.length&&!(strict&&r.debt.length);
  console.log(`${pass?'PASS':'FAIL'} sha-pin-coverage pins=${r.found} covered=${r.ok} unchecked=${r.debt.length} fails=${r.fail.length}${strict?' strict':''}`);process.exit(pass?0:1);}
