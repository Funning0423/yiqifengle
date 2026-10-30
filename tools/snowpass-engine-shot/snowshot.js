(function(){
const q=new URLSearchParams(location.search);const S=window.__snow={ready:false,log:[],pieces:[]};
const L=(...a)=>{S.log.push(a.join(' '));console.log('[snow]',...a);};
const {director,Scene,Node,Camera,DirectionalLight,MeshRenderer,Material,assetManager,Vec3,Color,utils,primitives,Texture2D,ImageAsset,geometry}=cc;
const loadB=n=>new Promise((ok,no)=>assetManager.loadBundle(n,(e,b)=>e?no(e):ok(b)));
const ld=(b,p,t)=>new Promise((ok,no)=>b.load(p,t,(e,a)=>e?no(e):ok(a)));
const KINDS=['strawberry','leaf','blueberry','flower','acorn','shell'];
const AID=(q.get('aid')||'').split(',').filter(Boolean);           // kinds that get the dark outline + slate base
const NOP=q.get('nopieces')==='1';
function mat(col,opt={}){const m=new Material();m.initialize({effectName:opt.unlit?'builtin-unlit':'builtin-standard',technique:opt.blend?1:0,
  defines:Object.assign({},opt.tex?(opt.unlit?{USE_TEXTURE:true}:{USE_ALBEDO_MAP:true}):{},opt.alpha?{USE_ALPHA_TEST:true}:{})});
  if(opt.unlit)m.setProperty('mainColor',col);else{m.setProperty('mainColor',col);m.setProperty('roughness',opt.rough??0.85);m.setProperty('metallic',0);}
  if(opt.tex)m.setProperty(opt.unlit?'mainTexture':'mainTexture',opt.tex);return m;}
function box(parent,name,size,pos,m,cast=true){const n=new Node(name);parent.addChild(n);n.setPosition(pos);const r=n.addComponent(MeshRenderer);
  r.mesh=utils.MeshUtils.createMesh(primitives.box({width:size[0],height:size[1],length:size[2]}));r.setMaterial(m,0);r.shadowCastingMode=cast?1:0;r.receiveShadow=1;return n;}
function cyl(parent,name,rad,h,pos,m){const n=new Node(name);parent.addChild(n);n.setPosition(pos);const r=n.addComponent(MeshRenderer);
  r.mesh=utils.MeshUtils.createMesh(primitives.cylinder(rad,rad*0.92,h,{radialSegments:28}));r.setMaterial(m,0);r.shadowCastingMode=1;r.receiveShadow=1;return n;}
function quad(parent,name,w,h,m,cast){const n=new Node(name);parent.addChild(n);const r=n.addComponent(MeshRenderer);
  r.mesh=utils.MeshUtils.createMesh(primitives.quad());n.setScale(w,h,1);r.setMaterial(m,0);r.shadowCastingMode=cast?1:0;r.receiveShadow=cast?1:0;return n;}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'));const t=new Texture2D();t.image=new ImageAsset(c);return t;}
function outlined(img){return canvasTex(img.width+24,img.height+24,g=>{const o=document.createElement('canvas');o.width=img.width;o.height=img.height;const og=o.getContext('2d');
  og.drawImage(img,0,0);og.globalCompositeOperation='source-in';og.fillStyle='#1d2440';og.fillRect(0,0,o.width,o.height);
  for(let a=0;a<16;a++){g.drawImage(o,12+Math.cos(a/16*6.283)*5,12+Math.sin(a/16*6.283)*5);}g.drawImage(img,12,12);});}
function blobTex(){return canvasTex(128,128,g=>{const gr=g.createRadialGradient(64,64,4,64,64,62);gr.addColorStop(0,'rgba(20,24,45,0.75)');gr.addColorStop(0.55,'rgba(20,24,45,0.35)');gr.addColorStop(1,'rgba(20,24,45,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);});}
function groundY(models,x,z){const ray=new geometry.Ray(x,60,z,0,-1,0);let best=-1e9;
  for(const m of models){const d=geometry.intersect.rayModel(ray,m,{mode:geometry.ERaycastMode.CLOSEST,distance:200,doubleSided:true});if(d>0)best=Math.max(best,60-d);}return best;}
async function go(){
  const sc=new Scene('snowshot');director.runSceneImmediate(sc);
  const G=sc.globals;G.shadows.enabled=true;G.shadows.type=1;G.shadows.shadowMapSize=2048;
  G.ambient.skyIllum=14000;G.ambient.skyColor=new Color(150,170,215,255);G.ambient.groundAlbedo=new Color(210,215,230,255);
  await loadB('shared_effects');const sb=await loadB('region_snowpass');const pf=await ld(sb,'models/SP_snowpass/SP_snowpass',cc.Prefab);
  const env=cc.instantiate(pf);sc.addChild(env);await new Promise(r=>setTimeout(r,200));
  const mrs=env.getComponentsInChildren(MeshRenderer);mrs.forEach(m=>{m.shadowCastingMode=1;m.receiveShadow=1;});
  const grounds=mrs.filter(m=>/ground|steps|rubble/.test(m.node.name)).map(m=>m.model).filter(Boolean);
  // 驿站雪坪: board at the foot of the steps, before the first lantern pair
  const BX=Number(q.get('bx')||0),BZ=Number(q.get('bz')||6.5),CELL=1.0;
  const hs=[];for(let i=-3;i<=3;i+=3)for(let j=-3;j<=3;j+=3)hs.push(groundY(grounds,BX+i,BZ+j));
  const gy=Math.max(...hs);L('groundY samples',hs.map(h=>h.toFixed(2)).join(','));
  const board=new Node('SnowStationBoard');sc.addChild(board);board.setPosition(BX,gy,BZ);
  const snowM=mat(new Color(236,240,250,255),{rough:0.95});
  box(board,'snow_pad',[8.6,0.5,8.6],new Vec3(0,-0.2,0),snowM,false);
  const paver=[mat(new Color(176,184,200,255)),mat(new Color(160,168,186,255))];
  for(let i=0;i<7;i++)for(let j=0;j<7;j++)box(board,'paver_'+i+'_'+j,[CELL*0.93,0.12,CELL*0.93],new Vec3((i-3)*CELL,0.06+((i*7+j)%3)*0.008,(j-3)*CELL),paver[(i+j)%2],false);
  // curb stones: board edge reads as stone, not a drawn frame (R3)
  const curb=mat(new Color(120,128,148,255));for(const s of [-1,1]){box(board,'curbX'+s,[7.5,0.22,0.22],new Vec3(0,0.11,s*3.72),curb);box(board,'curbZ'+s,[0.22,0.22,7.5],new Vec3(s*3.72,0.11,0),curb);}
  // camera (game board view, portrait)
  const cn=new Node('cam');sc.addChild(cn);const cam=cn.addComponent(Camera);cam.clearColor=new Color(122,146,196,255);cam.far=3000;cam.near=0.3;cam.fov=Number(q.get('fov')||38);
  const tgt=new Vec3(BX,gy,BZ-0.4);const pitch=Number(q.get('pitch')||58)*Math.PI/180,dist=Number(q.get('dist')||22);
  cn.setPosition(tgt.x,tgt.y+Math.sin(pitch)*dist,tgt.z+Math.cos(pitch)*dist);cn.lookAt(tgt);
  // sun: low raking side light from camera-left
  const ln=new Node('sun');sc.addChild(ln);const sun=ln.addComponent(DirectionalLight);sun.illuminance=Number(q.get('lux')||65000);sun.color=new Color(255,244,228,255);
  sun.shadowEnabled=true;sun.shadowPcf=2;sun.shadowFixedArea=true;sun.shadowNear=0.1;sun.shadowFar=60;sun.shadowOrthoSize=10;ln.setPosition(BX,gy+20,BZ);
  ln.setRotationFromEuler(-38,-62,0);
  const ab=await loadB('board_art');const blob=blobTex();const blobM=mat(new Color(255,255,255,255),{unlit:true,tex:blob,blend:true});
  const slate=mat(new Color(84,92,120,255),{rough:0.7});
  if(!NOP){const camRot=cn.worldRotation;
    for(let i=0;i<7;i++)for(let j=0;j<7;j++){const k=[3,0,5,2,1,4,2,3,1,5,0,2,4,3,5,2,4,1,3,0,2,1,3,0,2,5,4,1,4,5,2,3,0,1,3,2,1,4,0,5,3,2,0,3,1,2,4,5,3][i*7+j],kind=KINDS[k];const tex=await ld(ab,'board/piece_'+kind+'/texture',Texture2D);
      const aid=AID.includes(kind);const p=new Node('piece_'+kind);board.addChild(p);p.setPosition((i-3)*CELL,0.13,(j-3)*CELL);
      if(aid)cyl(p,'base',0.31,0.07,new Vec3(0,0.035,0),slate);
      const bq=quad(p,'contact',0.78,0.5,blobM,false);bq.setRotationFromEuler(-90,0,0);bq.setPosition(0.08,0.012+(aid?0.07:0),0.12);
      let t=tex;if(aid){t=outlined(tex.image.data||tex.image._nativeAsset||tex.image.nativeAsset||tex.image);}
      const sm=mat(new Color(255,255,255,255),{tex:t,alpha:true,rough:0.6});const sz=aid?0.92*(216/192):0.92;
      const card=quad(p,'sprite',sz,sz,sm,true);card.getComponent(MeshRenderer).receiveShadow=0;card.setWorldRotation(camRot);card.setPosition(0,0.46+(aid?0.07:0),0);
      S.pieces.push({kind,i,j,aid});}
  }
  await new Promise(r=>setTimeout(r,800));
  for(const pc of S.pieces){const w=new Vec3(BX+(pc.i-3)*CELL,gy+0.6,BZ+(pc.j-3)*CELL);const o=new Vec3();cam.worldToScreen(w,o);pc.sx=o.x;pc.sy=o.y;}
  S.ready=true;L('ok',S.pieces.length);
}
setTimeout(()=>go().catch(e=>{L('ERR',e&&e.stack||e);S.ready=true;}),800);
})();
