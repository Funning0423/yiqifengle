#!/usr/bin/env node
'use strict';
// Cloud-only fixture. Handles test islogin/auto/close; never launches a browser.
const fs=require('node:fs'),path=require('node:path');
const [cmd,...args]=process.argv.slice(2), p=args[args.indexOf('--project')+1],state=process.env.QF_REVIEW_STATE,sc=process.env.QF_REVIEW_SCENARIO;
fs.appendFileSync(state+'.actions',JSON.stringify({cmd,project:p||null})+'\n');
if(cmd==='islogin'){console.log('fake logged in');process.exit(0);}
if(cmd==='auto'){
 fs.writeFileSync(state,JSON.stringify({project:p}));
 if(sc==='cli-error-tag')console.error('[console.error] plain fatal diagnostic');
 if(sc==='cli-error-prefix')console.error('[error] plain fatal diagnostic');
 if(sc==='cli-warning-tag')console.error('[warn] harmless diagnostic');
 if(sc==='cli-generic-error')console.error('Error: ordinary launch failure');
 if(sc==='cli-exit7')process.exit(7);
 if(sc==='cli-lingers-error'){console.error('TypeError: late CLI error');setTimeout(()=>process.exit(0),2200);return;}
 if(sc==='cli-lingers-clean'){setTimeout(()=>process.exit(0),2200);return;}
 process.exit(0);
}
if(cmd==='close'){if(sc==='close-exit5')process.exit(5);process.exit(0);}
throw Error('Test CLI refuses all other commands');
