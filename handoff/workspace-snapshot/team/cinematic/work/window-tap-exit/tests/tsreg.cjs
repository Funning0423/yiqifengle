const ts=require('/home/box/.npm/_npx/5abcb55351612887/node_modules/typescript');const fs=require('fs'),M=require('module');
require.extensions['.ts']=(m,f)=>{const o=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:99,experimentalDecorators:true}}).outputText;m._compile(o,f);};
const r=M._resolveFilename;M._resolveFilename=function(req,...a){try{return r.call(this,req,...a)}catch(e){return r.call(this,req+'.ts',...a)}};
