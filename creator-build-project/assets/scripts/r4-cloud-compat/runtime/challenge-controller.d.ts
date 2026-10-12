export type Region = 'tide' | 'meadow' | 'sky';
export type Action = readonly ['swap', number, number] | readonly ['activate', number];
export interface SynchronousStorage { load(key: string): unknown; save(key: string, value: unknown): unknown; }
export interface LegacyJourney { readOnly?: boolean; records?: ReadonlyArray<{ bestStars?: number }>; }
export interface Outcome { ok: boolean; reason?: string; token?: string; unlocked?: boolean; resumable?: boolean; [key: string]: unknown; }
export interface Tile { readonly id: number; readonly type: number; readonly special: string | null; }
export interface Snapshot {
  readonly state: 'book.ready' | 'stage.detail' | 'run.ready' | 'run.preview' | 'run.resolving' | 'run.paused' | 'result.unsaved' | 'result.saved' | 'storage.unsaved' | 'storage.readOnly';
  readonly generation: number;
  readonly region: Region | null;
  readonly selectedStageId: string | null;
  readonly hidden: boolean;
  readonly readOnly: boolean;
  readonly error: string | null;
  readonly storageKey: string;
  readonly progressKey: string;
  readonly visual: null | {readonly kind: 'preview' | 'action' | 'clear' | 'drop'; readonly token: string; readonly action?: Action; readonly plan?: unknown; readonly tiles?: ReadonlyArray<unknown>; readonly wave?: unknown; readonly changes?: unknown};
  readonly active: null | {readonly stageId: string; readonly theme: string; readonly seed: number; readonly attemptId: string; readonly contentRevision: number; readonly actions: ReadonlyArray<Action>; readonly moves: number; readonly bombs: number; readonly score: number; readonly goals: Readonly<Record<string, number>>; readonly initialGoals: Readonly<Record<string, number>>; readonly goalOrder: ReadonlyArray<string>; readonly board: ReadonlyArray<Tile | null>; readonly moss: ReadonlyArray<number>; readonly roots: ReadonlyArray<readonly [number, number]>; readonly beaconTarget: null | {readonly index: number; readonly type: number | null; readonly cursor: number; readonly total: number; readonly typed: boolean}; readonly beaconRoute: ReadonlyArray<number>; readonly status: 'playing' | 'won' | 'lost'};
  readonly stages: ReadonlyArray<{readonly id: string; readonly region: Region; readonly ordinal: number; readonly name?: string; readonly unlocked: boolean; readonly record: unknown}>;
  readonly regions: ReadonlyArray<{readonly id: Region; readonly mementoClaimed: boolean; readonly completed: number}>;
  readonly result: Readonly<Record<string, unknown>> | null;
  readonly events: ReadonlyArray<{readonly id: number; readonly kind: string; readonly [key: string]: unknown}>;
}
declare class ChallengeController {
  constructor(options: {platform: SynchronousStorage; journey: LegacyJourney; catalog?: unknown; attemptIdFactory?: (stageId: string) => string});
  static readonly VERSION: 1;
  static keyForPack(packId: string): string;
  snapshot(): Snapshot;
  selectRegion(region: Region): Outcome;
  selectStage(id: string): Outcome;
  startStage(id?: string, options?: {seed?: number; attemptId?: string}): Outcome;
  previewAction(action: Action): Outcome;
  cancelPreview(token: string): Outcome;
  commitAction(token: string): Outcome;
  finishVisualStep(token: string): Outcome;
  pause(): Outcome;
  onHide(): Outcome;
  onShow(): Outcome;
  resume(): Outcome;
  resumeActive(): Outcome;
  requestExit(): Outcome;
  discardActive(): Outcome;
  retrySave(): Outcome;
  finish(): Outcome;
  claimMemento(region: Region): Outcome;
}
export default ChallengeController;
