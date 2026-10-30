'use strict';
/* coast-pieces-unloaded (Grok Bot 10/30, size plan M2/(b)): the 3D coast_pieces.glb is never loaded at runtime.
 * 1) Static scan of every runtime file (assets/scripts .ts/.js, every .prefab/.scene/.json/.anim under assets/):
 *    no 'coast_pieces' / 'piece_*' 3D node reference, no uuid of coast_pieces.glb (if Creator has generated its .meta),
 *    and no load call that sweeps region_coast/models (loadDir on '' or 'models', or load('models/coast_pieces')).
 * 2) "No reference errors" when the coast starts: simulates the coast board start (BoardKit.COAST_KIT pieceBundle + piece keys +
 *    goal art) against the files on disk; every path must resolve to exactly one asset in its bundle; every uuid referenced from
 *    region_coast assets must exist in some .meta; the manifest must not list a missing region_coast file.
 * Runs on any checkout: QF_GATE_ROOT=<worktree> (default: this repo). Self-checks inject each violation and must FAIL. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(process.env.QF_GATE_ROOT||path.resolve(__dirname,'../..')),ASSETS=path.join(ROOT,'creator-build-project/assets'),COAST=path.join(ASSETS,'bundles/region_coast');
function walk(d,out=[]){if(!fs.existsSync(d))return out;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,out);else out.push(p);}return out;}
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
function piecesUuid(){const m=path.join(COAST,'models/coast_pieces.glb.meta');return fs.existsSync(m)?JSON.parse(fs.readFileSync(m,'utf8')).uuid:null;}
function staticScan(files,uuid){const bad=[];
 for(const [f,raw] of files){const code=/\.(ts|js)$/.test(f)?strip(raw):raw,rel=path.relative(ROOT,f);
  if(/coast_pieces/.test(code))bad.push(rel+': references coast_pieces');
  if(uuid&&code.includes(uuid))bad.push(rel+': references the coast_pieces.glb uuid '+uuid);
  if(/\.(ts|js)$/.test(f)){
   if(/region_coast[\s\S]{0,400}?loadDir\(\s*['"](|models\/?)['"]/.test(code)||/loadDir\(\s*['"]models\/?['"]/.test(code)&&/region_coast|pieceBundle/.test(code))bad.push(rel+': loadDir sweeps region_coast/models');
   if(/\.load\(\s*['"]models\/coast_pieces/.test(code))bad.push(rel+': loads models/coast_pieces');}}
 return bad;}
function runtimeFiles(){return walk(ASSETS).filter(f=>!/\.meta$/.test(f)&&(f.includes(path.sep+'scripts'+path.sep)?/\.(ts|js)$/.test(f):/\.(prefab|scene|json|anim)$/.test(f)))
 .filter(f=>!f.startsWith(path.join(COAST,'data'))||!/coast_aabbs/.test(f)).map(f=>[f,fs.readFileSync(f,'utf8')]);}
// coast start simulation: the paths ManagedMobileBoardUI loads from kit.pieceBundle
function coastStartPaths(){const src=fs.readFileSync(path.join(ASSETS,'scripts/ui/BoardKit.ts'),'utf8'),m=src.match(/id:\s*'coast'[\s\S]*?pieceBundle:\s*'([^']+)'[\s\S]*?pieceKeys:\s*\[([^\]]*)\]\.map\(n\s*=>\s*'([^']*)'\s*\+\s*n\)/);
 assert.ok(m,'COAST_KIT pieceBundle/pieceKeys not found in BoardKit.ts');const keys=m[2].match(/'([^']+)'/g).map(s=>m[3]+s.slice(1,-1));
 const ga=src.match(/id:\s*'coast'[\s\S]*?goalArt:\s*\{([^}]*)\}/),goal=ga?(ga[1].match(/'([^']+\/[^']+)'/g)||[]).map(s=>s.slice(1,-1)):[];return {bundle:m[1],paths:[...keys,...goal]};}
function resolveLoads(bundleDir,paths){const errs=[];const files=walk(bundleDir).filter(f=>!/\.meta$/.test(f)).map(f=>path.relative(bundleDir,f).replace(/\\/g,'/'));
 for(const p of paths){const hit=files.filter(f=>f.replace(/\.[^./]+$/,'')===p);if(hit.length!==1)errs.push(`load '${p}': ${hit.length?'ambiguous '+hit.join(','):'missing asset (load would fail)'}`);if(hit.some(h=>/coast_pieces/.test(h)))errs.push(`load '${p}' resolves to coast_pieces`);}return errs;}
function uuidRefs(){const known=new Set();for(const f of walk(ASSETS).filter(f=>/\.meta$/.test(f))){try{const j=JSON.parse(fs.readFileSync(f,'utf8'));known.add(j.uuid);for(const k of Object.keys(j.subMetas||{}))known.add(j.uuid+'@'+k);}catch{}}
 const errs=[];for(const f of walk(COAST).filter(f=>/\.(prefab|scene|json)$/.test(f))){const s=fs.readFileSync(f,'utf8');for(const u of s.match(/"__uuid__"\s*:\s*"([^"]+)"/g)||[]){const id=u.split('"')[3];if(!known.has(id)&&!known.has(id.split('@')[0]))errs.push(path.relative(ROOT,f)+': missing uuid '+id);}}return errs;}
function manifestErrs(){const mf=path.join(ROOT,'assets-MANIFEST-SHA256.json');if(!fs.existsSync(mf))return [];const s=fs.readFileSync(mf,'utf8'),errs=[];
 for(const m of s.match(/"creator-build-project\/assets\/bundles\/region_coast\/[^"]+"/g)||[]){const p=m.slice(1,-1);if(!fs.existsSync(path.join(ROOT,p)))errs.push('manifest lists missing '+p);}return errs;}
// --- self-checks (must FAIL) ---
{const F=x=>[[path.join(ASSETS,'scripts/x.ts'),x]];
 assert.ok(staticScan(F("bundle.load('models/coast_pieces',Prefab,cb)"),null).length,'self-check: load of models/coast_pieces not caught');
 assert.ok(staticScan(F("assetManager.loadBundle('region_coast',(e,b)=>b.loadDir('',Prefab,cb))"),null).length,'self-check: region_coast loadDir sweep not caught');
 assert.ok(staticScan([[path.join(ASSETS,'bundles/region_coast/x.prefab'),'{"__uuid__":"abc-123@f06f9"}']],'abc-123').length,'self-check: uuid reference not caught');
 assert.equal(staticScan(F("// coast_pieces only in a comment\nconst a=1;"),null).length,0,'self-check: comment must not count');
 const tmp=path.join(ROOT,'.qf-gate-selfcheck-'+process.pid);fs.mkdirSync(path.join(tmp,'board'),{recursive:true});try{fs.writeFileSync(path.join(tmp,'board/piece_star.png'),'');
  assert.ok(resolveLoads(tmp,['board/piece_star','board/piece_conch']).some(e=>/piece_conch.*missing/.test(e)),'self-check: missing piece asset not caught');
  assert.equal(resolveLoads(tmp,['board/piece_star']).length,0);}finally{fs.rmSync(tmp,{recursive:true,force:true});}}
// --- real checks ---
const fail=[],uuid=piecesUuid(),files=runtimeFiles();fail.push(...staticScan(files,uuid));
const st=coastStartPaths();assert.equal(st.bundle,'region_coast');fail.push(...resolveLoads(path.join(ASSETS,'bundles',st.bundle),st.paths));
fail.push(...uuidRefs(),...manifestErrs());
const glb=fs.existsSync(path.join(COAST,'models/coast_pieces.glb'));
console.log(`ok   root ${path.relative(path.resolve(__dirname,'../..'),ROOT)||'.'}; ${files.length} runtime files scanned; coast_pieces.glb ${glb?'present':'removed'} (uuid ${uuid||'none: no Creator meta yet'})`);
console.log(`ok   coast start: ${st.paths.length} loads from ${st.bundle} (${st.paths.join(', ')})`);
console.log('ok   self-checks: models/coast_pieces load, region_coast loadDir sweep, uuid reference, missing piece asset each FAIL; comment ignored');
for(const f of fail)console.log('     FAIL '+f);
console.log('coast-pieces-unloaded: '+(fail.length?'FAIL':'PASS'));process.exitCode=fail.length?1:0;
