#!/usr/bin/env node
// Gate: every tracked file and folder under creator-build-project/assets/** has a tracked .meta (so Creator never
// generates one on import; e318bdd2 lost 9 via revert 3a4454d7 -> build-guard stage-meta:9-changed).
// Exceptions: none (the repo documents no convention for meta-less assets). Usage: [--rev <sha>] | --selftest
const cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),A='creator-build-project/assets';
function missing(files){const set=new Set(files),dirs=new Set(),out=[];
  for(const f of files){if(f.endsWith('.meta'))continue;if(!set.has(f+'.meta'))out.push(f+'.meta');
    let d=path.posix.dirname(f);while(d.startsWith(A+'/')){dirs.add(d);d=path.posix.dirname(d);}}
  for(const d of dirs)if(!set.has(d+'.meta'))out.push(d+'.meta');return out.sort();}
function list(cwd,rev){const a=rev?['ls-tree','-r','--name-only','-z',rev,'--',A]:['ls-files','-z','--',A];
  return cp.execFileSync('git',a,{cwd,maxBuffer:1<<28}).toString().split('\0').filter(Boolean);}
const argv=process.argv.slice(2);
if(argv[0]==='--selftest'){
  const files=list(ROOT),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'metacov-'));
  if(missing(files).length){console.log('selftest: HEAD not clean');process.exit(1);}
  // temp copy of the file list with one real file + one folder materialised, then drop a meta
  const victim=files.find(f=>f.endsWith('.ts.meta'));const copy=files.filter(f=>f!==victim);
  for(const f of [victim.slice(0,-5)]){fs.mkdirSync(path.join(tmp,path.dirname(f)),{recursive:true});fs.writeFileSync(path.join(tmp,f),'');}
  const m=missing(copy);fs.rmSync(tmp,{recursive:true,force:true});
  const dirVictim=files.find(f=>f.endsWith('.meta')&&!files.some(x=>x===f.slice(0,-5)));
  const m2=missing(files.filter(f=>f!==dirVictim));
  const ok=m.length===1&&m[0]===victim&&m2.length===1&&m2[0]===dirVictim;
  console.log(`selftest drop file meta ${victim} -> ${JSON.stringify(m)}; drop folder meta ${dirVictim} -> ${JSON.stringify(m2)}`);
  console.log('assets-meta-coverage selftest: '+(ok?'PASS':'FAIL'));process.exit(ok?0:1);}
const rev=argv[0]==='--rev'?argv[1]:null;const m=missing(list(ROOT,rev));
for(const f of m)console.log('MISSING '+f);
console.log(`assets-meta-coverage${rev?' @'+rev:''}: ${m.length?'FAIL '+m.length+' missing':'PASS'}`);if(!rev){const r=cp.spawnSync(process.execPath,[__filename,'--selftest'],{stdio:'inherit'});if(r.status!==0)process.exit(1);}
process.exit(m.length?1:0);
