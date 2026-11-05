/** A/B (2026-11-05): wall-clock heavy refreshes suspected of fixed-interval whole-UI stutter.
 *  When false (default), skip:
 *   - Orbit AABB MeshRenderer walks (~400 ms) — RegionNodeStage.refreshOrbitBoxes + WorldFlowComponent.fillBoxes
 *   - Skycity sector clear-yaw 72-sample grid refresh (~0.25 s)
 *   - Explore markers mesh rebuild on a 0.25 s timer (utils.createMesh → GC hitch pattern)
 *   - WorldFlowComponent reportRuntime('tick') snapshot build (~5 s)
 *  Event-driven marker rebuilds and one-shot orbit fills still run. Standup / Morph / TSW untouched.
 *  setPeriodHeavyRefreshEnabled(true) restores prior periodic behavior for rollback. */
export let PERIOD_HEAVY_REFRESH_ENABLED=false;
export function setPeriodHeavyRefreshEnabled(on:boolean):void{PERIOD_HEAVY_REFRESH_ENABLED=!!on;}
