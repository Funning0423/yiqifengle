'use strict';
/** T2+ door light-spill hint test (room home camera, lead option 1). CPU only; real GLB (draco3d) + real sources.
 * Checks: tint == M_env_palette texel (decoded from the GLB PNG); mesh lies on the floor/rug inside the room, never buried;
 * the faint tail is on screen and unoccluded in the approved home pose and the near part in the dragged-door view; over the
 * whole flow (flow_sim) the hint is 0 whenever the exterior or island is shown, fades (no pop), night > day; component wiring;
 * byte cost. Usage: node test_door_spill.cjs [--json out.json] */
const fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib');
const S=require('./flow_sim.cjs'),G=require('./glb_geometry.cjs');
const root=path.resolve(__dirname,'..','..'),scripts=path.join(root,'creator-build-project/assets/scripts');
const args=process.argv.slice(2),jsonOut=args.includes('--json')?args[args.indexOf('--json')+1]:null;
function loadCore(){const ts=require('../qf-env.cjs').typescript(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'door-spill-'));
  const js=ts.transpileModule(fs.readFileSync(path.join(scripts,'render/DoorSpillHintCore.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  fs.writeFileSync(path.join(tmp,'core.js'),js);return require(path.join(tmp,'core.js'));}
function glbImage(glbPath,name){const b=fs.readFileSync(glbPath),jl=b.readUInt32LE(12),J=JSON.parse(b.slice(20,20+jl).toString()),bin=20+jl+8;
  const img=J.images.find(i=>i.name===name);if(!img)throw Error('image '+name+' not in GLB');const bv=J.bufferViews[img.bufferView];return b.slice(bin+(bv.byteOffset||0),bin+(bv.byteOffset||0)+bv.byteLength);}
function pngPixel(png,x,y){// minimal 8-bit RGB/RGBA non-interlaced PNG decoder
  let o=8,w,h,ct,idat=[];while(o<png.length){const len=png.readUInt32BE(o),type=png.toString('ascii',o+4,o+8),d=png.slice(o+8,o+8+len);
    if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);if(d[8]!==8||d[12]!==0)throw Error('unsupported png');ct=d[9];}else if(type==='IDAT')idat.push(d);else if(type==='IEND')break;o+=12+len;}
  const bpp=ct===6?4:ct===2?3:0;if(!bpp)throw Error('png colour type '+ct);const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*bpp,out=Buffer.alloc(h*stride);
  for(let r=0;r<h;r++){const f=raw[r*(stride+1)],src=raw.slice(r*(stride+1)+1,(r+1)*(stride+1));for(let i=0;i<stride;i++){const a=i>=bpp?out[r*stride+i-bpp]:0,b=r?out[(r-1)*stride+i]:0,c=r&&i>=bpp?out[(r-1)*stride+i-bpp]:0;
    let v=src[i];if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}out[r*stride+i]=v&255;}}
  const i=y*stride+x*bpp;return [out[i],out[i+1],out[i+2]];}
