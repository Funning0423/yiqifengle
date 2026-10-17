/** LANDING → BOARD camera hook for 风铃湖畔 (single call site: WorldNativeComposition.enterSelectedLevel).
 *  TODO(运镜bot): replace this stub with your landing→board transition hook (~1 s, owned by 运镜bot per Grok Bot) — the
 *  swap is a one-line change of the import in WorldNativeComposition (or of this body). Until then this keeps the
 *  existing behaviour: resolve at once, the level then mounts and the board-background camera takes over (hard cut).
 *  Pure (no engine imports). Must resolve (never reject) and must not touch saves/progression. */
export type LakesideLandingContext=Readonly<{stageId:string;journey:unknown}>;
export function lakesideLandingToBoard(_context:LakesideLandingContext):Promise<void>{return Promise.resolve();}
