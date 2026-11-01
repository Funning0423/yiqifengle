export type MainlineAction = readonly ['swap', number, number] | readonly ['activate', number] | readonly ['bomb', number] | readonly ['tool', 'windBell' | 'tideBottle' | 'tideNet' | 'sunSeed' | 'starShears', number];
export interface SynchronousStorage { load(key: string): unknown; save(key: string, value: unknown): unknown; }
export interface Reply { ok: boolean; reason?: string; token?: string; saved?: boolean; duplicate?: boolean; [key: string]: any; }
export interface Snapshot { provider: 'mainline-v33'; state: string; readOnly: boolean; hidden: boolean; active: any; visual: any; result: any; stages: any[]; regions: any[]; campaign: any; rewardHandoff: any; journey: any; nextStageId: string | null; capabilities: { swap: true; activate: true; bomb: true; earnedTools: true; oceanEvents: false; goals: string[]; maxGoalSlots: 4; }; [key: string]: any; }
export default class MainlineController {
  constructor(options: { platform: SynchronousStorage; journeyBridge?: any });
  static KEY: string;
  static PROGRESS_KEY: string;
  snapshot(): Readonly<Snapshot>;
  startStage(stageId: string, options?: { seed?: number }): Reply;
  previewAction(action: MainlineAction): Reply;
  cancelPreview(token: string): Reply;
  commitAction(token: string): Reply;
  finishVisualStep(token: string): Reply;
  pause(): Reply;
  onHide(): Reply;
  onShow(): Reply;
  resume(): Reply;
  resumeActive(): Reply;
  requestExit(): Reply;
  retrySave(): Reply;
  finish(): Reply;
  discardActive(): Reply;
  hint(): null | { action: MainlineAction; cells: number[] };
  openChest(level: number): Reply;
  claimRegion(region: number): Reply;
  equipCharm(id: string | null): Reply;
}
