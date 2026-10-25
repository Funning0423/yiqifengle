import { _decorator, Component } from 'cc';
import { endingSwayDeg } from '../world-r2/EndingFlow';
const { ccclass } = _decorator;
/** Whole-chime ±4° sway (split out of EndingScreen.ts: Cocos allows one component per script). */
@ccclass('EndingChimeSway')
export class EndingChimeSway extends Component { t = 0; update(dt: number) { this.t += Math.min(dt, .1); this.node.angle = endingSwayDeg(this.t); } }
