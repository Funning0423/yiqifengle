import { _decorator, Component, Node, Prefab, Camera, JsonAsset, Layers } from 'cc';
import { WorldFlowComponent } from '../world-r1/WorldFlowComponent';
import type { CharacterAdapter, Result } from '../world-r1/WorldFlowCore';
import { createNativeWorldLevelAdapter } from './NativeWorldLevelAdapter';
import type { Selection } from './ManagedBoardSession';
import RegionalAPI from '../regional-r05/runtime/index.js';
const {ccclass,property}=_decorator;
/** NEW composition component; do not enable alongside FirstsliceBoot. No automatic rewards/progress. */
@ccclass('WorldNativeComposition')
export class WorldNativeComposition extends Component {
  @property(Prefab) firstsliceModel:Prefab|null=null;
  @property(Camera) worldCamera:Camera|null=null;
  @property(JsonAsset) smokeFixture:JsonAsset|null=null;
  private owner:Node|null=null;private uiParent:Node|null=null;private world:WorldFlowComponent|null=null;
  private selection:Selection|null=null;private previousCameraVisibility:number|null=null;
  async start(){
    if(!this.firstsliceModel||!this.worldCamera||!this.smokeFixture)throw Error('Bind combined prefab, dedicated world camera and R4 smoke fixture');
    this.previousCameraVisibility=this.worldCamera.visibility;this.worldCamera.visibility &= ~Layers.Enum.UI_2D;
    this.owner=new Node('WorldFlowOwner');this.node.addChild(this.owner);
    this.uiParent=new Node('WorldLevelUI');this.node.addChild(this.uiParent);
    const world=this.owner.addComponent(WorldFlowComponent);this.world=world;
    world.firstsliceModel=this.firstsliceModel;world.worldCamera=this.worldCamera;
    const fixture:any=this.smokeFixture.json;
    this.selection={provider:'r4',stageId:fixture.stageId,seed:fixture.seed};
    const levels=createNativeWorldLevelAdapter({uiParent:this.uiParent,fixture,
      select:id=>{if(!this.selection||id!==this.selection.stageId)throw Error('Select provider/stage explicitly first');return {...this.selection};},
      navigation:{exit:()=>world.commands().exitLevel(),resume:()=>world.commands().snapshot().needsResume?world.commands().resume():undefined},
    });
    try {const result=await world.initialize(levels,undefined,'fixed');if(!result.ok)throw Error(result.reason);}
    catch(error){this.releaseOwned();throw error;}
  }
  selectProvider(selection:Selection):Result {
    if(!this.world)return {ok:false,reason:'world-not-ready'};
    if(!['home','island'].includes(this.world.commands().snapshot().state))return {ok:false,reason:'exit-current-level-first'};
    if(selection.provider==='r5'){
      const stage=(RegionalAPI as any).getStage(selection.stageId);
      if(!stage||!stage.seedBank.includes(selection.seed))return {ok:false,reason:'unverified-r5-stage-or-seed'};
    }else if(selection.provider!=='r4'||selection.stageId!==(this.smokeFixture!.json as any).stageId||selection.seed!==(this.smokeFixture!.json as any).seed){
      return {ok:false,reason:'r4-candidate-limited-to-existing-smoke-fixture'};
    }
    this.selection={...selection};return {ok:true};
  }
  enterSelectedLevel(){if(!this.world||!this.selection)throw Error('World not ready');return this.world.commands().enterLevel(this.selection.stageId);}
  attachCalibratedCharacter(adapter:CharacterAdapter){if(!this.world)throw Error('World not ready');return this.world.bindCharacter(adapter);}
  worldCommands(){if(!this.world)throw Error('World not ready');return this.world.commands();}
  private releaseOwned(){if(this.worldCamera&&this.previousCameraVisibility!==null)this.worldCamera.visibility=this.previousCameraVisibility;this.owner?.destroy();this.uiParent?.destroy();this.owner=null;this.uiParent=null;this.world=null;this.previousCameraVisibility=null;}
  onDestroy(){this.releaseOwned();}
}
