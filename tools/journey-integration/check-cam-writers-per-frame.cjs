'use strict';
// full9b gate: exactly ONE camera write per rendered frame across a camTrace (sail → sky → lake). Frames come from the
// 'fr=' engine frame id CamTraceLog prints (full9b+); older traces fall back to grouping writes < 25 ms apart.
// Usage: node check-cam-writers-per-frame.cjs <camtrace.txt> [--from=HH:MM:SS] — exit 1 if any frame has > 1 writer.
const fs=require('node:fs');
const file=process.argv[2];if(!file){console.error('usage: check-cam-writers-per-frame.cjs <camtrace.txt>');process.exit(2);}
const from=(process.argv.find(a=>a.startsWith('--from='))||'').slice(7);
const L=fs.readFileSync(file,'utf8').split('\n').filter(l=>/\[QF_CAM_TRACE\] f=\d+/.test(l)).filter(l=>!from||l.slice(11,19)>=from);
const rows=L.map(l=>({ms:Date.parse(l.slice(0,24)),fr:(l.match(/ fr=(\d+)/)||[])[1],w:(l.match(/ w=(\S+)/)||[])[1]||'?',l}));
const frames=[];let cur=null;
for(const r of rows){const key=r.fr!=null?'f'+r.fr:null;
 const same=cur&&(key?cur.key===key:(cur.key==null&&r.ms-cur.last<25));
 if(!same){cur={key,last:r.ms,ws:[]};frames.push(cur);}cur.last=r.ms;cur.ws.push(r);}
const bad=frames.filter(f=>f.ws.length>1);
const pairs={};for(const f of bad){const k=f.ws.map(x=>x.w).join(' + ');pairs[k]=(pairs[k]||0)+1;}
const out={test:'cam-writers-per-frame',file:require('node:path').basename(file),frames:frames.length,multiWriterFrames:bad.length,writerSets:pairs,
 firstBad:bad[0]?bad[0].ws.map(x=>x.l.slice(11,23)+' '+x.w).slice(0,4):null,status:bad.length?'FAIL':'PASS'};
console.log(JSON.stringify(out));process.exit(bad.length?1:0);
