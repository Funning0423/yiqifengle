// v3.3 load fix B guard: Cocos' ES5 (loose) build compiles `[...x]` to `[].concat(x)` and `f(...x)` to `f.apply(void 0, x)`.
// That is only correct when x is an ARRAY. A Set / Map / iterator / string becomes ONE element (Mac v3.2: `[...new Set(..)]` -> length 1
// -> "lakeside-prefab-missing: [object Set]"; `[...map.values()]` -> the iterator itself handed out as a material).
// Rule: spread only arrays; use Array.from(...) for anything iterable. Scans every TS file under assets/scripts with the TS AST.
const fs=require('fs'),path=require('path'),assert=require('assert');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
// 1) the hazard itself, as the loose transform emits it
assert.equal([].concat(new Set(['a','b'])).length,1,'loose spread of a Set keeps the Set as one element');
assert.equal(Array.from(new Set(['a','b'])).length,2);
const ROOT=path.resolve(__dirname,'../creator-build-project/assets/scripts'),files=[];
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(/\.ts$/.test(f)&&!/\.d\.ts$/.test(f))files.push(p);}})(ROOT);
const ITER_METHODS=/^(values|keys|entries|matchAll)$/,bad=[];
for(const file of files){const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.ES2019,true);
 // identifiers declared as Set/Map/iterables in this file (initializer `new Set|Map|WeakSet` or a Set/Map/Iterable type annotation)
 const iterNames=new Set();
 (function d(n){if((ts.isVariableDeclaration(n)||ts.isPropertyDeclaration(n)||ts.isParameter(n))&&n.name&&ts.isIdentifier(n.name)){
   const init=n.initializer,ty=n.type&&n.type.getText(sf);
   if((init&&ts.isNewExpression(init)&&/^(Set|Map|WeakSet|WeakMap)$/.test(init.expression.getText(sf)))||(ty&&/^(ReadonlySet|Set|ReadonlyMap|Map|Iterable|IterableIterator|Generator)\b/.test(ty)))iterNames.add(n.name.text);}
  ts.forEachChild(n,d);})(sf);
 const isIterExpr=e=>{e=ts.isParenthesizedExpression(e)?e.expression:e;
  if(ts.isNewExpression(e)&&/^(Set|Map)$/.test(e.expression.getText(sf)))return true;
  if(ts.isStringLiteral(e)||ts.isNoSubstitutionTemplateLiteral(e)||ts.isTemplateExpression(e))return true;
  if(ts.isCallExpression(e)&&ts.isPropertyAccessExpression(e.expression)&&ITER_METHODS.test(e.expression.name.text)&&!/^Object$/.test(e.expression.expression.getText(sf)))return true;
  if(ts.isIdentifier(e)&&iterNames.has(e.text))return true;
  if(ts.isPropertyAccessExpression(e)&&e.expression.kind===ts.SyntaxKind.ThisKeyword&&iterNames.has(e.name.text))return true;
  return false;};
 (function v(n){if(ts.isSpreadElement(n)&&isIterExpr(n.expression)){const {line}=sf.getLineAndCharacterOfPosition(n.getStart());bad.push(path.relative(ROOT,file)+':'+(line+1)+'  ...'+n.expression.getText(sf).slice(0,60));}ts.forEachChild(n,v);})(sf);}
assert.deepEqual(bad,[],'spread of a non-array (use Array.from):\n'+bad.join('\n'));
// 2) the scanner catches the two v3.2 lines (self-check on the old text)
const old=' const shared=new Map();return [...shared.values()];const missing=[...new Set(list)];';
const sf=ts.createSourceFile('x.ts',old,ts.ScriptTarget.ES2019,true);let hits=0;(function v(n){if(ts.isSpreadElement(n))hits++;ts.forEachChild(n,v);})(sf);assert.equal(hits,2);
const bg=fs.readFileSync(path.join(ROOT,'region/LakesideBoardBackground.ts'),'utf8');
assert(/return Array\.from\(shared\.values\(\)\);/.test(bg)&&/const missing=Array\.from\(new Set\(/.test(bg),'lakeside uses Array.from');
console.log('es5 iterator spread OK ('+files.length+' TS files)');
