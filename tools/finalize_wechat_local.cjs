'use strict';
// Run after Creator build, before local DevTools open. Never upload or publish.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'creator-build-project/build/wechat-world-r5-e2fix');
const p=path.join(out,'project.config.json'),config=JSON.parse(fs.readFileSync(p,'utf8'));
assert.equal(config.compileType,'game','Only normalize a mini-game output');
assert.equal(config.appid,'wx3bdd911c5c06f591','Unexpected game AppID');
if(config.condition){
  for(const value of Object.values(config.condition))assert(Array.isArray(value.list)&&value.list.length===0,'Preserve active custom compile conditions; review manually');
  delete config.condition;
}
// Creator already compiles this output. A second DevTools enhancement pass
// produced an unavailable @babel/runtime/helpers/Objectvalues dependency on reopen.
// The independent no-enhancement candidate reached the scene with all audio clips.
config.setting = config.setting || {};
config.setting.enhance = false;
fs.writeFileSync(p,JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({output:out,compileType:config.compileType,emptyCompileConditionsRemoved:!config.condition,enhancementDisabled:config.setting.enhance===false,action:'LOCAL_CONFIG_ONLY'}));
