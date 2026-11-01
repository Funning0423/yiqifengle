export type RegionId = 'island' | 'meadow' | 'skycity';
export type RegionAlias = RegionId | 'tide' | 'sky';
export interface JourneyRecord { bestStars: number; clears: number; [key: string]: any; }
export interface JourneyView { readOnly: boolean; records: JourneyRecord[]; [key: string]: any; }
export interface GateReply { ok: boolean; reason?: string; }
export interface TransitionReply extends GateReply { fromRegion?: RegionId; toRegion?: RegionId; requiresTravel?: boolean; nextStageId?: string; }
export interface CampaignStage {
  readonly id: string; readonly level: number; readonly ordinal: number; readonly regionOrdinal: number;
  readonly regionId: RegionId; readonly region: 'tide' | 'meadow' | 'sky';
  readonly name: string; readonly chapterName: string; readonly description: string;
  readonly learningBeat: 'introduce' | 'combine' | 'practice' | 'finale';
  readonly moves: number; readonly goals: Readonly<Record<string, number>>;
  readonly goalOrder: readonly string[]; readonly seedBank: readonly number[]; [key: string]: any;
}
declare const Campaign: {
  readonly regions: readonly any[]; readonly stages: readonly CampaignStage[];
  stage(stageId: string): CampaignStage | null;
  inspect(journey: JourneyView | null | undefined): Readonly<{ ok: boolean; reason: string | null; regions: readonly any[]; completed: boolean; nextStageId: string | null; [key: string]: any }>;
  canEnterRegion(journey: JourneyView | null | undefined, regionId: RegionAlias | string): GateReply;
  /** Call only after the active provider confirms result.saved + completionRecorded. */
  transition(journey: JourneyView | null | undefined, fromStageId: string, toStageId: string): TransitionReply;
  rewardHandoff(journey: JourneyView | null | undefined, stageId: string, ready: boolean): any;
};
export default Campaign;
