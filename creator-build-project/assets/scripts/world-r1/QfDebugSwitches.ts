// QfDebugSwitches.ts — one documented place for the Mac A/B debug switches (GGbot b16). Read once at startup from the page
// URL (web-test / preview builds; WeChat has no query, so release stays on defaults):
//   ?qfLog=1      → globalThis.__worldFlowLog = true  (OI_WORLD_FLOW 5 s snapshots + QF_AUDIO logs)
//   ?qfLog=0      → globalThis.__worldFlowLog = false (forces the log OFF even in a DEBUG build)
//   ?qfPreload=0  → globalThis.__qfAudioPreloadOff = true (old lazy audio loading, for the A/B baseline)
// A global set by a test harness before startup wins over the URL.
export function parseQfDebugSwitches(search: string): { worldFlowLog?: boolean; audioPreloadOff?: boolean } {
  const out: { worldFlowLog?: boolean; audioPreloadOff?: boolean } = {};
  const q = String(search || '').replace(/^\?/, '').split('&');
  for (let i = 0; i < q.length; i++) {
    const [k, v] = q[i].split('=');
    if (k === 'qfLog') out.worldFlowLog = v === '1' || v === 'true';
    if (k === 'qfPreload' && (v === '0' || v === 'false')) out.audioPreloadOff = true;
  }
  return out;
}
export function applyQfDebugSwitches(g: any = globalThis): void {
  try {
    const search = g.location && typeof g.location.search === 'string' ? g.location.search : '';
    const s = parseQfDebugSwitches(search);
    if (s.worldFlowLog !== undefined && g.__worldFlowLog === undefined) g.__worldFlowLog = s.worldFlowLog;
    if (s.audioPreloadOff && g.__qfAudioPreloadOff === undefined) g.__qfAudioPreloadOff = true;
  } catch { /* no URL: defaults */ }
}
applyQfDebugSwitches();
