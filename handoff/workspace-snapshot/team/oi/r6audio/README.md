# R6 local audio integration and acceptance

0005 source ZIP SHA256: baec1e97c285e435693b1e4eaa60b9b74a365764242115ed9bf6617267289132. Applied on local actual gameplay baseline; no 0006 motion or 0007 camera patch applied.

Creator 3.8.8 Web and WeChat builds succeeded. WeChat bundle gate passes: main 1,819,478 bytes; total 26,403,898 bytes; missing references zero. Logs and gate accompany this report.

Local lifecycle repairs: release owned node callbacks and clips, guard async loads after destruction, use one scene-launch listener, keep isolated mute storage, and prevent hidden-state playback requests. Existing/pending one-shots cannot be claimed instantly cancelled because Creator's playOneShot supplies no request cancellation handle. Voice cap remains an approximation.

Actual fresh Web input observation passes: seven clips loaded, one GameAudio instance, normal match/combos/clear/first chest playback requests, duplicate chest did not update chest playback timestamp; recorded game console errors zero. This is observation of real playback requests, not hearing acceptance. Hearing and mute/hide/resume UI acceptance remain NOT_RUN. WeChat audio runtime/hearing remains NOT_RUN; its build succeeds.

The initial test harness referenced an undeclared global during a scene wait. The corrected test uses globalThis. Initial failure evidence is retained. A subsequent sandbox browser launch failed before product execution; retry in the authorized native environment completed.

Actual WeChat loss/retry and exact inventory acceptance are in ../wechat-r6-acceptance/summary.json. First-open B functionally reaches full B home after normal start without manual Compile, but console audit is still NOT_CLOSED: A showed a custom-condition error, B's debugger panel stayed blank. Candidate B config has not been adopted globally or in finalizer.

Historical forest-v33-journey v3 and historical keys remain read-only. Test runtime writes only isolated storage. Old projects, global IDE preferences and existing browser profiles are not part of this delivery. No WeChat upload or publishing occurred. No phone fps or thermal claim is made.
