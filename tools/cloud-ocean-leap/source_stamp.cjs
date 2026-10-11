'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const root=process.env.QF_OCEAN_SOURCE_ROOT||path.resolve(__dirname,'../..');
function read(){return Object.fromEntries(['OriginalLevelBackground.ts','OriginalLevelEnvironment.ts'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/world-r2',n))).digest('hex')]))}
const source=read();
module.exports={source,verify(){assert.deepEqual(read(),source,'Production source changed during test');return source;}};
