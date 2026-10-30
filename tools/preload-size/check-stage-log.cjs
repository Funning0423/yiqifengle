#!/usr/bin/env node
'use strict';
/** Mac/DevTools console gate for [QF_PRELOAD_STAGE] lines: FAIL for every stage with ms > budgetMs or ok:false or loaded:false,
 *  whatever the logged ok says (dedf8853 logged ok:true for 32304/1200). Budgets come from the log line itself (= MEADOW_LEG_STAGES /
 *  SKY_LEG_STAGES); this tool never adjusts them.  usage: check-stage-log.cjs <console.log>... [--json out] */
const fs=require('fs');
function parse(text){const out=[];for(const l of text.split('\n')){const i=l.indexOf('[QF_PRELOAD_STAGE] ');if(i<0)continue;try{out.push(JSON.parse(l.slice(i+19)));}catch{out.push({bad:l.slice(i)});}}return out;}
function verdict(rows){const fails=[];for(const r of rows){if(r.bad){fails.push('UNPARSABLE '+r.bad);continue;}
 const over=!(r.ms<=r.budgetMs),why=[over?`ms ${r.ms} > budgetMs ${r.budgetMs}`:'',r.ok===false?'ok:false':'',r.loaded===false?'loaded:false':''].filter(Boolean);
 if(why.length)fails.push(`${r.target}/${r.stage}: ${why.join(', ')}${r.frameMaxMs!=null?' (frameMaxMs '+r.frameMaxMs+')':''}`);}
 return fails;}
module.exports={parse,verdict};
if(require.main===module){const a=process.argv.slice(2),files=a.filter((x,i)=>!x.startsWith('--')&&a[i-1]!=='--json');let rows=[];
 for(const f of files)rows=rows.concat(parse(fs.readFileSync(f,'utf8')).map(r=>({...r,file:f})));
 const fails=verdict(rows);const j=a.indexOf('--json');if(j>=0)fs.writeFileSync(a[j+1],JSON.stringify({rows,fails},null,1));
 for(const f of fails)console.log('FAIL '+f);console.log(fails.length?`FAIL stage-log ${fails.length}/${rows.length} stages`:`PASS stage-log ${rows.length} stages within budget`);process.exit(fails.length||!rows.length?1:0);}
