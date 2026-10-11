'use strict';
// Exhaustive parser checks for shipped implementation sources. This is NOT Creator type checking.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'../creator-build-project/assets/scripts');
const ts=[],js=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.ts')&&!p.endsWith('.d.ts'))ts.push(p);else if(p.endsWith('.js'))js.push(p);}}
walk(root);
for(const p of ts){const s=fs.readFileSync(p,'utf8').replace(/@ccclass\([^\n]*\)/g,'').replace(/@property\([^\n]*?\)/g,'');stripTypeScriptTypes(s,{mode:'transform'});}
for(const p of js){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});assert.equal(r.status,0,p+'\n'+r.stderr);}
console.log(JSON.stringify({status:'PASS',typescriptImplementationFiles:ts.length,javascriptImplementationFiles:js.length,creatorTypecheck:'NOT_RUN',scope:'Parser validation of all TS implementations and JS engine/runtime sources; no semantic/Creator compilation claim'},null,2));
