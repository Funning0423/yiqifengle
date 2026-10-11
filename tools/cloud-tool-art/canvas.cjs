'use strict';
// Prefer the caller's explicit module or normal local dependency; cloud path is only a fallback.
if(process.env.QF_CANVAS_MODULE)module.exports=require(process.env.QF_CANVAS_MODULE);
else {try{module.exports=require('@napi-rs/canvas')}catch(error){const p='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas';if(require('fs').existsSync(p))module.exports=require(p);else throw Error('Offline material tests need @napi-rs/canvas. Point QF_CANVAS_MODULE at its existing local installation; no automatic install is performed.')}}
