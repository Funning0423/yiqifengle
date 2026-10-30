// P0 fin (fc3123fa): r04-lake-02 hit [QF_BOARD_ENTRY_TIMEOUT]; the cancelled lakeside build left no trace of WHICH step it was
// waiting in. Every build cancelled before it returns its lease now logs one always-on line (step + elapsed); a finished build does not.
const fs=require('fs'),path=require('path'),assert=require('assert');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts'),bg=fs.readFileSync(path.join(S,'region/LakesideBoardBackground.ts'),'utf8');
assert(/export function logLakesideBuildCancelled\(/.test(bg),'build-cancelled logger exists');
assert(/const offTrace=buildToken\.onCancel\(\(\)=>\{if\(!built\)logLakesideBuildCancelled\(String\(selection\?\.stageId\?\?''\),step,Date\.now\(\)-builtAt,!!pre\);\}\);/.test(bg),'cancel listener logs the live step');
assert(/built=true;offTrace\(\);\n  return \{/.test(bg),'finished build unregisters the trace before returning its lease');
const src=bg.match(/export function logLakesideBuildCancelled[^\n]*\n/)[0].replace('export ','').replace(/:string|:number|:boolean/g,'');
const lines=[],orig=console.warn;console.warn=(...a)=>lines.push(a.join(' '));
try{new Function(src+';logLakesideBuildCancelled("r04-lake-02","scenery",12001,false);')();}finally{console.warn=orig;}
assert.equal(lines.length,1);assert.deepEqual(JSON.parse(lines[0].replace('[QF_LAKESIDE] ','')),{event:'build-cancelled',stageId:'r04-lake-02',step:'scenery',totalMs:12001,preload:false});
console.log('lakeside build-cancel trace OK');
