#!/usr/bin/env node
// 用法: node estimate_size.cjs <baseline-tree> <scratch含 full-l123/full-l12>；只用 tools/vendor-node 的 typescript/terser。
const path=require('path'),NM=path.resolve(__dirname,'../vendor-node/node_modules'),ts=require(NM+'/typescript'),{minify}=require(NM+'/terser'),fs=require('fs');const [BASE,SCR]=process.argv.slice(2);
const S='creator-build-project/assets/scripts/';const files=['WorldIntegrationBoot.ts','world-r1/WorldFlowComponent.ts','world-r2/IslandJourneyOverlay.ts','world-r2/IslandHomeInteraction.ts'];
async function size(p){if(!fs.existsSync(p))return 0;const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.System,target:ts.ScriptTarget.ES2015,experimentalDecorators:true}}).outputText;return (await minify(js,{compress:true,mangle:true})).code.length;}
(async()=>{const out={};for(const v of ['l123','l12']){let tot=0;const rows={};for(const f of files){const a=await size(BASE+'/'+S+f),b=await size(`${SCR}/full-${v}/`+S+f);rows[f]={before:a,after:b,delta:b-a};tot+=b-a;}out[v]={rows,minifiedJsDelta:tot};}console.log(JSON.stringify(out,null,1));})();
