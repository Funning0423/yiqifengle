'use strict';
// P1 night magenta / GL_INVALID_ENUM glDepthFunc 0x0000 on the meadow→skycity balloon leg.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../creator-build-project/assets');
const src=fs.readFileSync(path.join(root,'scripts/region/BalloonTransit.ts'),'utf8');
const VALID=['never','less','equal','less_equal','greater','not_equal','greater_equal','always'];
// 1) balloon-grade.effect: every pass that sets depthStencilState names a valid depthFunc; uuid matches the meta.
const eff=fs.readFileSync(path.join(root,'bundles/region_transit_balloon/balloon-grade.effect'),'utf8');
const blocks=eff.split(/depthStencilState:/).slice(1);
assert.equal(blocks.length,2,'two grade passes');
for(const b of blocks){const m=/depthFunc:\s*(\w+)/.exec(b.split(/\n\s*- (?:name|vert)/)[0]);assert.ok(m&&VALID.includes(m[1]),'grade pass depthFunc: '+(m&&m[1]));}
const meta=JSON.parse(fs.readFileSync(path.join(root,'bundles/region_transit_balloon/balloon-grade.effect.meta'),'utf8'));
assert.equal(meta.importer,'effect');assert.equal(meta.uuid,'c25f1a80-7e14-4b2a-9d63-0e8b7a41c6d2');
assert.ok(/bundle\.load\('balloon-grade',EffectAsset/.test(src),'grade effect loaded by name from region_transit_balloon');
// 2) skybox(): numeric depthFunc in 0..7, applied once per instance, glTF albedo rebound.
const sky=src.slice(src.indexOf('export const SKY_DEPTH_FUNC'),src.indexOf('function showBothSides'));
const fn=new Function('gfx',/SKY_DEPTH_FUNC:number=([^;]+);/.exec(sky)[1].replace(/^/,'return ').replace(/\(gfx as any\)/g,'(gfx)'));
assert.equal(fn({ComparisonFunc:{LEQUAL:3}}),3);assert.equal(fn(undefined),3,'fallback when gfx enum absent');assert.equal(fn({}),3);
assert.ok(/depthFunc:SKY_DEPTH_FUNC/.test(sky)&&!/depthFunc:gfx\./.test(sky),'skybox uses the guarded constant');
assert.ok(/skyboxed\.has\(m\)/.test(sky),'skybox idempotent per material instance');
assert.ok(/'mainTexture','albedoMap'/.test(sky)&&/m\.setProperty\(key,tex\)/.test(sky),'glTF albedo rebound on the instance');
// 3) no per-frame skybox on the night dome.
const paint=src.slice(src.indexOf('const paint='),src.indexOf('offNight=onDayNightChange'));
assert.ok(!/skybox\(nightDome\)/.test(paint),'paint() must not re-run skybox on the night dome every frame');
assert.ok(/skybox\(nightDome\)/.test(src),'night dome still skyboxed once at mount');
// 4) no depthStencilState override in BalloonTransit leaves depthFunc undefined.
for(const m of src.matchAll(/depthStencilState:\{([^}]*)\}/g))assert.ok(/depthFunc:/.test(m[1]),'partial depthStencilState: '+m[0]);
console.log(JSON.stringify({ok:true,gradeUuid:meta.uuid}));
