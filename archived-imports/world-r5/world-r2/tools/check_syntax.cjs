const fs=require('fs'),path=require('path'),parser=require('/workspace/shared/grok-takeover/gameplay/r4-compat-work/compiler/node_modules/@babel/parser'),{patchNativeUI,SOURCE}=require('./patch_native_ui.cjs');
const root=path.resolve(__dirname,'..'),files=fs.readdirSync(path.join(root,'components')).filter(f=>f.endsWith('.ts'));
for(const name of files)parser.parse(fs.readFileSync(path.join(root,'components',name),'utf8'),{sourceType:'module',plugins:['typescript','decorators-legacy']});
parser.parse(patchNativeUI(fs.readFileSync(SOURCE,'utf8')),{sourceType:'module',plugins:['typescript','decorators-legacy']});
const receipt={files,nativeManagedPatch:'PASS',method:'Babel TypeScript grammar only; not semantic typecheck or official Cocos compiler',node:process.version};fs.writeFileSync(path.join(root,'evidence/syntax.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
