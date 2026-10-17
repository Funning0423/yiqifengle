import {_decorator,Component} from 'cc';
import {blendPose,followPose,mapPose,type LensState} from '../region/ExploreCameraCore';
import type {Pose,Vec} from '../world-r1/WorldFlowCore';
const {ccclass}=_decorator;
export {blendPose,followPose,mapPose,clampFocus,screenProfile,transition,SCREENS,BLEND_S} from '../region/ExploreCameraCore';
/** Thin writer. The pose maths live in ExploreCameraCore so Node can test them without the engine. */
@ccclass('ExploreCamera')
export class ExploreCamera extends Component{
 state:LensState='Board';
 pose:Pose|null=null;
 follow(girl:Vec,yawRad:number,w:number,h:number,lookUpDeg=0):Pose{this.state='FollowWalk';this.pose=followPose(girl,yawRad,w,h,lookUpDeg);return this.pose;}
 map(focus:Vec,zoom:number,w:number,h:number):Pose{this.state='MapExplore';this.pose=mapPose(focus,zoom,w,h);return this.pose;}
 blend(a:Pose,b:Pose,t:number,seconds:number):Pose{this.pose=blendPose(a,b,t,seconds);return this.pose;}
}
