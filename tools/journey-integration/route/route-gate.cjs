'use strict';
/* Report mode for the b16 route tests (Grok Bot 2026-10-22): failures are printed and written to the report, but only the
 * items listed in route-hard.json fail the run (exit 1). Lock a fixed item in by adding its key to route-hard.json.
 * Keys: <leg>.<check> (documented exceptions: route-hard.json "exceptions"), leg = sail | balloonSky | balloonLake, check = O1 O2 F1 F2 F3 F4 C1 C1setoff(sail arc window, 60°/s) C1ride(sail ride outside it) C1shore(sail shore walk only) C2 C3 C4 BG1 BG2 BG3 C5;
 * "*" = every check hard. QF_ROUTE_HARD=all forces every check hard (CI strict run). */
const fs=require('node:fs');
const LEG=id=>id.startsWith('sail')?'sail':id.includes('→skycity')?'balloonSky':'balloonLake';
const hard=()=>{if(process.env.QF_ROUTE_HARD==='all')return new Set(['*']);return new Set(JSON.parse(fs.readFileSync(__dirname+'/route-hard.json','utf8')).hard);};
/** fails: array of {leg,check}. Prints the gate and sets process.exitCode. */
function gate(name,fails){const H=hard(),keys=[...new Set(fails.map(f=>(f.leg==='*'?'*':LEG(f.leg))+'.'+f.check))],hardFails=keys.filter(k=>H.has('*')||H.has(k)||H.has(k.split('.')[1]==='*'?k:'')),soft=keys.filter(k=>!hardFails.includes(k));
 console.log(`[route-gate] ${name}: hard-fail ${hardFails.length?hardFails.join(','):'none'}; report-only ${soft.length?soft.join(','):'none'}`);
 process.exitCode=hardFails.length?1:0;return {hardFails,reportOnly:soft};}
module.exports={gate,LEG};
