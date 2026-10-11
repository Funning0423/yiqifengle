#!/usr/bin/env node
'use strict';
/* L3 (wx.onTouchStart) 生命周期：注册一次、dispose 精确注销同一函数、无 wx / 缺 off / on 抛错时安全降级、dispose 后原始事件无副作用。
 * 用法: T1_FIXTURE=… ROOM_COCOS_CPU=… ROOM_TYPESCRIPT=… node test_l3_lifecycle.cjs <IslandHomeInteraction.ts> */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const {cc,transpile}=require(process.env.T1_FIXTURE);
const src=fs.readFileSync(process.argv[2],'utf8');
function load(wx){const scope={exports:{},require:n=>n==='cc'?cc:{GameAudio:{notifyUserGesture(){}}},console,Math,Number,Promise,Array,globalThis:wx===undefined?{}:{wx}};vm.runInNewContext(transpile(src),scope);return scope.exports.IslandHomeInteraction;}
const opts={canUse:()=>true,hit:()=>true,returnHome:()=>{}};const checks=[];const hasL3=/onTouchStart/.test(src);
{const on=[],off=[];const K=load({onTouchStart:f=>on.push(f),offTouchStart:f=>off.push(f)});const x=new K(new cc.Node('C'),opts);
 if(hasL3){assert.equal(on.length,1);x.dispose();assert.equal(off.length,1);assert.equal(off[0],on[0]);x.dispose();assert.equal(off.length,1);on[0]({touches:[{identifier:9}]});checks.push('registers once; dispose removes the same listener exactly once; post-dispose raw event inert');}
 else{assert.equal(on.length,0);x.dispose();assert.equal(off.length,0);checks.push('L1+L2 variant registers no wx listener');}}
{const K=load(undefined);const x=new K(new cc.Node('C'),opts);x.dispose();checks.push('no wx global: constructs/disposes');}
{const on=[];const K=load({onTouchStart:f=>on.push(f)});const x=new K(new cc.Node('C'),opts);assert.equal(on.length,0);x.dispose();checks.push('wx without offTouchStart: L3 not registered (no leak)');}
{const K=load({onTouchStart:()=>{throw Error('boom')},offTouchStart:()=>{throw Error('should not be called')}});const x=new K(new cc.Node('C'),opts);x.dispose();checks.push('onTouchStart throwing: tolerated, no off call');}
{const on=[];const K=load({onTouchStart:f=>on.push(f),offTouchStart:()=>{}});const x=new K(new cc.Node('C'),opts);if(hasL3){on[0](undefined);on[0]({});on[0]({touches:[null]});}x.dispose();checks.push('malformed raw events ignored');}
console.log(JSON.stringify({pass:true,hasL3,checks},null,1));
