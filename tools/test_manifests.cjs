'use strict';
/** Root manifests vs repo files (GGbot). Fails when a covered file changes without a manifest update.
 *  Scope rule:
 *   - Every git-tracked file under creator-build-project/ (the shipped Cocos project; library/temp/build/etc. are gitignored)
 *     must be listed in exactly one manifest: binary extensions -> assets-MANIFEST-SHA256.json, everything else ->
 *     text-MANIFEST-SHA256.json.
 *   - Entries outside creator-build-project/ (selected tools/ files from the original handoff) are optional: they are not
 *     auto-added, but every listed entry must exist and match.
 *   - Every entry: {path, bytes, sha256}, file exists, bytes and sha256 match. Sorted by path, no duplicates.
 *   - Format: 2-space JSON; assets manifest ends with "\n", text manifest has no trailing newline (original convention).
 *  Usage: node tools/test_manifests.cjs            # check (exit 1 on any mismatch)
 *         node tools/test_manifests.cjs --write    # refresh: rehash all entries, add missing covered files, drop deleted */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert');
process.exitCode=1;
const root=path.resolve(__dirname,'..'),WRITE=process.argv.includes('--write');
const BIN=new Set(['.glb','.gltf.bin','.bin','.png','.jpg','.jpeg','.webp','.gif','.mp3','.wav','.ogg','.m4a','.aac','.ttf','.otf','.astc','.pkm','.ktx','.zip']);
const COVERED='creator-build-project/';
const M={assets:{file:'assets-MANIFEST-SHA256.json',nl:'\n'},text:{file:'text-MANIFEST-SHA256.json',nl:''}};
const kind=p=>BIN.has(path.extname(p).toLowerCase())?'assets':'text';
const entry=p=>{const b=fs.readFileSync(path.join(root,p));return {path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};};
const tracked=new Set(cp.execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean));
const cmp=(a,b)=>a.path<b.path?-1:a.path>b.path?1:0;
const problems=[],stats={};
const seen=new Map();
for(const k of Object.keys(M)){
  const raw=fs.readFileSync(path.join(root,M[k].file),'utf8');const list=JSON.parse(raw);M[k].list=list;M[k].raw=raw;
  for(const e of list){if(seen.has(e.path))problems.push('duplicate '+e.path+' in '+seen.get(e.path)+' and '+k);seen.set(e.path,k);}
}
if(WRITE){
  for(const k of Object.keys(M)){
    const before=new Map(M[k].list.map(e=>[e.path,e]));const out=[];let changed=0,removed=0,added=0;
    for(const e of M[k].list){if(!fs.existsSync(path.join(root,e.path))||!tracked.has(e.path)){removed++;continue;}const n=entry(e.path);if(n.sha256!==e.sha256||n.bytes!==e.bytes)changed++;out.push(n);}
    for(const p of tracked)if(p.startsWith(COVERED)&&kind(p)===k&&!seen.has(p)){out.push(entry(p));added++;}
    out.sort(cmp);fs.writeFileSync(path.join(root,M[k].file),JSON.stringify(out,null,2)+M[k].nl);stats[k]={entries:out.length,changed,added,removed};
  }
  console.log(JSON.stringify({status:'WRITTEN',stats},null,2));process.exitCode=0;return;
}
for(const k of Object.keys(M)){
  const {list,raw,nl,file}=M[k];let ok=0;
  if(raw!==JSON.stringify(list,null,2)+nl)problems.push(file+': format differs from 2-space JSON'+(nl?' + trailing newline':' without trailing newline'));
  for(let i=1;i<list.length;i++)if(cmp(list[i-1],list[i])>=0)problems.push(file+': not sorted at '+list[i].path);
  for(const e of list){
    if(Object.keys(e).join()!=='path,bytes,sha256'){problems.push(file+': bad keys '+e.path);continue;}
    const f=path.join(root,e.path);if(!fs.existsSync(f)){problems.push('missing file (remove entry) '+e.path);continue;}
    if(e.path.startsWith(COVERED)&&kind(e.path)!==k)problems.push('wrong manifest for '+e.path+' (expected '+kind(e.path)+')');
    const n=entry(e.path);if(n.bytes!==e.bytes||n.sha256!==e.sha256){problems.push('stale '+e.path+' manifest '+e.bytes+'/'+e.sha256.slice(0,12)+' actual '+n.bytes+'/'+n.sha256.slice(0,12));continue;}
    ok++;
  }
  stats[k]={entries:list.length,ok};
}
for(const p of tracked)if(p.startsWith(COVERED)&&!seen.has(p))problems.push('not in manifest '+p+' (expected '+kind(p)+')');
const report={status:problems.length?'FAIL':'PASS',scope:'git-tracked creator-build-project/** must be listed; listed tools/ entries must match; fix with: node tools/test_manifests.cjs --write',stats,problems};
console.log(JSON.stringify(report,null,2));
assert.deepStrictEqual(problems,[],problems.length+' manifest problem(s); run node tools/test_manifests.cjs --write and review the diff');
process.exitCode=0;
