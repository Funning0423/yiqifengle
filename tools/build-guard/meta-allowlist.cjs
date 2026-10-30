#!/usr/bin/env node
'use strict';
/** meta-allowlist gate (GGbot, 2026-10-29). Per-field deep diff of every changed .meta against a base commit.
 *  - Base: --base <ref> | env META_ALLOWLIST_BASE | git merge-base HEAD <allowlist.baseRef> (default ggbot/full9c-final).
 *  - Compares the base tree with the working tree (committed + uncommitted), so it also catches importer rewrites.
 *  - Added or deleted .meta: FAIL (unless listed with allowAdd/allowDelete; none are listed).
 *  - Modified .meta: every JSON-pointer change must match an allow rule exactly (op, path, from/to). A "remove" rule
 *    allows only the whole subtree to disappear; edits inside it fail. Any /uuid change fails as UUID_CHANGED.
 *  - A change in any .meta whose base subtree mentions a watchRef (e.g. a material that used the removed texture) is
 *    NEEDS_REVIEW, which fails until Grok Bot reviews it and the allowlist lists it.
 *  - --build-dir <dir>: once the owning .meta has dropped the sub-asset, forbidBuildRefs must not appear (full or compressed uuid form) in any build json or file name.
 *  Usage: node tools/build-guard/meta-allowlist.cjs [--base REF] [--allowlist FILE] [--build-dir DIR] [--root DIR]
 *  Exit 0 = PASS, 1 = FAIL. */
