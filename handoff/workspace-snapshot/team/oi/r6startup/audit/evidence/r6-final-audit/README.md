# R6 startup console and actual WeChat audio audit

Scope: Creator 3.8.8, WeChat DevTools 2.02.2608080, actual library 3.17.3. Only isolated local project copies, normal native UI inputs, and read-only gameContext queries. No 0006/0007, storage injection, WeChat upload, publishing, global preferences, new permissions or volume changes.

## Startup console: NOT_CLOSED

The current audio output opened without manual Compile, loaded its scene and start UI, then full B room and island. Its complete startup console is `audio-startup-console-raw.txt`.

One red diagnostic persists: `[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面 (env: macOS,mg,2.02.2608080; lib: 3.17.3)`. No custom condition or private config was copied. This has not been established as a game exception or harmless IDE warning; zero-red startup is NOT accepted. Public project config edits have not removed it. No global IDE preferences/cache were changed to conceal it. Official documentation retrieval was unavailable; no unsupported cause is asserted.

HarmonyOS compatibility text is a generic library/platform notice, retained verbatim. CLI punycode deprecation is a CLI notice. Device info logging and Cocos LoadScene are informational.

Reopening B with enhancement enabled exposed a separate real startup blocker: missing `@babel/runtime/helpers/Objectvalues.js`, followed by failure to instantiate `virtual:///prerequisite-imports/main`. Full traces and screenshots are retained. D changes only project name and `setting.enhance=false` from the current audio output. D's independent initial open reaches the scene and start page, and actual read-only queries confirm seven clips. The helper failure was absent in D's saved startup log; app.json red remains. The finalizer now disables this extra enhancement pass for Creator-compiled local output; final bundle gate passes. This does not promise zero-red startup or establish a vendor-wide root cause.

B's initial blank debugger was never accepted as zero-error. C's debugger remained blank; its copied text was stale B text and is explicitly named NOT-CONSOLE. C's gameRoot candidate is not adopted.

## Audio: actual resource and lifecycle observations

Current audio output: actual normal start and leave inputs, seven clips, one GameAudio, one AudioBridge and two AudioSource components. UI click playback-request timestamps change after actual taps. AudioSource.playing is not evidence of audible one-shot completion.

D has the same compiled game/audio bytes and disables only DevTools enhancement. Normal start/leave, circular WeChat return button, entry 1000 to foreground, normal resume, and return-home navigation are observed. Read-only files record: background hidden=true, voices empty, world paused; foreground hidden=false, world still requires resume; normal resume restores island without needsResume. Component count remains one throughout. This validates event flags and resource/component lifecycle, not heard output. No BGM clip is assigned, so audible loop resumption is NOT_RUN.

Mute: NOT_RUN_UI. No normal mute control exists; project source references setMuted only at its definition. No direct setMuted call, event emit, onHide/onShow call or test preference write was used to manufacture acceptance.

Hearing: NOT_RUN. Available tools have no system-output recording channel. No new capture permission or volume change was made. Human listening or an authorized system-output capture channel is needed to close hearing acceptance.

## Invalid attempts retained

An attempted toolbar background action actually terminated the audio simulator. Its screenshot explicitly says terminated. Its query returned no state and is NOT a background pass. That window was normally restarted; D's independent first-open result used no Compile.

A system Chrome-for-Testing crash alert from an earlier sandbox launch was visible only in a bounded window-region capture, not the single-window image. It was dismissed using Ignore, without reporting to Apple. Inputs with no valid query return remain labelled invalid. Subsequent hide/show checks have actual JSON state and UI evidence.

This audit does not repeat or supersede the already passed R6 gameplay/reward tests. No phone fps, heat, B motion/contact or camera-route acceptance is claimed.
