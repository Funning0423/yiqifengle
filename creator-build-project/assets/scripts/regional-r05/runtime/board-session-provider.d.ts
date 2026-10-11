import { Action, Tile, Piece, Frame, Checkpoint, RuleGuide } from './index';
interface Platform { load(key:string):unknown; save(key:string,value:unknown):unknown; }
interface JourneyView { readonly readOnly:boolean; readonly records:ReadonlyArray<{readonly bestStars:number;readonly [key:string]:unknown}>; readonly [key:string]:unknown; }
interface Grant { readonly kind:'challenge-memento'; readonly id:string; readonly count:1; }
interface Outcome { readonly ok:boolean; readonly reason?:string; readonly token?:string; readonly saved?:boolean; readonly duplicate?:boolean; readonly firstClear?:boolean; readonly newlyGranted?:readonly Grant[]; readonly claimed?:boolean; }
interface ScoreRecord { readonly contentRevision:string; readonly bestStars:number; readonly bestScore:number; readonly bestMoves:number; readonly clears:number; }
interface ProviderSnapshot {
 readonly provider:'regional-r05'; readonly storageKey:'forest-regional-r05-active'; readonly progressKey:'forest-regional-r05-progress';
 readonly state:'book.ready'|'run.ready'|'run.resolving'|'run.paused'|'run.unsaved'|'result.unsaved'|'result.saved'|'error.readonly';
 readonly active:null|{readonly stageId:string;readonly attemptId:string;readonly region:string;readonly theme:string;readonly seed:number;readonly board:readonly Tile[];readonly goals:Readonly<Record<string,number>>;readonly moves:number;readonly score:number;readonly status:'playing'|'won'|'lost';readonly moss:readonly number[];readonly roots:readonly (readonly[number,number])[];readonly bombs:0;readonly regionPieces:readonly Piece[];readonly guide:RuleGuide;readonly scene:{readonly phase:string|number;readonly clock:number;readonly heldTurns:number};readonly tool:{readonly kind:string;readonly charges:number}};
 readonly visual:null|(Frame&{readonly token:string}); readonly hidden:boolean; readonly readOnly:boolean; readonly error:unknown;
 readonly result:null|{readonly outcome:'won'|'lost';readonly sessionSaved:boolean;readonly saved:boolean;readonly completionRecorded:boolean;readonly firstClear:boolean;readonly duplicate:boolean;readonly stars:number;readonly bestStars:number};
 readonly stages:ReadonlyArray<{readonly id:string;readonly region:string;readonly ordinal:number;readonly name:string;readonly unlocked:boolean;readonly record:ScoreRecord|null}>;
 readonly regions:readonly string[]; readonly progress:{readonly records:Readonly<Record<string,ScoreRecord>>;readonly claimedRegions:readonly string[]};readonly nextStageId:string|null;
}
declare class BoardSessionProvider {
 static readonly KEY:'forest-regional-r05-active'; static readonly PROGRESS_KEY:'forest-regional-r05-progress';static readonly BACKUP_KEY:'forest-regional-r05-active-v1-backup';static readonly VERSION:2;
 constructor(options:{platform:Platform;journey?:JourneyView;stageId?:string;seed?:number});
 snapshot():ProviderSnapshot;
 startStage(id:string,options?:{seed?:number}):Outcome;
 previewAction(action:Action):Outcome; cancelPreview(token:string):Outcome; commitAction(token:string):Outcome; finishVisualStep(token:string):Outcome;
 pause():Outcome;onHide():Outcome;onShow():Outcome;resume():Outcome;requestExit():Outcome;retrySave():Outcome;finish():Outcome;discardActive():Outcome;claimMemento(region:'tide'|'meadow'|'sky'):Outcome;
}
export = BoardSessionProvider;
