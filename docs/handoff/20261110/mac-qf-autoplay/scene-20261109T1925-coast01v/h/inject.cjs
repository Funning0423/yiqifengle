#!/usr/bin/env node
'use strict';
// TEST BUILD ONLY. node tools/wx-autoplay/inject.cjs <wechat-build-output> [--script file.json] | --remove
// Copies qf-autoplay.js + qf-autoplay/script.json into the output and makes `require('./qf-autoplay.js')` the first line of
// game.js (backup game.js.qfap-orig). Never run on an output that will be uploaded. check-release.cjs verifies a clean output.
const fs=require('node:fs'),path=require('node:path');
const a=process.argv.slice(2),out=a[0];if(!out){console.error('usage: inject.cjs <out> [--script f] | --remove');process.exit(2);}
const G=path.join(out,'game.js'),B=G+'.qfap-orig',LINE="require('./qf-autoplay.js'); /* QF_AUTOPLAY test build */\n";
if(!fs.existsSync(G)||fs.lstatSync(G).isSymbolicLink()){console.error('REFUSE: '+G+' missing or symlink');process.exit(1);}
if(a.includes('--remove')){if(!fs.existsSync(B)){console.error('REFUSE: no backup');process.exit(1);}fs.renameSync(B,G);fs.rmSync(path.join(out,'qf-autoplay.js'),{force:true});fs.rmSync(path.join(out,'qf-autoplay'),{recursive:true,force:true});console.log('REMOVED');process.exit(0);}
const src=fs.readFileSync(G,'utf8');if(src.includes('QF_AUTOPLAY')){console.error('REFUSE: already injected');process.exit(1);}
const si=a.indexOf('--script'),scriptFile=si>=0?a[si+1]:path.join(__dirname,'examples/example-island.json');
const text=fs.readFileSync(scriptFile,'utf8');require('./qf-autoplay.js').parseScript(text); // validate before writing
fs.copyFileSync(G,B);fs.copyFileSync(path.join(__dirname,'qf-autoplay.js'),path.join(out,'qf-autoplay.js'));
fs.mkdirSync(path.join(out,'qf-autoplay'),{recursive:true});fs.writeFileSync(path.join(out,'qf-autoplay/script.json'),text);
fs.writeFileSync(G,LINE+src);console.log(JSON.stringify({injected:out,script:scriptFile,bytes:fs.statSync(path.join(out,'qf-autoplay.js')).size+text.length+LINE.length}));
