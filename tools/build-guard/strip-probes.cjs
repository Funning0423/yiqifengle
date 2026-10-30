#!/usr/bin/env node
'use strict';
/** Release probe strip (GGbot, full9c). Removes every /*QF_PROBE_BEGIN*\/ … /*QF_PROBE_END*\/ region (markers included) from
 *  .ts/.js under <dir>/assets. Deterministic, text only: no file is created, removed or renamed, so no .meta is touched.
 *  Refuses to run on a git worktree of the repo (the transform only ever runs on a staged copy).
 *  Usage:
 *    node strip-probes.cjs --stage <copyOfCreatorProject>           strip in place (staged copy only)
 *    node strip-probes.cjs --prove <origProject> <strippedProject> [--diff out.diff]
 *        proves: same file set; every file == strip(original); text outside marked regions byte-identical. Exit 1 on any gap. */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const BEGIN='/*QF_PROBE_BEGIN*/',END='/*QF_PROBE_END*/';
function stripText(t,name='?'){let out='',i=0;const regions=[];
  for(;;){const b=t.indexOf(BEGIN,i),e=t.indexOf(END,i);
    if(b<0){if(e>=0)throw Error(`${name}: ${END} without ${BEGIN} at ${e}`);out+=t.slice(i);break;}
    if(e>=0&&e<b)throw Error(`${name}: ${END} before ${BEGIN} at ${e}`);
    const e2=t.indexOf(END,b+BEGIN.length);if(e2<0)throw Error(`${name}: unclosed ${BEGIN} at ${b}`);
    const nb=t.indexOf(BEGIN,b+BEGIN.length);if(nb>=0&&nb<e2)throw Error(`${name}: nested ${BEGIN} at ${nb}`);
    out+=t.slice(i,b);regions.push([b,e2+END.length]);i=e2+END.length;}
  return {out,regions};}
const isSrc=f=>/\.(ts|js|mjs|cjs)$/.test(f)&&!f.endsWith('.d.ts');
function files(root){const r=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else r.push(path.relative(root,p));}})(root);return r.sort();}
function isRepoWorktree(dir){try{const top=cp.execFileSync('git',['rev-parse','--show-toplevel'],{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();return !!top;}catch{return false;}}
function stage(dir){const a=path.join(dir,'assets');if(!fs.existsSync(a))throw Error('no assets/ under '+dir);
  if(isRepoWorktree(dir))throw Error('refusing to strip inside a git worktree: '+dir+' (stage a copy first)');
  let nf=0,nr=0;for(const f of files(a)){if(!isSrc(f))continue;const p=path.join(a,f),t=fs.readFileSync(p,'utf8');if(!t.includes(BEGIN)&&!t.includes(END))continue;
    const {out,regions}=stripText(t,f);fs.writeFileSync(p,out);nf++;nr+=regions.length;console.log(`stripped ${f}: ${regions.length} region(s), ${t.length}->${out.length} chars`);}
  return {files:nf,regions:nr};}
function prove(orig,strip,diffOut){const A=files(orig).filter(f=>!/^(library|temp|build|local|profiles)\//.test(f)),B=files(strip).filter(f=>!/^(library|temp|build|local|profiles)\//.test(f));const bad=[];
  if(JSON.stringify(A)!==JSON.stringify(B))bad.push('FILE_SET_DIFFERS: only-orig='+A.filter(x=>!B.includes(x)).slice(0,5)+' only-stripped='+B.filter(x=>!A.includes(x)).slice(0,5));
  let changed=0,regions=0;
  for(const f of A){if(!B.includes(f))continue;const x=fs.readFileSync(path.join(orig,f)),y=fs.readFileSync(path.join(strip,f));if(x.equals(y))continue;
    if(!isSrc(f)){bad.push('NON_SOURCE_CHANGED '+f);continue;}
    const {out,regions:r}=stripText(x.toString('utf8'),f);if(out!==y.toString('utf8'))bad.push('NOT_EQUAL_TO_STRIP '+f);changed++;regions+=r.length;}
  for(const f of B)if(isSrc(f)){const t=fs.readFileSync(path.join(strip,f),'utf8');if(t.includes(BEGIN)||t.includes(END))bad.push('MARKER_LEFT '+f);}
  if(diffOut){const r=cp.spawnSync('git',['diff','--no-index','--no-color',orig,strip],{encoding:'utf8',maxBuffer:64<<20});fs.writeFileSync(diffOut,r.stdout);}
  return {changed,regions,bad};}
module.exports={stripText,stage,prove,BEGIN,END};
if(require.main===module){const a=process.argv.slice(2);
  try{if(a[0]==='--stage'){const r=stage(path.resolve(a[1]));console.log(`PASS strip-probes stage files=${r.files} regions=${r.regions}`);}
  else if(a[0]==='--prove'){const di=a.indexOf('--diff');const r=prove(path.resolve(a[1]),path.resolve(a[2]),di>0?path.resolve(a[di+1]):null);for(const b of r.bad)console.log('FAIL '+b);console.log(`${r.bad.length?'FAIL':'PASS'} strip-probes prove changedFiles=${r.changed} regions=${r.regions}`);process.exit(r.bad.length?1:0);}
  else{console.error('usage: --stage DIR | --prove ORIG STRIPPED [--diff FILE]');process.exit(2);}}catch(e){console.log('FAIL '+e.message);process.exit(1);}}
