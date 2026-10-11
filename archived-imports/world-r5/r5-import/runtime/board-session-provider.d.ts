import { Action, Tile, Piece, Frame } from './index';
interface Platform { load(key: string): unknown; save(key: string, value: unknown): unknown; }
interface ProviderSnapshot {
 readonly provider: 'regional-r05';
 readonly storageKey: 'forest-regional-r05-active';
 readonly state: 'run.ready'|'run.resolving'|'run.paused'|'run.unsaved'|'error.readonly'|'result.session-saved';
 readonly active: null | { readonly stageId: string; readonly region: string; readonly theme: string; readonly seed: number; readonly board: readonly Tile[]; readonly goals: Readonly<Record<string,number>>; readonly moves: number; readonly score: number; readonly status: string; readonly moss: readonly number[]; readonly roots: readonly (readonly [number,number])[]; readonly bombs: 0; readonly regionPieces: readonly Piece[]; readonly scene: { readonly phase: string|number; readonly clock:number; readonly heldTurns:number }; readonly tool: { readonly kind:string; readonly charges:number } };
 readonly visual: null | (Frame & { readonly token:string });
 readonly hidden:boolean; readonly error: unknown;
 readonly result: null | { readonly outcome:string; readonly sessionSaved:boolean; readonly completionRecorded:false };
}
declare class BoardSessionProvider {
 static readonly KEY: 'forest-regional-r05-active';
 constructor(options:{platform:Platform;stageId?:string;seed?:number});
 snapshot():ProviderSnapshot;
 previewAction(action:Action):{ok:boolean;token?:string;reason?:string};
 cancelPreview(token:string):{ok:boolean;reason?:string};
 commitAction(token:string):{ok:boolean;saved?:boolean;reason?:string};
 finishVisualStep(token:string):{ok:boolean;reason?:string};
 pause():{ok:boolean}; onHide():{ok:boolean}; onShow():{ok:boolean}; resume():{ok:boolean;reason?:string}; requestExit():{ok:boolean}; retrySave():{ok:boolean;reason?:string};
}
export = BoardSessionProvider;
