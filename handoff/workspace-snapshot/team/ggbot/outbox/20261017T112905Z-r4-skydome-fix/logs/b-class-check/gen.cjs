const ts=require('/tmp/ts5/node_modules/typescript'),fs=require('fs'),path=require('path'),vm=require('vm');
const S='/tmp/wt-r4jf/creator-build-project/assets/scripts/';const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,s=>s==='cc'?new Proxy({},{get:()=>class{}}):load(path.resolve(path.dirname(file),s)+'.ts'),m);return m.exports;}
const W=load(S+'region/LakesideJourneyWater.ts');const logs=[];
// Playwright maps console.error -> msg.type()==='error', console.warn -> 'warning' (lk.cjs stores [t,type,text])
console.error=(...a)=>logs.push(['1.000','error',a.join(' ')]);console.warn=(...a)=>logs.push(['1.000','warning',a.join(' ')]);
W.logLakesideJourneyWaterFallback(Error('lakeside-water-material-load-failed: water/lakeside-water: 404'));
// the old 1fde08f behaviour for comparison (warn)
logs.push(['1.100','warning','[QF_LAKE] {"event":"journey-water-fallback","note":"old warn variant"}']);
fs.writeFileSync('t_worldFlowLog.txt',logs.map(l=>l.join('\t')).join('\n'));
fs.writeFileSync('t.json',JSON.stringify({marks:[],errors:[],net:[],failed:[],ok200:[],scriptErr:[]}));fs.writeFileSync('srv.log','');
console.log(JSON.stringify(logs));
