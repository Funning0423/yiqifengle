#!/usr/bin/env node
'use strict';
/** Release-build gates (GGbot, full9c). Run on a finished build directory.
 *   --probe-free <buildDir>    no probe code in any shipped .js/.json/.ts text: __QF_PROBE_HER, QF_HER_FRAME, QF_PROBE (covers the
 *                              QF_PROBE_BEGIN/END markers) and the per-cut [QF_B1_GAP] line ('[QF_B1_GAP] '+JSON.stringify({cut:…).
 *                              The original B1 summary line ('[QF_B1_GAP] '+JSON.stringify({totalMs:…), BalloonTransit.ts, bdd3c6d7,
 *                              predates the probes) is allowed and reported as KEEP_B1.
 *   --size <buildDir> [--max-total N] [--max-main N]   TOTAL = all files; MAIN = files outside subpackages/ (main package).
 *                              Defaults: 24641536 / 4000000 (env MAX_TOTAL_BYTES / MAX_MAIN_BYTES override). */
const fs=require('fs'),path=require('path');
// Symbol list is data (release-probe-symbols.json) so new test-only logs only add an entry there.
const SYM=JSON.parse(fs.readFileSync(path.join(__dirname,'release-probe-symbols.json'),'utf8'));
const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const FORBID=[...SYM.literal.map(l=>[l,new RegExp(esc(l))]),...Object.entries(SYM.regex||{}).map(([k,r])=>[k,new RegExp(r)])];
const KEEP_B1=/\[QF_B1_GAP\] ?["'`]\s*\+\s*JSON\.stringify\(\s*\{\s*["']?totalMs["']?\s*:/;
const TEXT=/\.(js|mjs|cjs|json|ts|txt|html)$/;
function walk(d,r=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,r);else r.push(p);}return r;}
/** files: [{name,text}] -> {hits:[{name,rule,at,ctx}], keepB1:n} */
function probeFree(files){const hits=[];let keepB1=0;
  for(const {name,text} of files){for(const [rule,re] of FORBID){const g=new RegExp(re.source,'g');let m;while((m=g.exec(text))){hits.push({name,rule,at:m.index,ctx:text.slice(Math.max(0,m.index-40),m.index+60).replace(/\s+/g,' ')});if(hits.length>200)return {hits,keepB1};}}
    keepB1+=(text.match(new RegExp(KEEP_B1.source,'g'))||[]).length;}
  return {hits,keepB1};}
function sizeOf(entries,maxTotal,maxMain){let total=0,main=0;for(const {rel,bytes} of entries){total+=bytes;if(!/^subpackages[\\/]/.test(rel))main+=bytes;}
  const bad=[];if(total>maxTotal)bad.push(`TOTAL ${total} > ${maxTotal}`);if(main>maxMain)bad.push(`MAIN ${main} > ${maxMain}`);return {total,main,bad};}
module.exports={probeFree,sizeOf,FORBID,KEEP_B1};
if(require.main===module){const a=process.argv.slice(2),dir=a[1]&&path.resolve(a[1]);
  if(!dir||!fs.existsSync(dir)){console.log('FAIL no build dir: '+a[1]);process.exit(2);}
  const opt=k=>{const i=a.indexOf(k);return i>0?Number(a[i+1]):undefined;};
  if(a[0]==='--probe-free'){const files=walk(dir).filter(f=>TEXT.test(f)).map(f=>({name:path.relative(dir,f),text:fs.readFileSync(f,'utf8')}));
    const r=probeFree(files);for(const h of r.hits.slice(0,20))console.log(`FAIL PROBE ${h.rule} ${h.name}@${h.at}: …${h.ctx}…`);
    console.log(`${r.hits.length?'FAIL':'PASS'} release-probe-free files=${files.length} hits=${r.hits.length} KEEP_B1=${r.keepB1}`);process.exit(r.hits.length?1:0);}
  if(a[0]==='--size'){const mt=opt('--max-total')??Number(process.env.MAX_TOTAL_BYTES||24641536),mm=opt('--max-main')??Number(process.env.MAX_MAIN_BYTES||4000000);
    const r=sizeOf(walk(dir).map(f=>({rel:path.relative(dir,f),bytes:fs.statSync(f).size})),mt,mm);for(const b of r.bad)console.log('FAIL SIZE '+b);
    console.log(`${r.bad.length?'FAIL':'PASS'} release-size TOTAL=${r.total}/${mt} MAIN=${r.main}/${mm}`);process.exit(r.bad.length?1:0);}
  console.log('usage: --probe-free DIR | --size DIR [--max-total N] [--max-main N]');process.exit(2);}