const fs=require('fs'),path=require('path');
const {compressUuid,git,walk}=require('./lib-gates.cjs');
function arg(n,d){const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;}
const esc=k=>String(k).replace(/~/g,'~0').replace(/\//g,'~1');
/** Deep diff -> [{op,path,from,to}]. Objects recurse; arrays and scalars compare as whole values. */
function diff(a,b,p='',out=[]){
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(obj(a)&&obj(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const q=p+'/'+esc(k);
      if(!(k in b))out.push({op:'remove',path:q,from:a[k]});else if(!(k in a))out.push({op:'add',path:q,to:b[k]});else diff(a[k],b[k],q,out);}
    return out;}
  if(JSON.stringify(a)!==JSON.stringify(b))out.push({op:'replace',path:p,from:a,to:b});return out;
}
const get=(o,p)=>p.split('/').slice(1).reduce((v,k)=>v==null?v:v[k.replace(/~1/g,'/').replace(/~0/g,'~')],o);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function matches(r,c){if(r.op!==c.op||r.path!==c.path)return false;if('from' in r&&!same(r.from,c.from))return false;if('to' in r&&!same(r.to,c.to))return false;return true;}
function run(opts){
  const root=path.resolve(opts.root||path.resolve(__dirname,'../..'));
  const al=JSON.parse(fs.readFileSync(opts.allowlist||path.join(__dirname,'meta-allowlist.json'),'utf8'));
  const files=al.files||{},watch=(al.watchRefs||[]).map(w=>w.ref),res={base:null,checked:0,fail:[],review:[],ok:[],info:[]};
  let base=opts.base||process.env.META_ALLOWLIST_BASE;
  if(!base){const ref=al.baseRef||'ggbot/full9c-final';try{base=git(root,['merge-base','HEAD',ref]).trim();}catch(e){res.fail.push(`NO_BASE: cannot resolve merge-base with ${ref}; pass --base`);return res;}}
  res.base=base;
  const ns=git(root,['diff','--name-status','--no-renames','-z',base,'--','*.meta']).split('\0').filter(Boolean);
  const untracked=git(root,['ls-files','--others','--exclude-standard','-z','--','*.meta']).split('\0').filter(Boolean);
  const changes=[];for(let i=0;i<ns.length;i+=2)changes.push([ns[i],ns[i+1]]);for(const u of untracked)changes.push(['A',u]);
  for(const [st,f] of changes){res.checked++;const rule=files[f];
    if(st==='A'){if(rule&&rule.allowAdd)res.ok.push('added '+f);else res.fail.push('META_ADDED '+f);continue;}
    if(st==='D'){if(rule&&rule.allowDelete)res.ok.push('deleted '+f);else res.fail.push('META_DELETED '+f);continue;}
    let a,b;try{a=JSON.parse(git(root,['show',`${base}:${f}`]));b=JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));}catch(e){res.fail.push('META_UNPARSEABLE '+f+': '+e.message);continue;}
    const ch=diff(a,b);if(!ch.length){res.ok.push('format-only '+f);continue;}
    for(const c of ch){
      if(c.path==='/uuid'){res.fail.push(`UUID_CHANGED ${f} ${c.from} -> ${c.to}`);continue;}
      if(rule&&(rule.allow||[]).some(r=>matches(r,c))){res.ok.push(`${f} ${c.op} ${c.path}`);continue;}
      const top=c.path.split('/').slice(0,3).join('/'),baseSub=c.path.startsWith('/subMetas/')?get(a,top):undefined;
      const blob=JSON.stringify([baseSub===undefined?null:baseSub,c.from===undefined?null:c.from,c.to===undefined?null:c.to]);
      const touches=watch.filter(w=>{const [u,sub]=w.split('@');return blob.includes(w)||(sub&&files[f]&&files[f].uuid===u&&blob.includes(sub));});
      if(touches.length)res.review.push(`NEEDS_REVIEW ${f} ${c.op} ${c.path} (references ${touches.join(',')})`);
      else res.fail.push(`NOT_ALLOWED ${f} ${c.op} ${c.path} ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
    }
    if(rule)for(const m of rule.mustEqualIfChanged||[])if(!same(get(b,m.path),m.value))res.fail.push(`MUST_EQUAL ${f} ${m.path} is ${JSON.stringify(get(b,m.path))}, expected ${JSON.stringify(m.value)}`);
  }
  if(opts.buildDir){const d=path.resolve(opts.buildDir);if(!fs.existsSync(d))res.fail.push('BUILD_DIR_MISSING '+d);else{
    const needles=[];for(const r of al.forbidBuildRefs||[]){const [u,sub]=r.split('@');
      // Enforced once the owning .meta no longer has the sub-asset (plan D applied); before that it is only reported.
      const owner=Object.keys(files).find(k=>files[k].uuid===u);let still=false;
      if(owner){try{still=!!get(JSON.parse(fs.readFileSync(path.join(root,owner),'utf8')),'/subMetas/'+sub);}catch(e){still=false;}}
      if(still){res.info.push(`BUILD_REF_PENDING ${r}: ${owner} still has /subMetas/${sub}, build check starts after the Mac re-import`);continue;}
      needles.push(r,compressUuid(u)+'@'+sub);}
    for(const p of walk(d,()=>true)){const rel=path.relative(d,p);for(const n of needles)if(rel.includes(n))res.fail.push(`BUILD_REF ${rel} (file name has ${n})`);
      if(/\.json$/.test(p)){const t=fs.readFileSync(p,'utf8');for(const n of needles)if(t.includes(n))res.fail.push(`BUILD_REF ${rel} contains ${n}`);}}
    res.buildDir=d;}}
  return res;
}
module.exports={run,diff};
if(require.main===module){
  const r=run({base:arg('--base'),allowlist:arg('--allowlist'),buildDir:arg('--build-dir'),root:arg('--root')});
  for(const l of r.info)console.log('INFO '+l);for(const l of r.fail)console.log('FAIL '+l);for(const l of r.review)console.log('FAIL '+l);
  const pass=!r.fail.length&&!r.review.length;
  console.log(`${pass?'PASS':'FAIL'} meta-allowlist base=${r.base} metasChanged=${r.checked} allowedChanges=${r.ok.length} fails=${r.fail.length} needsReview=${r.review.length}${r.buildDir?' buildDir='+r.buildDir:''}`);
  process.exit(pass?0:1);
}
