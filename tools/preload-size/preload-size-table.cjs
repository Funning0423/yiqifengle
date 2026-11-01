#!/usr/bin/env node
// 用法: node preload-size-table.cjs <web构建目录> <TransitionChain.ts 路径> [--md out.md] [--json out.json]
// 统计 PRELOAD_PLAN 每个 bundle 在构建产物 assets/<bundle>/（或 remote/<bundle>/）下的实际大小，对照计划里的 bytes。
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const [,,build,tsPath,...rest]=process.argv;
if(!build||!tsPath){console.error('usage: node preload-size-table.cjs <build> <TransitionChain.ts> [--md f] [--json f]');process.exit(2);}
const opt=k=>{const i=rest.indexOf(k);return i>=0?rest[i+1]:null;};
const src=fs.readFileSync(tsPath,'utf8');const m=src.match(/PRELOAD_PLAN[^=]*=Object\.freeze\(\{([\s\S]*?)\}\);/);
if(!m)throw Error('PRELOAD_PLAN not found');
const plan=[];for(const l of m[1].split('\n')){const t=l.match(/^\s*(\w+):\{stage:'([^']+)'.*?items:\[(.*)\]\}/);if(!t)continue;
 for(const it of t[3].matchAll(/\{bundle:'([^']+)',bytes:(\d+)(?:,prefab:'([^']+)')?\}/g))plan.push({target:t[1],stage:t[2],bundle:it[1],planBytes:+it[2],prefab:it[3]||''});}
function walk(d){let n=0,gz=0,files=0,parts={};if(!fs.existsSync(d))return null;
 (function r(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())r(f);else{const b=fs.readFileSync(f);n+=b.length;gz+=zlib.gzipSync(b,{level:9}).length;files++;
  const k=path.relative(d,f).split(path.sep)[0];const kk=/^(import|native)$/.test(k)?k:'config+index';parts[kk]=(parts[kk]||0)+b.length;}}})(d);return{bytes:n,gzip:gz,files,parts};}
const root=['assets','remote','subpackages'].map(x=>path.join(build,x));
const rows=plan.map(p=>{let s=null,where='';for(const r of root){s=walk(path.join(r,p.bundle));if(s){where=path.relative(build,path.join(r,p.bundle));break;}}
 return {...p,where,actual:s?s.bytes:null,gzip:s?s.gzip:null,files:s?s.files:null,parts:s?s.parts:null,delta:s?s.bytes-p.planBytes:null};});
const kb=v=>v==null?'—':(v/1024).toFixed(1);
let md=`| target | stage | bundle | prefab | 计划 bytes | 实际 bytes | 差值 | 实际 KB | gzip KB | import / native / config+index KB | 文件数 | 位置 |\n|---|---|---|---|---:|---:|---:|---:|---:|---|---:|---|\n`;
for(const r of rows)md+=`| ${r.target} | ${r.stage} | ${r.bundle} | ${r.prefab} | ${r.planBytes} | ${r.actual??'缺'} | ${r.delta??'—'} | ${kb(r.actual)} | ${kb(r.gzip)} | ${r.parts?[kb(r.parts.import||0),kb(r.parts.native||0),kb(r.parts['config+index']||0)].join(' / '):'—'} | ${r.files??'—'} | ${r.where||'未找到'} |\n`;
const tg={};for(const r of rows){tg[r.target]=(tg[r.target]||{plan:0,act:0});tg[r.target].plan+=r.planBytes;tg[r.target].act+=r.actual||0;}
md+=`\n| target 合计 | 计划 MB | 实际 MB |\n|---|---:|---:|\n`;for(const[k,v]of Object.entries(tg))md+=`| ${k} | ${(v.plan/1048576).toFixed(2)} | ${(v.act/1048576).toFixed(2)} |\n`;
console.log(md);if(opt('--md'))fs.writeFileSync(opt('--md'),md);if(opt('--json'))fs.writeFileSync(opt('--json'),JSON.stringify(rows,null,1));
