#!/usr/bin/env node
'use strict';
/** Box-side preload consistency gate (fullN, after the Mac dedf8853 drift: region_meadow table 3,292,010 B vs built 2,053,631 B).
 *  The PRELOAD_BYTES table can only be measured on a Creator build (Mac), so the box suite never saw that 3b518fe4 (env_meadow.glb
 *  E+D, 4,727,836 -> 3,589,496 B) and f0fc7978 (meshCompress encode=true .meta) changed the meadow bundle after the table was taken.
 *  This gate pins, next to the table, a fingerprint of every source file (incl. .meta: import settings change built bytes) of each
 *  preloaded bundle at the time the table was measured. On the box:
 *    FAIL SOURCE_CHANGED <bundle>  bundle sources differ from the ones the table was measured on -> rebuild on the Mac, regenerate
 *    FAIL TABLE_CHANGED            PRELOAD_BYTES block differs from the pinned table (regenerated without refreshing the pins)
 *  --check [--rev <git rev>]   (default: working tree)     --write --measured-rev <rev> : pin the current table + the sources of <rev>
 *  Fingerprint = sha256 over sorted "path<TAB>git-blob-sha1" of creator-build-project/assets/bundles/<bundle>/** (+ <bundle>.meta). */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const ROOT=process.env.QF_PRELOAD_ROOT||path.resolve(__dirname,'../..'),PINS=process.env.QF_PRELOAD_PINS||path.join(__dirname,'preload-source-pins.json');
const {readBlock}=require('./preload-bytes.cjs');
const TS=path.join(ROOT,'creator-build-project/assets/scripts/region/TransitionChain.ts'),B='creator-build-project/assets/bundles/';
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8',maxBuffer:1<<28});
const blob=buf=>crypto.createHash('sha1').update('blob '+buf.length+'\0').update(buf).digest('hex');
function entries(bundle,rev){const scope=[B+bundle,B+bundle+'.meta'];
 if(rev)return git('ls-tree','-r',rev,'--',...scope).split('\n').filter(Boolean).map(l=>{const [m,p]=l.split('\t');return p+'\t'+m.split(' ')[2];});
 return git('ls-files','-co','--exclude-standard','--',...scope).split('\n').filter(Boolean).filter(p=>fs.existsSync(path.join(ROOT,p))).map(p=>p+'\t'+blob(fs.readFileSync(path.join(ROOT,p))));}
function fingerprint(bundle,rev){const e=entries(bundle,rev).sort();return {files:e.length,sha256:crypto.createHash('sha256').update(e.join('\n')).digest('hex')};}
function tableAt(rev){return readBlock(rev?git('show',rev+':creator-build-project/assets/scripts/region/TransitionChain.ts'):fs.readFileSync(TS,'utf8')).bytes;}
function check(pins,rev){const bad=[],table=tableAt(rev);
 for(const k of Object.keys(table))if(pins.table[k]!==table[k])bad.push(`TABLE_CHANGED ${k} PRELOAD_BYTES=${table[k]} pinned=${pins.table[k]} (regenerate with preload-bytes.cjs --write, which refreshes these pins)`);
 for(const k of Object.keys(pins.table))if(!(k in table))bad.push('TABLE_CHANGED '+k+' missing from PRELOAD_BYTES');
 for(const k of Object.keys(pins.sources)){const f=fingerprint(k,rev);if(f.sha256!==pins.sources[k].sha256)bad.push(`SOURCE_CHANGED ${k} files=${f.files} (pinned ${pins.sources[k].files}, measured on ${pins.measuredRev}): rebuild on the Mac and regenerate PRELOAD_BYTES`);}
 return bad;}
function write(measuredRev,source){const table=tableAt(null),sources={};for(const k of Object.keys(table))sources[k]=fingerprint(k,measuredRev);
 const pins={about:'preload-source-pins.cjs: bundle sources the PRELOAD_BYTES table was measured on',measuredRev,source:source||'',table,sources};
 fs.writeFileSync(PINS,JSON.stringify(pins,null,1)+'\n');return pins;}
module.exports={fingerprint,check,write,tableAt};
if(require.main===module){const a=process.argv.slice(2),opt=k=>{const i=a.indexOf(k);return i>=0?a[i+1]:null;};
 if(a[0]==='--write'){const r=opt('--measured-rev');if(!r){console.error('--write needs --measured-rev <rev the Mac build was made from>');process.exit(2);}
  const p=write(git('rev-parse',r).trim(),opt('--source'));console.log('WROTE '+PINS+' '+JSON.stringify(p.table));process.exit(0);}
 const pins=JSON.parse(fs.readFileSync(PINS,'utf8')),bad=check(pins,opt('--rev'));
 for(const b of bad)console.log('FAIL '+b);console.log(bad.length?'FAIL preload-source-pins':`PASS preload-source-pins ${Object.keys(pins.sources).length} bundles = sources of ${pins.measuredRev.slice(0,8)}`);process.exit(bad.length?1:0);}
