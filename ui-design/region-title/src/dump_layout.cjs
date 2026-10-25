const ts=require('/tmp/ts5/node_modules/typescript'),fs=require('fs');
const src=fs.readFileSync('ui/BoardLayout.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
const m={exports:{}};new Function('module','exports','require',js)(m,m.exports,require);
const L=m.exports;const out={};
for(const [w,h] of [[320,568],[360,780],[375,667],[390,844],[402,874],[414,896],[430,932]]){const s=L.boardSafeInsets(w,h);const g=L.boardLayout(w,h,s,2);
out[w+'x'+h]={safe:s,pause:g.pause,plate:g.plate,tray:g.tray,toast:g.toast,tools:g.tools,plateBottom:g.plate.y+g.plate.height/2,trayTop:g.tray.y-g.tray.height/2};}
console.log(JSON.stringify(out));
