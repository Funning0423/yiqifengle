'use strict';
// r5 release STRIP gate for the journal-sky debug hooks (not just disabled): the release pipeline (build-wechat-guarded.sh) stages a
// copy, runs strip-probes.cjs --stage, builds, then release-gates.cjs --probe-free on the output. Creator cannot run on the box, so
// this gate runs the same two tools on a staged copy of every .ts/.js under assets/ (the build input):
//  - stripped: no journal hook key / branch / seeding symbol remains (release-probe-symbols.json: journal-sky, skyChallenges,
//    seedSkyChallengeWins, SKY_CHALLENGE_WITNESSES); the three touched files still parse (TypeScript syntactic check);
//  - negative self-test: the UNSTRIPPED copy fails the same check (and so would a hook added without markers).
// r5 formal (Grok Bot option 2): the shared __qfPreTransition / ?qfPre= entry is wrapped in QF_TRIAL markers. TRIAL upload (default
// STRIP_PROBES=1) keeps it — checked; FORMAL release (FORMAL_RELEASE=1: strip-probes --formal, release-gates --formal-free) must have
// ZERO formal hits (qfPre, QF_TRIAL) — FAIL on any residue; negative self-tests: the unstripped AND the trial-stripped copies
// must both FAIL the formal check. Formal-stripped files still parse and keep the exports the frozen boot / WNC import.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets'),S=require('../build-guard/strip-probes.cjs'),G=require('../build-guard/release-gates.cjs');
const OURS=['journal-sky','skyChallenges','seedSkyChallengeWins','SKY_CHALLENGE_WITNESSES','finishPausedMainlineWin'];
for(const k of OURS)assert(G.FORBID.some(([r])=>r===k),'release-probe-symbols.json lists '+k);
function copy(dst){const out=[];(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(/\.(ts|js)$/.test(e.name)){const rel=path.relative(A,p),q=path.join(dst,'assets',rel);fs.mkdirSync(path.dirname(q),{recursive:true});fs.copyFileSync(p,q);out.push(rel);}}})(A);return out;}
function scan(dir,rels){const files=rels.map(r=>({name:r,text:fs.readFileSync(path.join(dir,'assets',r),'utf8')}));const r=G.probeFree(files);
  return {ours:r.hits.filter(h=>OURS.includes(h.rule)),qfPre:files.filter(f=>/qfPre/.test(f.text)).map(f=>f.name)};}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'qf-journal-strip-'));
try{
  const raw=path.join(tmp,'raw'),rel=copy(raw),st=path.join(tmp,'stage');copy(st);
  const r=S.stage(st);assert(r.regions>0,'strip ran');
  const neg=scan(raw,rel);assert(neg.ours.length>0,'negative self-test: unstripped copy must FAIL ('+neg.ours.length+' hits)');
  for(const k of OURS.slice(0,2))assert(neg.ours.some(h=>h.rule===k),'negative self-test sees '+k);
  const pos=scan(st,rel);assert.deepEqual(pos.ours.map(h=>h.name+':'+h.rule),[],'stripped release input still has journal hook code');
  const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
  for(const f of ['scripts/world-r2/PreTransitionKeys.ts','scripts/world-r2/PreTransitionRun.ts','scripts/world-r2/RegionFlowTest.ts']){
    const o=ts.transpileModule(fs.readFileSync(path.join(st,'assets',f),'utf8'),{reportDiagnostics:true,fileName:f,compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}});
    assert.deepEqual((o.diagnostics||[]).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[],f+' parses after strip');}
  // stripped keys module: the release key table has no journal key
  const keysJs=ts.transpileModule(fs.readFileSync(path.join(st,'assets/scripts/world-r2/PreTransitionKeys.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  assert(!/journal-sky/.test(keysJs),'compiled stripped key table has no journal key');
  console.log(`PASS release strip: ${rel.length} sources staged, ${r.regions} probe regions stripped; journal hook symbols left = 0 (${OURS.join(', ')}); touched files parse`);
  console.log(`PASS negative self-test: unstripped copy has ${neg.ours.length} journal hook hits → FAIL`);
  assert(pos.qfPre.length>0,'TRIAL upload keeps the qfPre entry (trial behaviour unchanged)');
  // FORMAL release
  const fo=path.join(tmp,'formal');copy(fo);const fr=S.stage(fo,true);assert(fr.regions>r.regions,'formal strip removes the trial regions too');
  const fscan=d=>G.formalFree(rel.map(x=>({name:x,text:fs.readFileSync(path.join(d,'assets',x),'utf8')}))).hits;
  const fhits=fscan(fo);assert.deepEqual(fhits.map(h=>h.name+':'+h.rule),[],'FORMAL release input has trial-entry residue');
  for(const x of rel)assert(!/qfPre/.test(fs.readFileSync(path.join(fo,'assets',x),'utf8')),'formal: qfPre left in '+x);
  const negRaw=fscan(raw),negTrial=fscan(st);assert(negRaw.length>0&&negTrial.length>0,'negative self-test: unstripped and trial copies must FAIL --formal-free');
  assert(negTrial.some(h=>h.rule==='formal:qfPre'),'trial copy is caught on qfPre');
  const TOUCH=['scripts/world-r2/PreTransitionKeys.ts','scripts/world-r2/PreTransitionRun.ts','scripts/world-r2/RegionFlowTest.ts','scripts/world-r2/QaSkip.ts','scripts/world-r2/LakeWinWitnesses.ts'];
  for(const f of TOUCH){const o=ts.transpileModule(fs.readFileSync(path.join(fo,'assets',f),'utf8'),{reportDiagnostics:true,fileName:f,compilerOptions:{target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.CommonJS}});
    assert.deepEqual((o.diagnostics||[]).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[],f+' parses after FORMAL strip');}
  const fRun=fs.readFileSync(path.join(fo,'assets/scripts/world-r2/PreTransitionRun.ts'),'utf8'),fKeys=fs.readFileSync(path.join(fo,'assets/scripts/world-r2/PreTransitionKeys.ts'),'utf8');
  assert(/export function installPreTransition\(deps:PreDeps\):boolean\{[\s\S]*return registered;/.test(fRun)&&!/__qf|runner|setTimeout/.test(fRun),'formal installPreTransition = inert stub (boot import kept)');
  assert(/export function preTransitionEnabled\(/.test(fKeys)&&/let on=false;\s*\n\s*return on;/.test(fKeys),'formal preTransitionEnabled = false (WNC import kept)');
  // formal stubs behave: compile and call
  const ev=(src,req)=>{const m={exports:{}};new Function('require','module','exports',ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText)(req,m,m.exports);return m.exports;};
  const req=x=>x==='cc'?{}:x==='./QaSkip'?{qaSkipAllowed:()=>true}:{};
  delete globalThis.__qfPreTransition;assert.equal(ev(fRun,req).installPreTransition({}),false,'formal: nothing registered even on a develop host');assert.equal(globalThis.__qfPreTransition,undefined);
  assert.equal(ev(fKeys,req).preTransitionEnabled('?qfHooks=1&qfPre=journal-sky-open',{}),false,'formal: gate always false');
  console.log(`PASS formal release strip: ${fr.regions} regions (probe + trial); formal residue = 0 (qfPre, QF_TRIAL); stubs inert; ${TOUCH.length} files parse`);
  console.log(`PASS negative self-test (formal): unstripped ${negRaw.length} hits, trial-stripped ${negTrial.length} hits → FAIL; trial upload keeps qfPre in ${pos.qfPre.length} files`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
