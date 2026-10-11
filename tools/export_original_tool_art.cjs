'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{createCanvas}=require('@napi-rs/canvas');
const source=path.resolve(process.env.QF_ORIGINAL_COMMON||path.join(__dirname,'../../asset-research/CommonR2/fixed/shared'));
const Renderer=require(path.join(source,'renderer')),Treasure=require(path.join(source,'treasure'));
const platform={createCanvas,image:()=>null,size:()=>({dpr:2})};
const renderer=new Renderer(platform,{deferHeavy:true}),treasure=new Treasure(platform),kinds=['bomb','windBell','tideBottle','pearl','tideNet','sunSeed','starShears'];
const canvas=createCanvas(128*kinds.length,128),c=canvas.getContext('2d');
for(let i=0;i<kinds.length;i++){c.save();c.translate(i*128+64,64);if(kinds[i]==='bomb'){c.scale(2,2);renderer.paintStarlight(c);}else if(kinds[i]==='pearl'){c.scale(1.8,1.8);renderer.pearl(c,0,0,{hideBadge:true},0);}else treasure.drawItem(c,kinds[i],0,0,128,{timeMs:0});c.restore();}
const out=path.resolve(__dirname,'../creator-build-project/assets/resources/ui/tools-original.png');fs.writeFileSync(out,canvas.toBuffer('image/png'));
const provenance={source:'CommonR2/fixed/shared, unmodified original Canvas2D art; transparent atlas only',kinds,tileSize:128,width:canvas.width,height:canvas.height,renderer:'@napi-rs/canvas '+require('@napi-rs/canvas/package.json').version,sources:Object.fromEntries(['renderer.js','treasure.js','regional-art.js','regional-content.js','piece-themes.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(source,file))).digest('hex')])),outputSha256:crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex')};
fs.mkdirSync(path.resolve(__dirname,'../evidence/tool-switch'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../evidence/tool-switch/original-art-provenance.json'),JSON.stringify(provenance,null,2)+'\n');console.log(provenance);
