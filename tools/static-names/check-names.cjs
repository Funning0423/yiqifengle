#!/usr/bin/env node
'use strict';
// cand10 whole-project static gate (运镜bot 1db60f60: RegionJourneyAdapter used basketCloseSpot / basketClosePose / boardFeetAt /
// SKYCITY_LENS_OCCLUDERS without importing them; the cc-free proxy tests never type-check, so it only threw ReferenceError on device).
// Runs the TypeScript compiler over every creator-build-project/assets/**/*.ts. 'cc' has no typings in the repo (the Creator
// temp/ declarations are not committed), so it is a shorthand ambient module (every import any). GATED (fail): undefined names
// and unresolved imports / missing exports. Every other diagnostic is counted and reported only (strict:false project, any-typed cc).
const fs=require('fs'),path=require('path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const R=path.resolve(__dirname,'../..'),A=R+'/creator-build-project/assets';
const GATE=new Map([[2304,'Cannot find name'],[2552,'Cannot find name (did you mean)'],[2307,'Cannot find module'],[2305,'Module has no exported member'],
 [2724,'No exported member (did you mean)'],[2614,'No exported member (default import?)'],[2503,'Cannot find namespace'],[2582,'Cannot find name (test globals)'],[2580,'Cannot find name (node globals)'],[1192,'Module has no default export'],[2613,'Module has no default export (named)']]);
const files=[],jsFiles=[];(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.ts')&&!e.name.endsWith('.d.ts'))files.push(p);else if(e.name.endsWith('.js'))jsFiles.push(p);}})(A);
const STUB=path.join(R,'tools/static-names/cc-shorthand.d.ts');
const opts={target:ts.ScriptTarget.ES2019,module:ts.ModuleKind.ES2015,moduleResolution:ts.ModuleResolutionKind.Node10??ts.ModuleResolutionKind.NodeJs,experimentalDecorators:true,
 strict:false,noEmit:true,skipLibCheck:true,allowJs:false,lib:['lib.es2020.d.ts','lib.dom.d.ts'],types:[],allowSyntheticDefaultImports:true,esModuleInterop:true,resolveJsonModule:true};
const prog=ts.createProgram([...files,STUB],opts);
const diags=[...prog.getSyntacticDiagnostics(),...prog.getSemanticDiagnostics()];
const gated=[],other=new Map();
for(const d of diags){const f=d.file?path.relative(R,d.file.fileName):'(global)';const pos=d.file&&d.start!=null?d.file.getLineAndCharacterOfPosition(d.start):null;
 const msg=ts.flattenDiagnosticMessageText(d.messageText,' ');
 if(GATE.has(d.code)&&!/\.js['"]?\.?$|\.js'/.test(msg))gated.push(`${f}:${pos?pos.line+1:0}:${pos?pos.character+1:0} TS${d.code} ${msg}`);
 else other.set(d.code,(other.get(d.code)||0)+1);}
// JS runtime modules (mainline-r1 / r4-cloud-compat / regional-r05 / world-r2): same undefined-name / unresolved-import gate via checkJs.
const jprog=ts.createProgram([...jsFiles,STUB],{...opts,allowJs:true,checkJs:true});let jsOther=0;
for(const d of [...jprog.getSyntacticDiagnostics(),...jprog.getSemanticDiagnostics()]){if(!d.file||!d.file.fileName.endsWith('.js')){continue;}
 const f=path.relative(R,d.file.fileName),pos=d.file.getLineAndCharacterOfPosition(d.start||0),msg=ts.flattenDiagnosticMessageText(d.messageText,' ');
 if(GATE.has(d.code))gated.push(`${f}:${pos.line+1}:${pos.character+1} TS${d.code} ${msg}`);else jsOther++;}
const total=[...other.values()].reduce((a,b)=>a+b,0);
const out={files:files.length,jsFiles:jsFiles.length,jsOtherDiagnostics:jsOther,gated:gated.length,otherDiagnostics:total,otherByCode:Object.fromEntries([...other].sort((a,b)=>b[1]-a[1]))};
if(gated.length){console.log(gated.join('\n'));console.log(JSON.stringify({result:'FAIL',...out}));process.exit(1);}
console.log(JSON.stringify({result:'PASS',...out}));
