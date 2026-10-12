// GB_UNLOCK_DIR job: what the REAL audio/AudioUnlock.ts imports as './GameAudio'. Delegates to the harness FakeGameAudio
// (registered under js 'GameAudio'), with the real static API: instance + notifyUserGesture() -> instance.onGesture().
import {js} from 'cc';
export class GameAudio{static get instance(){const C=js.getClassByName('GameAudio');return C&&C!==GameAudio?C.instance||null:null;}
 static notifyUserGesture(){try{GameAudio.instance?.onGesture?.();}catch(e){console.warn('[GameAudio] UI gesture notification failed (gameplay unaffected)',e);}}}
