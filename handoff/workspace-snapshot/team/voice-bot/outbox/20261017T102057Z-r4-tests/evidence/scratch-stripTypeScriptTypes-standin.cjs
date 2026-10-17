const m=require('node:module');const ts=require(process.env.QF_TYPESCRIPT_MODULE);
if(!m.stripTypeScriptTypes)m.stripTypeScriptTypes=(s)=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None,experimentalDecorators:true}}).outputText;
