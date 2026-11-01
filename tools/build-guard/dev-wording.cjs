#!/usr/bin/env node
'use strict';
/** dev-wording gate (GGbot 2026-10-30, Grok Bot): developer wording must never reach the player.
 *  Scans shipped code under creator-build-project/assets (**.ts, **.js) and build-templates/wechatgame/*.js with the TypeScript
 *  parser (so comments are never seen), plus text values in assets/**.json.
 *  Player-visible candidates:
 *   - any string / template literal (each template part) containing CJK — player copy is Chinese; dev logs are excluded below;
 *   - non-CJK strings only in a display context: `x.string = …`, args of makeLabel/text/button/label/toast/say/showToast/showModal,
 *     or a property named label/title/text/content/subtitle/description/hint/message/confirmText/cancelText/nextLabel/unlockHint/failHint.
 *  Not player-visible (skipped): comments; args of console.* ; Error(...) / throw; import/export specifiers; object keys;
 *  text between QF_PROBE_BEGIN/END markers (test-only, stripped from release); the reviewed list in dev-wording.json.
 *  Patterns and why (each is wording no player copy in this game uses):
 *   3D        (?<![A-Za-z0-9_])3[dD](?![A-Za-z0-9_])  engine term; boundary keeps ids like 'ResultChest3D' / 'c3d' out
 *   场景       /场景/       dev word for "scene" (incl. 场景入口); player copy says 地区 / 章节 / place names
 *   占位 测试 调试  literal   placeholder / test / debug in Chinese; no game term contains them
 *   debug     /\bdebug\b/i, placeholder /\bplaceholder\b/i  whole word only
 *   TODO      /\b(TODO|FIXME|XXX)\b/ case-sensitive, so the English word "todo" in copy wouldn't trip it
 *   test      /\btest(s|ing|ed)?\b/i  whole word: 'latest', 'contest', 'attest' do not match
 *  Usage: node tools/build-guard/dev-wording.cjs [--root DIR] [--json]   exit 0 PASS, 1 FAIL. */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(arg('--root',path.join(__dirname,'../..')));
function arg(n,d){const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:d;}
const PATTERNS=[['3D',/(?<![A-Za-z0-9_])3[dD](?![A-Za-z0-9_])/],['场景',/场景/],['占位',/占位/],['测试',/测试/],['调试',/调试/],
  ['debug',/\bdebug\b/i],['placeholder',/\bplaceholder\b/i],['TODO',/\b(TODO|FIXME|XXX)\b/],['test',/\btest(s|ing|ed)?\b/i]];
