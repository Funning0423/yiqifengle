/* Actual game assets, original shared XYZ character, one fixed 3D lighthouse
 * scene. Rendering is GPU -> drawImage; CPU z-buffer is never in this path. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./gpu-scene'),require('./camera-world'),require('./lighthouse-shell'),require('./character-snapshot/mesh3d'),require('./character-snapshot/girl'),require('./character-snapshot/motion-study/girl-posed'),require('./route-locomotion'),require('./route-posed-girl'),require('./camera-aligned'),require('./original-room-geometry'),require('./aligned-gait-provider'),require('./aligned-seat-stand'),require('./coastal-plants'),require('./continuous-interaction-provider'),require('./continuous-seat-stand'),require('./continuous-return-motion'),require('./character-snapshot/guardian'));else root.ForestCinematicScene=factory(root.ForestGPUScene,root.ForestCameraWorld,root.ForestLighthouseShell,root.ForestCharacterMesh,root.ForestBuildGirl,root.ForestGirlPosed,root.ForestRouteLocomotion,root.ForestRoutePosedGirl,root.ForestCameraAligned,root.ForestOriginalRoomGeometry,root.ForestAlignedGait,root.ForestAlignedSeatStand,root.ForestCoastalPlants,root.ForestContinuousInteraction,root.ForestContinuousSeatStand,root.ForestContinuousReturn,root.ForestBuildGuardian);})(typeof globalThis!=='undefined'?globalThis:this,function(GPU,Camera,Shell,MeshLib,buildGirl,Posed,Route,RoutePosed,AlignedCamera,OriginalRoom,AlignedGait,AlignedSeat,Plants,Continuous,ContinuousSeat,ContinuousReturn,buildGuardian){
'use strict';const{GPUScene,V,quad,triangle}=GPU;const Fixed=require('./fixed-view-motion'),Wearables=require('./wearables'),Naoko=require('./white-character'),PoseDriver=require('./scene-pose-driver'),MapGarment=require('./map-garment-track'),MapRoot=require('./map-root-track'),MapFeet=require('./map-foot-motion'),TravelClock=require('./map-travel-clock');
function rgba(hex,alpha=1){return hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).concat(alpha);}
function modelData(model,position=[0,0,0],yaw=0,scale=1,reuse=null){const out=reuse&&reuse.length===model.triangles.length*36?reuse:new Float32Array(model.triangles.length*36),cs=Math.cos(yaw),sn=Math.sin(yaw);let at=0;for(const tri of model.triangles)for(let i=0;i<3;i++){const p=tri.v[i],n=tri.n[i];out[at++]=position[0]+scale*(p[0]*cs+p[2]*sn);out[at++]=position[1]+scale*p[1];out[at++]=position[2]+scale*(-p[0]*sn+p[2]*cs);out[at++]=n[0]*cs+n[2]*sn;out[at++]=n[1];out[at++]=-n[0]*sn+n[2]*cs;for(const v of (tri.colors?.[i]||tri.color))out[at++]=v/255;out[at++]=1;out[at++]=tri.uv?.[i]?.[0]||0;out[at++]=tri.uv?.[i]?.[1]||0;}return out;}
class CinematicScene{
 constructor(platform,world,interior,{quality=platform.sceneQuality||'low',pixelRatio=2,deferBuild=false}={}){if(!Number.isFinite(pixelRatio)||pixelRatio<=0||pixelRatio>3)throw TypeError('pixelRatio must be in (0,3]');this.pixelRatio=pixelRatio;this.textureDensity=GPU.Quality.profile(quality).roomDensity;this.p=platform;this.aligned=platform.alignedRoom!==false;this.cameraProvider=Fixed;this.seatProvider=this.aligned?ContinuousSeat:null;this.returnProvider=Fixed.returning;this.poseDriver=PoseDriver.create(Fixed,Fixed.returning);this.world=world;this.interior=interior;this.gpu=new GPUScene(platform,{width:Math.round(390*pixelRatio),height:Math.round(844*pixelRatio),quality});this.lastPose=null;this.frames=0;this.staticBuffers=[];if(!deferBuild){try{this._build();}catch(error){this.dispose();throw error;}}}
 crop(source,rect,w=256,h=256){const c=this.p.createCanvas(w,h),ctx=c.getContext('2d');ctx.drawImage(source,...rect,0,0,w,h);return c;}
 _build(){for(const step of this._buildSteps()){}return this;}
 static async createAsync(platform,world,interior,{yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0)),onStage=()=>{},isCurrent=()=>true,...options}={}){
  let scene;const check=()=>{if(!isCurrent()){const error=Error('Startup cancelled');error.name='AbortError';throw error;}};
  try{check();onStage({detail:'正在准备固定视角画面'});await yieldFrame();check();scene=new this(platform,world,interior,{...options,deferBuild:true});for(const step of scene._buildSteps()){check();onStage(step);await yieldFrame();check();}return scene;}catch(error){if(scene)scene.dispose();throw error;}
 }
 *_buildSteps(){const g=this.gpu,room=this.interior.art,props=this.world.props;
  for(const[name,r]of Object.entries(Shell.textureRegions||{})){const image=(r.asset||r.file||r.source)==='lighthouse-room.jpg'?room:props,rect=r.rect||r.crop;if(image&&image.width&&rect)g.texture(name,this.crop(image,rect,Math.max(128,r.width||256),Math.max(128,r.height||256)));yield {detail:'正在准备房间材质'};}
  if(!this.aligned&&room&&room.width)g.texture('room',room);g.texture('door-inner',this.interior.doorSurface().canvas);
  if(this.aligned)for(const [name,image] of Object.entries(OriginalRoom.prepareTextures({createCanvas:this.p.createCanvas,interior:this.interior,density:this.textureDensity}))){g.texture(name,image,{repeat:name.startsWith('room08-')});yield {detail:'正在展开室内画面'};}
  const shell=OriginalRoom.buildRoom().filter(m=>!/^r10-reading-bay-(exterior|roof)$/.test(m.name)).concat(OriginalRoom.buildStool());for(const m of shell){g.mesh(m.name,m.data,m);this.staticBuffers.push(m.name);yield {detail:'正在放置房间物件'};}
  this.shellContract=Shell.geometryContract;
  // Fixed-view lane: no exterior tower, full island, plants, or duplicate sky
  // geometry. The original World owns every map/island pixel independently.
  const sea=[];quad(sea,[[-150,-.08,0],[150,-.08,0],[150,-.08,220],[-150,-.08,220]],undefined,rgba('#469d9d'));
  g.texture('sea-waves',this.world._waterTexture().canvas,{repeat:true});g.mesh('sea',sea,{lit:false,texture:'sea-waves',water:true});this.staticBuffers.push('sea');
  const grass=[],porch=[];quad(grass,[[-8,-.035,0],[8,-.035,0],[8,-.035,9],[-8,-.035,9]]);g.texture('doorway-grass',this.world.grassArt);g.mesh('doorway-grass',grass,{texture:'doorway-grass',lit:false});this.staticBuffers.push('doorway-grass');
  quad(porch,[[-1.10,-.010,0],[1.10,-.010,0],[1.28,-.010,4.5],[-1.28,-.010,4.5]]);g.mesh('doorway-solid-path',porch,{texture:'roomStone',lit:false});this.staticBuffers.push('doorway-solid-path');
  // One fixed distant cloud composition viewed through the physical doorway.
  g.texture('painted-world-cloud',this.world.cloudArt);const cloud=[];
  quad(cloud,[[22,25,100],[-22,25,100],[-22,3,100],[22,3,100]]);
  g.mesh('doorway-distant-cloud',cloud,{texture:'painted-world-cloud',lit:false});this.staticBuffers.push('doorway-distant-cloud');
  yield {detail:'门外风景已准备'};
  g.texture('white-near',this.p.image('white-near.png'),{mipmaps:false});g.texture('white-far',this.p.image('white-far.png'),{mipmaps:false});this.modelProvider=pose=>Naoko.mapModel(pose);this.characterStyle='POLISH02-chair-edge-aa';this.sceneUnits=2;this.girlScale=.707641196013289*this.sceneUnits;g.mesh('girl',modelData(this.modelProvider({}),[0,0,0],0,this.girlScale),{lit:this.aligned?.55:true,dynamic:true,nightMax:.52,texture:'white-far'});
  g.mesh('sky-island-guardian',modelData(buildGuardian(new MeshLib.MeshBuilder(),{}),[0,0,0],0,this.sceneUnits),{lit:.55,dynamic:true,visible:false});
  yield {detail:'女孩和守护者已准备'};yield* this.poseDriver.prepareSteps();yield {detail:'动作已准备'};
  this._door(0);if(!this.aligned)this._stool();if(this.aligned)this.setRouteProvider(Continuous.evaluate,Continuous.makeModel);this.gpu.mesh('character-contact-shadow',new Float32Array(0),{lit:false,dynamic:true,depthWrite:false});
 }
 _stool(){const M=Posed.buildTestStool(new MeshLib.MeshBuilder());this.gpu.mesh('low-stool',modelData(M,[-.46,0,-2.02],0,this.girlScale),{lit:true});this.staticBuffers.push('low-stool');}
 _door(angle){const m=this.aligned?OriginalRoom.buildDoor(angle):Shell.buildDoor(angle);for(const d of (Array.isArray(m)?m:m.meshes)){if(this.gpu.meshes.has(d.name))this.gpu.updateMesh(d.name,d.data);else this.gpu.mesh(d.name,d.data,{...d,dynamic:true});}this.doorAngle=angle;}
 _contactShadows(state,position,yaw,model,modelScale=this.girlScale){const verts=[],ellipse=(center,rx,rz,angle,alpha)=>{const cs=Math.cos(angle),sn=Math.sin(angle),at=(a,k)=>[center[0]+(Math.cos(a)*rx*cs+Math.sin(a)*rz*sn)*k,.004,center[2]+(-Math.cos(a)*rx*sn+Math.sin(a)*rz*cs)*k],color=a=>[.12,.18,.13,a];for(let ring=0;ring<4;ring++){const k0=ring/4,k1=(ring+1)/4,a0=alpha*Math.pow(1-k0,2),a1=alpha*Math.pow(1-k1,2);for(let i=0;i<20;i++){const a=i*Math.PI/10,b=(i+1)*Math.PI/10,p=[at(a,k0),at(b,k0),at(b,k1),at(a,k1)];for(const ids of [[0,1,2],[0,2,3]])for(const id of ids)verts.push(...p[id],0,1,0,...color(id<2?a0:a1),0,0);}}};ellipse(position,.34,.24,yaw,.085+.035*Math.max(0,Math.min(1,(.7-position[2])/1.4)));if(state&&state.feet&&model){this._shoeFaces=this._shoeFaces||new WeakMap();let groups=this._shoeFaces.get(model);if(!groups){groups={L:[],R:[]};for(let i=0;i<model.triangles.length;i++)for(const side of ['L','R'])if(model.poseInfo.labels[i]==='shoe'+side)groups[side].push(i);this._shoeFaces.set(model,groups);}const cy=Math.cos(yaw),sy=Math.sin(yaw);for(const side of ['L','R']){const f=state.feet[side],a=(f.worldYaw||0)-(state.root?.yaw||0)+yaw,ca=Math.cos(a),sa=Math.sin(a);let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,y0=Infinity;for(const i of groups[side])for(const v of model.triangles[i].v){const x=position[0]+(cy*v[0]+sy*v[2])*modelScale,z=position[2]+(-sy*v[0]+cy*v[2])*modelScale,y=position[1]+v[1]*modelScale,u=ca*x-sa*z,w=sa*x+ca*z;x0=Math.min(x0,u);x1=Math.max(x1,u);z0=Math.min(z0,w);z1=Math.max(z1,w);y0=Math.min(y0,y);}if(!Number.isFinite(x0))continue;const u=(x0+x1)/2,w=(z0+z1)/2,height=Math.max(0,y0);ellipse([ca*u+sa*w,0,-sa*u+ca*w],(x1-x0)/2+.035+height*.10,(z1-z0)/2+.045+height*.13,a,.50/(1+height*18));}
}else for(const sign of[-1,1]){const x=position[0]+Math.cos(yaw)*sign*.073,z=position[2]-Math.sin(yaw)*sign*.073;ellipse([x,0,z],.07,.13,yaw,.20);}this.gpu.updateMesh('character-contact-shadow',new Float32Array(verts));}
 setCameraProvider(provider){if(!provider||typeof provider.sample!=='function')throw TypeError('Camera provider requires sample(seconds)');this.cameraProvider=provider;this.poseDriver=PoseDriver.create(provider,this.returnProvider);this.lastModelKey=null;this.invalidateStaticPixels();}
 setSeatProvider(provider){if(!provider||typeof provider.evaluate!=='function'||typeof provider.makeModel!=='function')throw TypeError('Seat provider requires evaluate/makeModel');this.seatProvider=provider;this.lastModelKey=null;this.invalidateStaticPixels();}
 setRouteProvider(evaluate,makeModel){this.routeEvaluator=evaluate;this.routeBuilder=makeModel;this.lastModelKey=null;this.invalidateStaticPixels();}
 setModelProvider(provider){this.modelProvider=provider;this.lastModelKey=null;this.invalidateStaticPixels();}
 setReturnProvider(provider){if(!provider||!(provider.duration>0)||typeof provider.sample!=='function'||typeof provider.evaluate!=='function'||typeof provider.makeModel!=='function')throw TypeError('Return provider requires duration/sample/evaluate/makeModel');this.returnProvider=provider;this.poseDriver=PoseDriver.create(this.cameraProvider,provider);this.lastModelKey=null;this.invalidateStaticPixels();}
 draw(ctx,seconds,{night=0,returning=false,x=0,y=0,w=390,h=844,hideSea=false,poseOverride=null,ambientTime=seconds,mapActor=null,mapGuardian=null,accessoryId=null,accessoryArt=null,atmosphereOpacity=1,hideAtmosphere=false,hideGirl=false,onlyGirl=false,_captureOnly=false}={}){
  if(!Number.isFinite(seconds)||!Number.isFinite(ambientTime))throw TypeError('Scene needs finite visible/ambient seconds');
  this.lastFrameRendered=false;
  if(this.gpu.disposed||this.gpu.lost)return null;
  if(typeof this.gpu.gl.isContextLost==='function'&&this.gpu.gl.isContextLost()){this.gpu.lost=true;return null;}
  if(returning&&!this.returnProvider)throw Error('Independent return provider has not been installed');
  let garmentRelease=null,mapGarmentActive=false,mapGarmentMotion=null,mapFootMotion=null,mapPhase=(mapActor?.time||0)*9;
  if(mapActor){const clock=mapActor.walkClock,duration=mapActor.walkDuration,ramp=mapActor.walkRamp;
   if(Number.isFinite(clock)&&Number.isFinite(duration)&&duration>0){const garmentKey=JSON.stringify([duration,ramp,mapActor.mapPath]);let state=this._mapGarment;if(!state||state.key!==garmentKey)state=this._mapGarment={track:MapGarment.create(duration,ramp,{initialMotion:mapActor.mapPath?.initialGarment||null,path:mapActor.mapPath||null}),duration,ramp,key:garmentKey};mapGarmentMotion=state.track.sample(clock);mapPhase=Math.min(clock,duration)*9;mapGarmentActive=!mapActor.walking&&clock<state.track.end;mapActor={...mapActor,walkClock:Math.min(clock,state.track.end)};if(mapActor.mapPath){const key=JSON.stringify(mapActor.mapPath);let feet=this._mapFeet;if(!feet||feet.key!==key){const root=MapRoot.create(this.world,mapActor.mapPath,{girlScale:this.girlScale,moving:false,heading:'ground-tangent'});feet=this._mapFeet={key,track:MapFeet.create({...root,initialPose:mapActor.mapPath.initialFeet||null})};}mapFootMotion=feet.track.sample(clock);mapFootMotion={...mapFootMotion,phase:(mapActor.mapPath.phaseOffset||0)+mapFootMotion.phase,walk:TravelClock.speedAt(mapActor.mapPath,clock)};mapPhase=mapFootMotion.phase;mapGarmentActive=mapGarmentActive||!mapActor.walking&&mapFootMotion.active;}}
  }
  const sourceSeconds=returning?seconds:(this.cameraProvider.sourceTime?this.cameraProvider.sourceTime(seconds):seconds);
  const p=poseOverride||(returning?this.returnProvider.sample(seconds):this.cameraProvider.sample(seconds));
  const cacheable=!mapGarmentActive&&!!ctx&&!_captureOnly&&!mapGuardian&&!returning&&!poseOverride&&(night===0||night===1)&&(seconds===0&&!mapActor||onlyGirl&&mapActor&&!mapActor.walking);
  const pixelKey=cacheable?JSON.stringify([onlyGirl?'actor':'room',this.gpu.width,this.gpu.height,this.gpu.quality,this.gpu.resourceEpoch||0,night,hideSea,hideAtmosphere,atmosphereOpacity,hideGirl,onlyGirl,accessoryId,mapActor?{...mapActor,time:0}:null]):null;
  const pixelFrame=this.staticPixels?.frame,now=Date.now();
  let captureReady=cacheable;
  if(cacheable&&mapActor){
   // Dragging changes projected x/y/scale even for a non-walking actor. Keep
   // exact live pixels while moving; only read back a key after it settles.
   const candidate=this._actorCaptureCandidate;
   if(!candidate||candidate.key!==pixelKey||now<candidate.since)this._actorCaptureCandidate={key:pixelKey,since:now};
   captureReady=now-this._actorCaptureCandidate.since>=180;
  }else if(!(_captureOnly&&hideGirl&&!mapActor))this._actorCaptureCandidate=null;
  if(cacheable&&pixelFrame?.key===pixelKey&&pixelFrame.snapshot&&this.gpu.compositePixels(pixelFrame.snapshot,ctx,x,y,w,h)){this.lastFrameRendered=true;this.lastPose=p;this.frames++;return p;}
  const physicalDoorAngle=p.doorAngle*(this.aligned?1:105/86.4);
  if(Math.abs(this.doorAngle-physicalDoorAngle)>1e-5)this._door(physicalDoorAngle);
  const hideHat=accessoryId==='cloudCrown';const modelKey=JSON.stringify([mapActor?18:seconds,returning,hideHat,mapActor?{...mapActor,time:(mapActor.walking||mapGarmentActive)?mapActor.time:0}:null]);
  if(!hideGirl&&this.lastModelKey!==modelKey){
   let model,position=p.girl.position,yaw=p.girl.yaw,contactState=null,scale=this.girlScale;
   if(mapActor){
    const idle=this._mapIdle||(this._mapIdle=(()=>{const end=Continuous.evaluate(18);return{end};})()),end=idle.end,motion=mapActor.walking?{phase:mapPhase,walk:mapFootMotion?mapFootMotion.walk:Number.isFinite(mapActor.walkAmount)?mapActor.walkAmount:1,time:(mapActor.time||0),garmentMotion:mapGarmentMotion,mapFootMotion}:null;
    if(motion)contactState=Naoko.mapPose(motion);else if(mapGarmentMotion)contactState=Naoko.mapPose({phase:mapPhase,walk:0,time:mapActor.time||0,garmentMotion:mapGarmentMotion,mapFootMotion});else contactState=end;model=Naoko.makeModel(contactState,hideHat,'far');
    position=Camera.mapPoint(mapActor.x,mapActor.y);
    scale*=Wearables.MAP_SCALE*Math.max(.05,mapActor.scale||1);
    yaw=mapFootMotion?mapFootMotion.root.yaw:mapActor.facing?Math.atan2(Camera.endCamera.position[0]-position[0],Camera.endCamera.position[2]-position[2])+(mapActor.facing>0?Math.PI/2:-Math.PI/2):end.root.yaw;
   }else if(returning){contactState=this.poseDriver.withMotion(this.returnProvider.evaluate(seconds),seconds,true);model=Naoko.makeModel(contactState,hideHat);position=V.scale(contactState.root.position,scale);yaw=contactState.root.yaw;
   }else if(this.aligned&&sourceSeconds<this.seatProvider.duration){contactState=this.poseDriver.withMotion(this.seatProvider.evaluate(sourceSeconds),seconds);model=Naoko.makeModel(contactState,hideHat);position=V.scale(contactState.root.position,scale);yaw=contactState.root.yaw;
   }else if(sourceSeconds>=(this.aligned?this.seatProvider.duration:1.28)){contactState=this.poseDriver.withMotion((this.routeEvaluator||Route.evaluate)(sourceSeconds),seconds);model=Naoko.makeModel(contactState,hideHat);position=V.scale(contactState.root.position,scale);yaw=contactState.root.yaw;
   }else if(p.girl.sit>0){contactState=Posed.evaluateSeatStand(4*(1-p.girl.sit));model=Naoko.makeModel(contactState,hideHat);position=V.add(position,V.scale(contactState.root.position,scale));
   }else model=Naoko.mapModel({phase:p.girl.distance/scale/.075*Math.PI,walk:p.girl.speed>.01?1:0,time:seconds},hideHat);
   this.attachmentState={pose:contactState,garmentRelease,garmentActive:mapGarmentActive,joints:model.girlJoints,wearableFrames:model.wearableFrames,position:position.slice(),yaw,scale,key:modelKey,phase:mapActor?mapPhase:sourceSeconds*5.8,moving:mapActor?(!!mapActor.walking||mapGarmentActive):seconds>0,camera:mapActor?Camera.endCamera:p.camera,map:!!mapActor};this._girlBuffer=modelData(model,position,yaw,scale,this._girlBuffer);this.gpu.meshes.get('girl').lit=.3+(!mapActor?.2*Math.max(0,Math.min(1,(.7-position[2])/1.4)):0);this.gpu.meshes.get('girl').texture=model.texture;this.gpu.updateMesh('girl',this._girlBuffer);this._contactShadows(contactState,position,yaw,model,scale);this.lastModelKey=modelKey;
  }
  if(mapGuardian){
   const key=JSON.stringify(mapGuardian);if(key!==this.lastGuardianKey){
    const position=Camera.mapPoint(mapGuardian.x,mapGuardian.y),yaw=Math.atan2(Camera.endCamera.position[0]-position[0],Camera.endCamera.position[2]-position[2])+(mapGuardian.facing||0)*Math.PI/2;
    const model=buildGuardian(new MeshLib.MeshBuilder(),{phase:Math.round((mapGuardian.phase||0)*24)/24,walk:mapGuardian.walking?1:0});
    const data=this._guardianBuffer=modelData(model,position,yaw,this.sceneUnits*Wearables.MAP_SCALE*Math.max(.05,mapGuardian.scale||1),this._guardianBuffer);
    if(Number.isFinite(mapGuardian.alpha))for(let i=9;i<data.length;i+=12)data[i]*=mapGuardian.alpha;
    this.gpu.updateMesh('sky-island-guardian',data);this.lastGuardianKey=key;
   }
  }
  this._syncWearable(accessoryId,accessoryArt);
  for(const[name,m]of this.gpu.meshes){const actor=name==='girl'||name==='girl-accessory'||name==='character-contact-shadow';m.visible=onlyGirl?actor:(!actor||!hideGirl);if(name==='sea'&&hideSea)m.visible=false;if(name==='sky-island-guardian')m.visible=!!mapGuardian;if(name==='girl-accessory')m.visible=!!this.activeAccessory&&!hideGirl;const atmosphere=name==='sea'||name.startsWith('sky-cloud-')||name.startsWith('offshore-cloud-bank-')||name.startsWith('doorway-distant-cloud');m.opacity=atmosphere?(hideAtmosphere?0:Math.max(0,Math.min(1,atmosphereOpacity))):1;if(m.opacity===0)m.visible=false;}

  const rendered=this.gpu.render(mapActor?Camera.endCamera:p.camera,{night,time:ambientTime});
  if(rendered===false)return p;
  if(_captureOnly){this.lastFrameRendered=true;this.lastPose=p;this.frames++;return p;}
  let composited=false;
  // A transient failed readback may recover, but never retry it every frame.
  if(captureReady&&(pixelFrame?.key!==pixelKey||!pixelFrame.snapshot&&(now<pixelFrame.at||now-pixelFrame.at>=1000))){
   const snapshot=this.gpu.capturePixels({minimumCoverage:onlyGirl?.00003:.01});this.staticPixels=this.staticPixels||{};this.staticPixels.frame={key:pixelKey,snapshot,at:now};
   if(snapshot)composited=this.gpu.compositePixels(snapshot,ctx,x,y,w,h);
  }
  if(!composited)composited=this.gpu.composite(ctx,x,y,w,h);if(composited===false)return p;
  this.lastFrameRendered=true;this.lastPose=p;this.frames++;return p;
 }
 drawMapStatic(ctx,{night=0,ambientTime=0,x=0,y=0,w=390,h=844}={}){
  if(!ctx||this.gpu.disposed||this.gpu.lost)return false;
  const structure=JSON.stringify([this.gpu.width,this.gpu.height,this.gpu.quality,this.gpu.resourceEpoch||0]),key=JSON.stringify([structure,night]);
  this.staticPixels=this.staticPixels||{};let cache=this.staticPixels.map;
  // Keep a valid persistent image during the brief night fade; at most two
  // captures per second, never a full readback on each tween frame.
  if(cache&&cache.structure===structure&&cache.key!==key&&Date.now()-cache.at>=0&&Date.now()-cache.at<500&&night>0&&night<1)return !!cache.snapshot&&this.gpu.compositePixels(cache.snapshot,ctx,x,y,w,h);
  if(!cache||cache.key!==key){
   this.draw(null,18,{night,ambientTime,hideSea:true,hideGirl:true,atmosphereOpacity:0,_captureOnly:true});
   const snapshot=this.lastFrameRendered?this.gpu.capturePixels({minimumCoverage:.01}):null;
   cache=this.staticPixels.map={key,structure,snapshot,at:Date.now()};
  }
  return !!cache.snapshot&&this.gpu.compositePixels(cache.snapshot,ctx,x,y,w,h);
 }
 _syncWearable(id,art){this.activeAccessory=null;if(!Wearables.definitions[id]||!this.attachmentState)return;const key=this.attachmentState.key+'|'+id;if(this.accessoryKey!==key){const shape=Wearables.geometry(id,this.attachmentState,this.accessoryGeometry?.data);if(!shape)return;let mesh=this.gpu.meshes.get('girl-accessory');if(!mesh)mesh=this.gpu.mesh('girl-accessory',shape.data,{lit:.55,dynamic:true,depthWrite:true,nightMax:.52});else{this.gpu.updateMesh('girl-accessory',shape.data);mesh.texture=null;mesh.lit=.55;mesh.depthWrite=true;}this.accessoryKey=key;this.accessoryGeometry=shape;}this.activeAccessory=id;}
 invalidateStaticPixels(){this.staticPixels={};this._actorCaptureCandidate=null;}
 setQuality(name){const changed=this.gpu.setQuality(name);if(changed)this.invalidateStaticPixels();return changed;}
 setPixelRatio(value){if(!Number.isFinite(value)||value<=0||value>3)throw TypeError('pixelRatio must be in (0,3]');this.pixelRatio=value;this.gpu.resize(Math.round(390*value),Math.round(844*value));this.invalidateStaticPixels();}
 stats(){return{...this.gpu.stats,garmentMotion:this.poseDriver.stats(),fixedView:true,mapTerrain:'original R10 Canvas2D; no island GL',staticPixels:{mapReady:!!this.staticPixels?.map?.snapshot,frameReady:!!this.staticPixels?.frame?.snapshot,bytes:Object.values(this.staticPixels||{}).reduce((n,c)=>n+(c.snapshot?.bytes||0),0)},frames:this.frames,staticBuffers:this.staticBuffers.slice(),doorAngle:this.doorAngle,characterWorldHeights:{girl:Naoko.info.height*this.girlScale,guardian:buildGuardian.info.height*this.sceneUnits,ratio:(buildGuardian.info.height*this.sceneUnits)/(Naoko.info.height*this.girlScale)},mapActorScale:Wearables.MAP_SCALE,accessory:{id:this.activeAccessory||null,triangles:this.gpu.meshes.get('girl-accessory')?.data.length/36||0,textureCount:[...this.gpu.textures.keys()].filter(n=>n.startsWith('wearable-')).length},characterStyle:'POLISH02 reading-chair and edge AA',modelSource:'Approved repaired Hunyuan mesh, textured near/far LOD, retargeted onto existing owned continuous contacts; no replacement with old character geometry',pose:this.lastPose};}
 dispose(){this.invalidateStaticPixels();this._girlBuffer=this._guardianBuffer=this._mapIdle=null;this.attachmentState=this.accessoryGeometry=null;this.gpu.dispose();}
}
return{CinematicScene,modelData};
});
