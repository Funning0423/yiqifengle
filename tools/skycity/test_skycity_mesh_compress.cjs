#!/usr/bin/env node
'use strict';
// Skycity mesh size step 1 (lossless): Creator 3.8.8 glTF importer meshCompress.compress (zlib, inflated at load by the core engine).
// encode needs the culled engine module "meshopt"; quantize stores RGB16F (half-float) positions = up to 6 cm error on the 75 m palette mesh,
// so both stay off until a Mac visual check. No GLB, texture or material change.
const fs=require('fs'),path=require('path'),assert=require('assert');
const P=path.resolve(__dirname,'../../creator-build-project'),m=JSON.parse(fs.readFileSync(P+'/assets/bundles/region_skycity/env_skycity.glb.meta','utf8'));
assert.deepStrictEqual(m.userData.meshCompress,{enable:true,compress:true,encode:false,quantize:false});
assert.equal(m.userData.tangents,1,'tangent import unchanged');
const eng=JSON.parse(fs.readFileSync(P+'/settings/v2/packages/engine.json','utf8'));
// v3.3 (GGbot): the meshopt module is now ON for the lakeside GLBs (encode:true); skycity keeps compress-only above (no visual re-check needed).
assert.equal(eng.modules.configs.defaultConfig.cache.meshopt._value,true,'meshopt module present (lakeside v3.3)');
console.log('PASS skycity meshCompress lossless (compress only)');
