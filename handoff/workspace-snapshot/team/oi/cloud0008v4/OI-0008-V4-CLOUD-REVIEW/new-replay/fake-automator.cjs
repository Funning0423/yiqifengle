'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
module.exports={async connect(){
 const info=JSON.parse(fs.readFileSync(process.env.QF_REVIEW_STATE,'utf8')),project=info.project,sc=process.env.QF_REVIEW_SCENARIO;
 const listeners={console:[],exception:[]};const f=path.join(process.env.QF_DEVTOOLS_LOG_DIR,'WeappLog','review.log');
 const own=line=>project+' '+line;
 function logLine(line){if(sc==='no-logs')return;fs.mkdirSync(path.dirname(f),{recursive:true});fs.appendFileSync(f,line+'\n');}
 function send(type,args){let text=args.map(String).join(' ');for(const cb of listeners.console)cb({type,args});if(sc!=='unrelated-only')logLine(own('['+type+'] '+text));}
 const console={};for(const k of ['error','warn','log','info'])console[k]=(...a)=>send(k,a);
 const wx={onError(cb){wx.err=cb;},onUnhandledRejection(cb){wx.rej=cb;}};
 const context=vm.createContext({console,wx,Date,JSON,Array,Object,String,Math,Set,Map,Error});
 vm.runInContext(fs.readFileSync(path.join(project,'game.js'),'utf8'),context,{timeout:1000});
 const A=vm.runInContext('globalThis.__QF_FIRST_OPEN_AUDIT__',context),token=A.token;
 
 const notice='[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 (env: macOS,mg,2.02.2608080; lib: 3.17.3)';
 if(sc==='known-notice-denied'||sc==='known-notice-allowlisted')logLine(own(notice));
 if(sc==='unattributed-notice-allowlisted')logLine('OTHER-PROJECT '+notice);
 if(sc==='mixed-error-notice-allowlisted')logLine(own('TypeError: actual failure; '+notice));

 if(sc==='unattributed-exact-notice-allowlisted')logLine(notice);
 if(sc==='prefix-error-before-log')logLine(own('TypeError: actual prefix failure [log] harmless'));
 if(sc==='prefix-error-before-canary')logLine(own('TypeError: actual prefix failure [error] [QF-AUDIT-CANARY] '+token));
 if(sc==='prefix-error-before-notice-allowlisted')logLine(own('TypeError: actual prefix failure [error] '+notice));
 if(sc==='prefix-unowned-error-before-log')logLine('OTHER-PROJECT TypeError: unowned prefix failure [log] harmless');
 if(sc==='prefix-benign-before-error')logLine(own('source-prefix [error] plain fatal diagnostic'));
 if(sc==='missing-root-error')logLine(own('[error] TypeError: new root contains startup error'));
 if(sc==='truncate-error'){fs.writeFileSync(f,own('[error] TypeError: after truncation')+'\n');}
 if(sc==='unrelated-only')logLine('OTHER-PROJECT [error] TypeError: unrelated project failure');
 if(sc==='weapp-generic-error')logLine(own('[console.error] Error: ordinary runtime failure'));
 if(sc==='weapp-unclassified-error')logLine(own('[console.error] plain fatal diagnostic'));
 if(sc==='weapp-unattributed-generic')logLine('OTHER-PROJECT [console.error] Error: unattributed ordinary failure');
 if(sc==='weapp-bracket-error')logLine(own('[其他错误] 资源加载失败'));
 if(sc==='canary-mixed-error')logLine(own('[QF-AUDIT-CANARY] '+token+' TypeError: real failure on same line'));
 if(sc==='canary-info-only')A.errors=[];
 if(sc==='tail-rewrite-same-prefix'){
   // Prefix after baseline canary remains; change a previously read later section at same length.
   // Driver handles deterministic direct tailer test separately.
 }
 return {
 on(name,cb){listeners[name].push(cb);},
 async evaluate(fn){
  const result=vm.runInContext('('+fn.toString()+')()',context,{timeout:1000});
  if(sc==='canary-mixed-console' && typeof result==='string'){console.error('[QF-AUDIT-CANARY-LATE] '+token+' TypeError: real error appended');}
  if(sc==='canary-boot-missing' && result&&typeof result==='object'&&'errors' in result){result.errors=result.errors.filter(x=>x.msg.includes('CANARY-LATE'));result.canaryAtBoot=false;}
  if(sc==='utf8-truncated-eof' && result&&typeof result==='object'&&'errors' in result)fs.appendFileSync(f,Buffer.concat([Buffer.from(own('[log] truncated utf8: ')),Buffer.from([0xe4])]));
  if(sc==='utf8-invalid-control' && result&&typeof result==='object'&&'errors' in result)fs.appendFileSync(f,Buffer.concat([Buffer.from(own('[log] invalid utf8: ')),Buffer.from([0xff])]));
  return result;
 },
 async screenshot(){throw Error('fake screenshot unavailable');},disconnect(){}
 };
}};