const CJK=/[\u3400-\u9fff]/;
const DISPLAY_CALLS=new Set(['makeLabel','text','button','label','toast','say','showToast','showModal','flatDisabled']);
const DISPLAY_PROPS=new Set(['label','title','text','content','subtitle','description','hint','message','confirmText','cancelText','nextLabel','unlockHint','failHint']);
function stripProbes(src){return src.replace(/\/\*QF_PROBE_BEGIN\*\/[\s\S]*?\/\*QF_PROBE_END\*\//g,m=>m.replace(/[^\n]/g,' '));}
function loadTs(){try{return require('../qf-env.cjs').typescript();}catch(e){return require('typescript');}}
function scanCode(ts,rel,src,cfg,out){
  const sf=ts.createSourceFile(rel,stripProbes(src),ts.ScriptTarget.Latest,true,rel.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
  const calleeName=e=>ts.isIdentifier(e)?e.text:ts.isPropertyAccessExpression(e)?e.name.text:'';
  const skipped=n=>{for(let p=n.parent;p;p=p.parent){
      if(ts.isCallExpression(p)||ts.isNewExpression(p)){const c=p.expression,full=c.getText(sf);if(/^console\./.test(full)||/(^|\.)(Error|TypeError|RangeError)$/.test(full))return true;}
      if(ts.isThrowStatement(p)||ts.isImportDeclaration(p)||ts.isExportDeclaration(p)||ts.isImportTypeNode?.(p))return true;
      if(ts.isPropertyAssignment(p)&&p.name===n)return true;}return false;};
  const display=n=>{const p=n.parent;if(!p)return false;
    if(ts.isBinaryExpression(p)&&p.right===n&&p.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(p.left)&&p.left.name.text==='string')return true;
    if(ts.isCallExpression(p)&&p.arguments.includes(n)&&DISPLAY_CALLS.has(calleeName(p.expression)))return true;
    if(ts.isPropertyAssignment(p)&&p.initializer===n&&DISPLAY_PROPS.has(p.name.getText(sf).replace(/['"]/g,'')))return true;
    if(ts.isConditionalExpression(p)||ts.isBinaryExpression(p)&&p.operatorToken.kind===ts.SyntaxKind.PlusToken||ts.isParenthesizedExpression(p))return display(p);return false;};
  const check=(n,text)=>{if(!text||skipped(n))return;if(!CJK.test(text)&&!display(n))return;
    if((cfg.excludeStrings||[]).some(x=>x.file===rel&&x.string===text))return;
    for(const [name,re] of PATTERNS)if(re.test(text)){const {line}=sf.getLineAndCharacterOfPosition(n.getStart(sf));out.push({file:rel,line:line+1,pattern:name,string:text});break;}};
  const visit=n=>{if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))check(n,n.text);
    else if(ts.isTemplateExpression(n)){check(n,n.head.text);for(const s of n.templateSpans)check(s.literal,s.literal.text);}
    ts.forEachChild(n,visit);};visit(sf);}
function scanJson(rel,src,cfg,out){let j;try{j=JSON.parse(src);}catch(e){return;}const lines=src.split('\n');
  const walk=(v,key)=>{if(typeof v==='string'){if(!CJK.test(v)&&!DISPLAY_PROPS.has(key))return;if((cfg.excludeStrings||[]).some(x=>x.file===rel&&x.string===v))return;
      for(const [name,re] of PATTERNS)if(re.test(v)){const i=lines.findIndex(l=>l.includes(JSON.stringify(v).slice(1,-1)));out.push({file:rel,line:i+1,pattern:name,string:v});break;}}
    else if(Array.isArray(v))v.forEach(x=>walk(x,key));else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))walk(x,k);};walk(j,'');}
function files(dir,exts,acc=[]){if(!fs.existsSync(dir))return acc;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);
  if(e.isDirectory())files(p,exts,acc);else if(exts.some(x=>e.name.endsWith(x))&&!e.name.endsWith('.meta')&&!e.name.endsWith('.d.ts'))acc.push(p);}return acc;}
function run(root=ROOT,cfgPath=path.join(__dirname,'dev-wording.json')){
  const cfg=JSON.parse(fs.readFileSync(cfgPath,'utf8')),ts=loadTs(),out=[],A=path.join(root,'creator-build-project/assets');
  const list=[...files(A,['.ts','.js','.json']),...files(path.join(root,'creator-build-project/build-templates/wechatgame'),['.js'])];
  for(const f of list){const rel=path.relative(root,f).split(path.sep).join('/');if(cfg.excludeFiles&&cfg.excludeFiles[rel])continue;
    const src=fs.readFileSync(f,'utf8');if(f.endsWith('.json'))scanJson(rel,src,cfg,out);else scanCode(ts,rel,src,cfg,out);}
  return {files:list.length,hits:out};}
module.exports={run,PATTERNS,stripProbes};
if(require.main===module){const r=run();for(const h of r.hits)console.log(`HIT ${h.file}:${h.line} [${h.pattern}] ${JSON.stringify(h.string)}`);
  if(process.argv.includes('--json'))console.log(JSON.stringify(r,null,1));
  console.log((r.hits.length?'FAIL':'PASS')+` dev-wording files=${r.files} hits=${r.hits.length}`);process.exit(r.hits.length?1:0);}
