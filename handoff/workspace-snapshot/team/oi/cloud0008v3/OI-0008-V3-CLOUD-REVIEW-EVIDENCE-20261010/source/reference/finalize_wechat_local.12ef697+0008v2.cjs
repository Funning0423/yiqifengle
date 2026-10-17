'use strict';
// Run after Creator build, before local DevTools open. Never upload or publish.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(process.argv[2]||'creator-build-project/build/wechat-world-r5-e2fix');
const p=path.join(out,'project.config.json'),before=fs.readFileSync(p,'utf8'),config=JSON.parse(before);
assert.equal(config.compileType,'game','Only normalize a mini-game output');
assert.equal(config.appid,'wx3bdd911c5c06f591','Unexpected game AppID');
// 0008 v2: record exactly what is removed (Creator 3.8.8 template: game {currentL:-1,list:[],current:-1},
// search/conversation/miniprogram {current:-1,list:[]}) so first-open audits can cite the original fields.
const removedCondition=config.condition===undefined?null:config.condition;
if(config.condition){
  for(const value of Object.values(config.condition))assert(value&&typeof value==='object'&&Array.isArray(value.list)&&value.list.length===0,'Preserve active custom compile conditions; review manually');
  delete config.condition;
}
// Creator already compiles this output. A second DevTools enhancement pass
// produced an unavailable @babel/runtime/helpers/Objectvalues dependency on reopen.
// The independent no-enhancement candidate reached the scene with all audio clips.
config.setting = config.setting || {};
config.setting.enhance = false;
// Idempotent: write only a real change (re-running on finalized output leaves the file untouched).
const after=JSON.stringify(config,null,2)+'\n',changed=after!==before;
if(changed)fs.writeFileSync(p,after);
console.log(JSON.stringify({output:out,compileType:config.compileType,emptyCompileConditionsRemoved:!config.condition,enhancementDisabled:config.setting.enhance===false,removedCondition,changed,action:'LOCAL_CONFIG_ONLY'}));