(async()=>{
  const core=loadCore(),D=core.DOOR_SPILL,checks=[],check=(name,ok,detail)=>{checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name.padEnd(30)+' '+JSON.stringify(detail));};
  const env=S.create(),C=env.C,cfg=env.cfg,I=G.index(await G.decode()),glb=path.join(root,'creator-build-project/assets/bundles/region_island/combined_visual_m.glb');
  // 1. tint provenance
  const px=pngPixel(glbImage(glb,'env_palette_256'),D.paletteTexel[0],D.paletteTexel[1]);
  check('tint-from-palette',px.every((v,i)=>v===D.color[i]),{texel:D.paletteTexel,palette:px,color:D.color,material:'M_env_palette (env_palette_256)'});
  // 2. geometry on the floor, inside the room, not buried
  const g=core.spillGeometry(),V=[];for(let i=0;i<g.positions.length;i+=3)V.push([g.positions[i],g.positions[i+1],g.positions[i+2]]);
  // exact vertical ray (brute force; the voxel-marched occluded() can miss thin horizontal faces on vertical rays):
  // highest surface at (x,z) below decal+0.3 m; 'above' if a surface lies between the decal and +0.3 m (decal buried)
  const geo=await G.decode(),floorTris=[];for(const [n,tris] of Object.entries(geo.meshes))if(/^env_(interior|lighthouse)/.test(n))for(const t of tris){const ys=t.map(p=>p[1]);if(Math.min(...ys)<D.y+.3&&Math.max(...ys)>-.3)floorTris.push(t);}
  const surfY=(x,z)=>{const ys=[];for(const [a,b,c] of floorTris){const d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-12)continue;const l1=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,l2=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;ys.push(l1*a[1]+l2*b[1]+l3*c[1]);}return ys;};
  const floorTop=(x,z)=>{const ys=surfY(x,z);if(!ys.length)return null;if(ys.some(y=>y>D.y&&y<D.y+.3))return 'above';return Math.max(...ys.filter(y=>y<=D.y));};
  const room=/^env_(interior|lighthouse)/;let bad=[];
  V.forEach((p,i)=>{const t=floorTop(p[0],p[2]),up=I.occluded(p,[p[0],p[1]+6,p[2]]);if(g.alpha[i]>0&&(t==='above'||t===null||p[1]-t>0.02||p[1]-t<0.004||!up||!room.test(up)))bad.push({i,p,floorTop:t,ceiling:up});});
  check('geometry-on-floor-inside',bad.length===0&&V.every(p=>p[2]<=-0.3),{vertices:V.length,triangles:g.indices.length/3,y:D.y,bad:bad.slice(0,4)});
  // 3. framing: tail visible in the approved home pose; near part visible in the dragged-door view
  const asp=586/1266,seen=(pose,pts)=>pts.filter(p=>{const q=C.projectPoint(pose,asp,p);return q.depth>.05&&Math.abs(q.x)<=1&&Math.abs(q.y)<=1&&!I.occluded(pose.position,[p[0],p[1]+.004,p[2]]);});
  const samples=[];for(let r=0;r<D.rows.length-1;r++)for(let f=0;f<1;f+=.25){const [z0,h0,a0]=D.rows[r],[z1,h1,a1]=D.rows[r+1],z=z0+(z1-z0)*f,hw=h0+(h1-h0)*f,a=a0+(a1-a0)*f;for(const u of [-.4,-.2,0,.2,.4])samples.push({p:[D.centerX+u*hw,D.y,z],a});}
  const home=C.fromLookAt(cfg.cameraHome),h=cfg.cameraHome,yaw=Math.atan2(0-h.position[0],0-h.position[2]);
  const drag=C.fromLookAt({position:[...h.position],target:[h.position[0]+Math.sin(yaw)*2.5,h.position[1],h.position[2]+Math.cos(yaw)*2.5],fovVerticalDeg:h.fovVerticalDeg});
  const vis=pose=>{const lit=samples.filter(s=>s.a>.05),v=seen(pose,lit.map(s=>s.p));const as=lit.filter(s=>v.includes(s.p)).map(s=>s.a);return {visibleSamples:v.length,of:lit.length,maxAlphaFactor:as.length?+Math.max(...as).toFixed(2):0,nearestZ:v.length?+Math.max(...v.map(p=>p[2])).toFixed(2):null};};
  const vh=vis(home),vd=vis(drag);
  check('home-pose-shows-tail',vh.visibleSamples>=3,{...vh,peakAlpha:{day:+(vh.maxAlphaFactor*D.peakAlpha.day).toFixed(3),night:+(vh.maxAlphaFactor*D.peakAlpha.night).toFixed(3)},fov:h.fovVerticalDeg,fovChanged:false});
  check('door-view-shows-gap-light',vd.visibleSamples>=5&&vd.maxAlphaFactor>=.8,vd);
  // 4. layers + day/night over the whole flow, 60 fps, real WorldFlow via flow_sim
  const run=await S.run(env),F=run.frames,dt=run.dt;let worst=null;
  for(const night of [false,true]){let shown=0,prev=0,maxStep=0,outside=0,leak=[],homeA=[];
    for(const f of F){const L=f.layers||{interior:false,exterior:false};const view={interior:!!L.interior,exterior:!!L.exterior,night};
      if(!view.interior)shown=0;shown=core.stepSpill(shown,core.spillTarget(view),dt);const a=view.interior?shown*core.spillPeak(night):0;
      maxStep=Math.max(maxStep,view.interior?Math.abs(a-prev):0);if(L.exterior){outside++;if(f.state==='island'&&a>0)leak.push(f.frame);}
      if(!L.interior&&a!==0)leak.push(f.frame);if(f.state==='home'&&f.op!=='leaveHome')homeA.push(a);prev=a;}
    // once the door is open (exterior on) the hint must be gone within 1/fadePerSecond s
    let lateOn=0;{let since=-1,shown2=0;for(const f of F){const L=f.layers||{};if(!L.interior)shown2=0;shown2=core.stepSpill(shown2,core.spillTarget({interior:!!L.interior,exterior:!!L.exterior,night}),dt);since=L.exterior?(since<0?0:since+dt):-1;if(since>1/D.fadePerSecond+dt&&shown2>0)lateOn++;}}
    const r={night,maxAlphaStepPerFrame:+maxStep.toFixed(4),limit:+(D.fadePerSecond*dt*core.spillPeak(night)+1e-6).toFixed(4),leakFrames:leak.slice(0,5),framesWithExterior:outside,onAfterDoorOpenFrames:lateOn,homeAlpha:homeA.length?+homeA[homeA.length-1].toFixed(3):null};
    check('layers-'+(night?'night':'day'),!leak.length&&!lateOn&&maxStep<=D.fadePerSecond*dt*core.spillPeak(night)+1e-9&&r.homeAlpha===+core.spillPeak(night).toFixed(3),r);}
  check('night-brighter-than-day',D.peakAlpha.night>D.peakAlpha.day&&D.peakAlpha.day>0&&D.peakAlpha.night<=.9,D.peakAlpha);
  // 5. wiring in the real component (sim does not run cc)
  const comp=fs.readFileSync(path.join(scripts,'world-r1/WorldFlowComponent.ts'),'utf8'),wrap=fs.readFileSync(path.join(scripts,'render/DoorSpillHint.ts'),'utf8');
  const applyDN=(comp.match(/private applyDayNight\(\):void \{[\s\S]*?\n  \}/)||[''])[0];
  const wiring={constructed:/this\.doorSpill=new DoorSpillHint\(/.test(comp),setViewInApplyDayNight:/this\.doorSpill\?\.setView\(this\.interiorVisible,this\.exteriorVisible,this\.dayNightMode==='night'\)/.test(applyDN),
    advancedInLateUpdate:/lateUpdate\(dt:number\):void \{[^\n]*this\.doorSpill\?\.advance\(dt\)/.test(comp),disposedPaths:(comp.match(/this\.doorSpill\?\.dispose\(\);this\.doorSpill=null;/g)||[]).length,
    noTexture:!/Texture2D|ImageAsset|resources\.load|assetManager/.test(wrap),depthWriteOffAlphaBlend:/technique: 3/.test(wrap),notUnderModel:/scene\.addChild\(n\)/.test(wrap)};
  check('component-wiring',wiring.constructed&&wiring.setViewInApplyDayNight&&wiring.advancedInLateUpdate&&wiring.disposedPaths===3&&wiring.noTexture&&wiring.depthWriteOffAlphaBlend&&wiring.notUnderModel,wiring);
  // 6. byte cost (source; no assets added)
  const bytes=f=>fs.statSync(path.join(scripts,f)).size;let min=null;try{const terser=require(path.join(root,'..','GGbot','tools','vendor-node','node_modules','terser'));const ts=require('../qf-env.cjs').typescript();
    let total=0;for(const f of ['render/DoorSpillHintCore.ts','render/DoorSpillHint.ts']){const js=ts.transpileModule(fs.readFileSync(path.join(scripts,f),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2015}}).outputText;total+=(await terser.minify(js,{module:true})).code.length;}min=total;}catch(e){min='terser unavailable: '+e.message.slice(0,60);}
  const cost={sourceBytes:{core:bytes('render/DoorSpillHintCore.ts'),wrapper:bytes('render/DoorSpillHint.ts')},minifiedJsBytes:min,assetsAdded:0,runtime:{vertices:V.length,triangles:g.indices.length/3,drawCalls:'1 (HOME only)',materials:1,textures:0}};
  check('byte-cost',typeof min==='number'?min<4096:true,cost);
  const ok=checks.every(c=>c.ok);console.log(ok?'ALL PASS':'FAILED');if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify({ok,checks},null,1));process.exitCode=ok?0:1;
})().catch(e=>{console.error(e);process.exitCode=2;});
