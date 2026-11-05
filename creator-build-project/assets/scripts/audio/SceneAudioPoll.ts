/** A/B (2026-11-05): SceneMusic / LandmarkAudio wall-clock polls suspected of fixed-interval whole-UI stutter.
 *  When false (default), skip:
 *   - SceneMusic 0.25 s probe/resolve/publish after first BGM load (keep one-shot first setMusic)
 *   - LandmarkAudio update (0.5 s anchor tree walk + per-frame distance/core.step)
 *  Standup / Morph / PeriodHeavy / TSW untouched.
 *  setSceneAudioPollEnabled(true) restores prior periodic behavior for rollback. */
export let SCENE_AUDIO_POLL_ENABLED=false;
export function setSceneAudioPollEnabled(on:boolean):void{SCENE_AUDIO_POLL_ENABLED=!!on;}
