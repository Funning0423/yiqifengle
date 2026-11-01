(function(){setTimeout(function(){
const q=new URLSearchParams(location.search);const R=window.__churn={done:false,out:[]};
const {director,Scene,Node,Camera,DirectionalLight,MeshRenderer,Material,utils,primitives,Vec3,Color,Layers,Canvas,UITransform,renderer}=cc;
const dev=director.root.device;let cre=0,des=0,live=new Set();
const oc=dev.createTexture.bind(dev);dev.createTexture=function(info){const t=oc(info);if(info&&info.width===2048)R.c2048=(R.c2048||0)+1;if(info&&info.width===1024){cre++;live.add(t);const od=t.destroy.bind(t);t.destroy=function(){if(live.has(t)){des++;live.delete(t);}return od();};}return t;};
const s=new Scene('r');const root=new Node('root');s.addChild(root);
const g=s.globals;g.shadows.enabled=true;g.shadows.type=renderer.scene.ShadowType.ShadowMap;g.shadows.shadowMapSize=1024;
const ln=new Node('sun');root.addChild(ln);const L=ln.addComponent(DirectionalLight);L.shadowEnabled=true;ln.setRotationFromEuler(-50,30,0);
if(q.get('fixed')==='1'){L.shadowFixedArea=true;L.enableCSM=false;}
const cn=new Node('cam');root.addChild(cn);const C=cn.addComponent(Camera);cn.setPosition(5,5,5);cn.lookAt(new Vec3(0,0,0));C.priority=0;C.clearFlags=Camera.ClearFlag.SOLID_COLOR;C.visibility=Layers.Enum.DEFAULT|Layers.Enum.UI_3D;
const mode=q.get('mode')||'one';
if(mode.includes('ui')){const un=new Node('ui');un.layer=Layers.Enum.UI_2D;root.addChild(un);const U=un.addComponent(Camera);U.projection=Camera.ProjectionType.ORTHO;U.priority=1073741824;U.clearFlags=Camera.ClearFlag.DEPTH_ONLY;U.visibility=Layers.Enum.UI_2D;}
if(mode.includes('cam2')){const n2=new Node('c2');root.addChild(n2);const C2=n2.addComponent(Camera);n2.setPosition(-5,5,5);n2.lookAt(new Vec3(0,0,0));C2.priority=5;C2.clearFlags=Camera.ClearFlag.DEPTH_ONLY;C2.visibility=Layers.Enum.DEFAULT;}
if(q.get('fix')==='1'){const sc=document.createElement('script');sc.src='churn_fix.js';sc.onload=()=>window.__fixInstall();document.body.appendChild(sc);}director.runSceneImmediate(s);cc.assetManager.loadBundle('shared_effects',function(){setTimeout(function(){const m=new Material();m.initialize({effectName:'builtin-standard'}); for(const [p,sc] of [[[0,0,0],[10,.1,10]],[[0,1,0],[1,1,1]]]){const n=new Node('m');root.addChild(n);n.setPosition(...p);n.setScale(...sc);const r=n.addComponent(MeshRenderer);r.mesh=utils.MeshUtils?utils.MeshUtils.createMesh(primitives.box()):utils.createMesh(primitives.box());r.shadowCastingMode=1;r.receiveShadow=1;}  start();},1000);});function start(){
const P=director.root.pipeline;R.trace=[];let f=0;const start=director.getTotalFrames();
const tick=()=>{f++;if(f===40&&false){const ex=P._executor;const o=ex._removeDeviceResource.bind(ex);ex._removeDeviceResource=function(){const uses=P.resourceUses.slice();R.same=(ex._context.pipeline===P);R.ctxUses=(ex._context.pipeline&&ex._context.pipeline.resourceUses||[]).slice(0,8);const dt=[...ex._context.deviceTextures.keys()];const r=o();if(R.trace.length<4)R.trace.push({uses,before:dt,after:[...ex._context.deviceTextures.keys()]});return r;};}if(mode.includes('anim'))cn.setPosition(5+Math.sin(f/10),5,5),cn.lookAt(new Vec3(0,0,0));
 if(mode.includes('resize')&&f===80){s.globals.shadows.shadowMapSize=2048;cc.rendering.forceResizeAllWindows();}if(f===90)R.sz=director.root.pipeline.pipelineSceneData.shadows.size.x;
 if(mode.includes('toggle')){C.enabled=(f%2)===0;}
 if(f===30){R.c0=cre;R.d0=des;}if(f===150){R.out.push({sz:R.sz,c2048:R.c2048||0,fix:window.__fixStats&&window.__fixStats(),mode,fixed:q.get('fixed'),warm:{cre:R.c0,des:R.d0},steady120:{creates:cre-R.c0,destroys:des-R.d0},live:live.size,liveMB:live.size*4});R.done=true;director.off(cc.Director.EVENT_AFTER_DRAW,tick);}};
director.on(cc.Director.EVENT_AFTER_DRAW,tick);}
},1500);})();
