# Mac steps — coast arrival runtime (运镜bot, cine/b20-coast-arrival-runtime)
Lock from 全流程测试部 first; one DevTools; free disk >= 5 GiB.
1. Open creator-build-project in Cocos Creator 3.8.8 and let it import. Creator creates (do NOT hand-write):
   - creator-build-project/assets/bundles/region_coast/scripts.meta (folder)
   - creator-build-project/assets/bundles/region_coast/scripts/CoastArrivalLens.ts.meta
   - creator-build-project/assets/bundles/region_coast/scripts/CoastArrivalTrack.ts.meta
2. Commit exactly those 3 metas; add those 3 paths to tools/build-guard/meta-allowlist.json "files" (Grok Bot review) — nothing else.
3. Build WeChat; report the region_coast subpackage bytes (must stay <= 943,718 B) and the main package bytes (must not change).
4. Only after the hook (02-...diff) is approved and applied: run with ?qfcoastkit=1, record island->coast arrival + board landing
   on 390x844 (screen recording); check [QF_CAM] writer = coast.arrival only until the board pose, then 0 enter-level writes.
