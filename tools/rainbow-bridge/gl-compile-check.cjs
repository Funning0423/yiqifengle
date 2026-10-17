'use strict';
/* Optional real-driver check for the 3.8.8 shdc output: compiles + links every shader variant in headless Chrome (SwiftShader):
 * WebGL1 WITHOUT OES_standard_derivatives (fallback path), WebGL1 WITH it, and WebGL2 (with the "#version 300 es" line the 3.8.8
 * WebGL2 backend prepends, webgl2-commands.ts). Not a Creator build and not a phone GPU — the Mac/真机 run stays the acceptance.
 * Returns {ran:false,reason} when no Chrome is available. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
function chrome(){for(const c of [process.env.QF_CHROME,'/usr/bin/google-chrome','/opt/google/chrome/chrome','/opt/ungoogled-chromium/chrome'])if(c&&fs.existsSync(c))return c;return null;}
function glCompileCheck(shaders){
 const bin=chrome();if(!bin)return {ran:false,reason:'no chrome'};
 const page=`<html><body><pre id=o></pre><script>
var S=JSON.parse(document.getElementById('d')?'[]':'[]');</script><script id=data type=application/json>${JSON.stringify(shaders).replace(/</g,'\\u003c')}</script><script>
S=JSON.parse(document.getElementById('data').textContent);var out=[];
function sh(gl,t,code){var x=gl.createShader(t);gl.shaderSource(x,code);gl.compileShader(x);return [x,gl.getShaderParameter(x,gl.COMPILE_STATUS),gl.getShaderInfoLog(x)||''];}
function run(ver,ext){var c=document.createElement('canvas');var gl=c.getContext(ver===1?'webgl':'webgl2');if(!gl){out.push({mode:'webgl'+ver,ok:false,log:'no context'});return;}
 var mode='webgl'+ver;if(ver===1){var e=ext?!!gl.getExtension('OES_standard_derivatives'):false;mode+=ext?(e?'+derivatives':'+derivatives-unavailable'):'-noderivatives';}
 for(var i=0;i<S.length;i++){var s=S[i],src=ver===1?s.glsl1:{vert:'#version 300 es\\n'+s.glsl3.vert,frag:'#version 300 es\\n'+s.glsl3.frag};
  var v=sh(gl,gl.VERTEX_SHADER,src.vert),f=sh(gl,gl.FRAGMENT_SHADER,src.frag),p=gl.createProgram();gl.attachShader(p,v[0]);gl.attachShader(p,f[0]);gl.linkProgram(p);
  var ok=v[1]&&f[1]&&gl.getProgramParameter(p,gl.LINK_STATUS);out.push({mode:mode,name:s.name,ok:!!ok,log:(v[2]+' '+f[2]+' '+(gl.getProgramInfoLog(p)||'')).trim()});}}
try{run(1,false);run(1,true);run(2,false);}catch(e){out.push({mode:'error',ok:false,log:String(e)});}
document.getElementById('o').textContent='RESULT'+JSON.stringify(out)+'END';
</script></body></html>`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rb-gl-')),file=path.join(dir,'check.html');fs.writeFileSync(file,page);
 try{const r=cp.spawnSync(bin,['--headless=new','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--virtual-time-budget=4000','--user-data-dir='+path.join(dir,'profile'),'--dump-dom','file://'+file],{encoding:'utf8',timeout:60000});
  const m=/RESULT(.*?)END/s.exec(r.stdout||'');if(!m)return {ran:false,reason:'chrome produced no result (status '+r.status+')'};
  const rows=JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));return {ran:true,rows,browser:bin};}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
module.exports={glCompileCheck};
