'use strict';
// r5 release STRIP gate for the journal-sky debug hooks (not just disabled): the release pipeline (build-wechat-guarded.sh) stages a
// copy, runs strip-probes.cjs --stage, builds, then release-gates.cjs --probe-free on the output. Creator cannot run on the box, so
// this gate runs the same two tools on a staged copy of every .ts/.js under assets/ (the build input):
//  - stripped: no journal hook key / branch / seeding symbol remains (release-probe-symbols.json: journal-sky, skyChallenges,
//    seedSkyChallengeWins, SKY_CHALLENGE_WITNESSES); the three touched files still parse (TypeScript syntactic check);
//  - negative self-test: the UNSTRIPPED copy fails the same check (and so would a hook added without markers).
// 'qfPre' is reported, not failed: it belongs to the shared __qfPreTransition entry (pre-existing; see report).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const ROOT=path.resolve(__dirname,'../..'),A=path.join(ROOT,'creator-build-project/assets'),S=require('../build-guard/strip-probes.cjs'),G=require('../build-guard/release-gates.cjs');
const OURS=['journal-sky','skyChallenges','seedSkyChallengeWins','SKY_CHALLENGE_WITNESSES'];
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
  console.log(`NOTE qfPre still in stripped sources (shared __qfPreTransition entry, pre-existing, code+comments): ${pos.qfPre.join(', ')}`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
