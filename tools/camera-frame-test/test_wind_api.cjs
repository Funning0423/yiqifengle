'use strict';
/** T2+ wind-strength public API test (WorldFlowComponent.getWindStrength / onWindStrength + globalThis debug exposure).
 * The component needs cc, so the REAL method bodies are extracted from the source and run in a minimal harness
 * (same `this` fields). Usage: node test_wind_api.cjs */
const fs=require('fs'),path=require('path'),{root}=require('./load_ts.cjs');
const src=fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/world-r1/WorldFlowComponent.ts'),'utf8');
const checks=[],check=(name,ok,detail)=>{checks.push(ok);console.log((ok?'PASS ':'FAIL ')+name.padEnd(28)+' '+(detail===undefined?'':JSON.stringify(detail)));};
const sig={get:/\n  getWindStrength\(\):number \{([^\n]*)\}\n/.exec(src),on:/\n  onWindStrength\(listener:\(strength:number\)=>void\):\(\)=>void \{([^\n]*)\}\n/.exec(src)};
check('signatures',!!sig.get&&!!sig.on,{getWindStrength:'():number',onWindStrength:'(listener:(strength:number)=>void):()=>void'});
if(sig.get&&sig.on){
  const ts=require('../qf-env.cjs').typescript();
  const js=ts.transpileModule(`class H{disposed=false;windStrength=0;windListeners=new Set();getWindStrength(){${sig.get[1]}}onWindStrength(listener){${sig.on[1]}}}module.exports=H;`,{compilerOptions:{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.CommonJS}}).outputText;
  const m={exports:{}};new Function('module','exports',js)(m,m.exports);const H=m.exports,h=new H();
  const vals=[];check('default-0',h.getWindStrength()===0);
  for(const [v,want] of [[.4,.4],[1.7,1],[-.2,0],[NaN,0],[1,1],[0,0]]){h.windStrength=v;vals.push([v,h.getWindStrength()]);}
  check('clamped-0..1',vals.every(([v,g],i)=>g===[.4,1,0,0,1,0][i]),vals);
  h.windStrength=.6;h.disposed=true;check('disposed-0',h.getWindStrength()===0);
  const off=h.onWindStrength(()=>{});check('unsubscribe-fn',typeof off==='function'&&h.windListeners.size===1);off();off();check('unsubscribe-idempotent',h.windListeners.size===0);
}
check('debug-__worldCamera',/__worldCamera=\{[\s\S]*?windStrength:\(\)=>self\.getWindStrength\(\),onWindStrength:\(listener:\(strength:number\)=>void\)=>self\.onWindStrength\(listener\)/.test(src));
check('debug-__worldDayNight',/__worldDayNight=\{[^\n]*windStrength:\(\)=>self\.getWindStrength\(\)/.test(src));
check('listeners-cleared-on-destroy',/this\.windStrength=0;this\.windListeners\.clear\(\);/.test(src));
const ok=checks.every(Boolean);console.log(ok?'ALL PASS wind-api':'FAILED');process.exitCode=ok?0:1;
