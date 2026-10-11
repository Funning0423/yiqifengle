const fs=require('fs'),path=require('path');
const modules=process.env.WORLD_BABEL_MODULES||'/workspace/shared/grok-takeover/gameplay/r4-compat-work/compiler/node_modules';
const parser=require(path.join(modules,'@babel/parser'));
const root=path.join(__dirname,'..'),files=fs.readdirSync(path.join(root,'components')).filter(f=>f.endsWith('.ts'));
for(const file of files)parser.parse(fs.readFileSync(path.join(root,'components',file),'utf8'),{sourceType:'module',plugins:['typescript','decorators-legacy']});
const result={passed:files,method:'Babel TypeScript/decorator grammar parsing; Node strip-types executes core and cc-double boundary. Not TypeScript semantic typecheck or Cocos build.',node:process.version,parserVersion:require(path.join(modules,'@babel/parser/package.json')).version};
fs.writeFileSync(path.join(root,'evidence/syntax.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
