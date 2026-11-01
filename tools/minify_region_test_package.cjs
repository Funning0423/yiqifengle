'use strict';
// Formatting only: no compression, mangling, property renaming or DEBUG replacement.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const terser=require(process.env.QF_TERSER_MODULE);
(async()=>{const root=path.resolve('../native-package'),changes=[];
for(const file of ['cocos-js/cc.js','subpackages/main/game.js']){
 const p=path.join(root,file),before=fs.readFileSync(p,'utf8'),result=await terser.minify(before,{compress:false,mangle:false,format:{comments:false}});if(result.error)throw result.error;fs.writeFileSync(p,result.code);
 changes.push({file,beforeBytes:Buffer.byteLength(before),afterBytes:Buffer.byteLength(result.code),beforeSHA256:crypto.createHash('sha256').update(before).digest('hex'),afterSHA256:crypto.createHash('sha256').update(result.code).digest('hex')});}
fs.writeFileSync('../evidence/test-package-formatting.json',JSON.stringify({formattingOnly:true,compress:false,mangle:false,changes},null,2));console.log(changes);})().catch(e=>{console.error(e);process.exitCode=1});
