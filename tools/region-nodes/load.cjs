'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const ROOT=path.resolve(__dirname,'../..');
const SCRIPTS=path.join(ROOT,'creator-build-project/assets/scripts');
const cache=new Map();
const cc={_decorator:{ccclass:()=>c=>c,property:()=>()=>{}},Component:class{},Node:class{},Color:class{constructor(){}},Graphics:class{},UITransform:class{},input:{on(){},off(){}},Input:{EventType:{}},EventTouch:class{}};
function load(rel){
 const file=path.isAbsolute(rel)?rel:path.join(SCRIPTS,rel);
 if(cache.has(file))return cache.get(file).exports;
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const m={exports:{}};cache.set(file,m);
 const req=spec=>{
  if(spec==='cc')return cc;
  if(!spec.startsWith('.'))return require(spec);
  const abs=path.resolve(path.dirname(file),spec);
  const tsFile=fs.existsSync(abs+'.ts')?abs+'.ts':abs.endsWith('.ts')?abs:null;
  if(tsFile&&fs.existsSync(tsFile))return load(tsFile);
  if(fs.existsSync(abs+'.js'))return require(abs+'.js');
  if(fs.existsSync(abs))return require(abs);
  throw Error('Cannot resolve '+spec+' from '+file);
 };
 vm.runInNewContext(out,{module:m,exports:m.exports,require:req,console,Math,Date,JSON,Set,Map,Array,Object,Error,Promise,isFinite,Number,String,RegExp,setTimeout,clearTimeout},{filename:file});
 return m.exports;
}
module.exports={load,ROOT,SCRIPTS};
