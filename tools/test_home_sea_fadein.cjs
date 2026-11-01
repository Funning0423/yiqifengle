// A3 / A3b: 回家 audio headroom. (1) waves bed restarts from 0 (behaviour: tools/voice-bot/wind/test_wind_audio.cjs "A3b" block),
// (2) generic click -2.5 dB in code, (3) 80 ms duck to 0.6x on 回家 from a region before the fade-out.
const fs=require('fs'),path=require('path'),assert=require('assert');
const S=path.join(__dirname,'..','creator-build-project/assets/scripts'),rd=f=>fs.readFileSync(path.join(S,f),'utf8');
const aa=rd('audio/AmbienceAudio.ts'),ga=rd('audio/GameAudio.ts'),wb=rd('WorldIntegrationBoot.ts');
// (1) waves: armed 0-start on every not-playing -> play, except the slider-at-0 resume; first-frame log.
assert(/\} else if \(!src\.playing && !this\.sliderPaused && !this\.startArmed\) \{\n[^\n]*\n      this\.vol = 0; this\.startArmed = true;/.test(aa),'0-start before play');
assert(/this\.sliderPaused = allowed && musicSlider\(\) <= 0\.001;/.test(aa),'slider exception');
assert(/qfAudioLog\('waves-start', \{ vol: \+heard\.toFixed\(3\), from: this\.sliderPaused \? 'slider' : 'zero' \}\)/.test(aa),'waves-start log');
// (2) click gain
const m=ga.match(/export const UI_CLICK_VOLUME = Math\.pow\(10, (-?[\d.]+) \/ 20\);/);assert(m&&+m[1]===-2.5,'click -2.5 dB');
const click=Math.pow(10,-2.5/20);
for(const re of [/onButton\(\) \{ this\.play\('sfx_ui_click', UI_CLICK_VOLUME\); \}/,/onToolTap\(\) \{ this\.play\('sfx_ui_click', UI_CLICK_VOLUME\); \}/,/this\.play\(name, tapVol\(name\)\);/])assert(re.test(ga),'click gain applied '+re);
assert(!/'sfx_ui_click', UI_TAP_VOLUME/.test(ga),'no full-gain click left');
// (3) duck triggered on 回家 from a region
assert(/export const HOME_DUCK = \{ gain: 0\.6, seconds: 0\.08 \} as const;/.test(ga));
assert(/homeDuckOut\(seconds: number, wait: \(s: number\) => Promise<void>\): Promise<void> \{\n    const d = HOME_DUCK; this\.fadeTransition\(d\.gain, d\.seconds\);\n    qfAudioLog\('home-duck'/.test(ga),'duck first');
assert(/if \(this\.transTo === d\.gain\) this\.fadeTransition\(0, Math\.max\(0, seconds - d\.seconds\)\);/.test(ga),'then fade to 0 in the rest of outS');
assert(wb.includes("audioOut:sec=>typeof audio?.homeDuckOut==='function'?audio.homeDuckOut(sec,wait):audio?.fadeTransition?.(0,sec),"),'goHome uses the duck');
// Headroom model at the Mac peak (+50 ms after the tap): old = click(1.0x) + wind bed(1.0x) reached 1.000.
// New: click x0.750, and both (live sfx + bed) x transition gain; old fade 0->0 over 0.4 s gave 0.875 at 50 ms, duck gives 1-0.4*50/80 = 0.75.
const oldG=1-50/400,newG=1-(1-0.6)*50/80,oldPeak=1.0;
const worst=oldPeak/oldG*newG*Math.max(click,1)*1, clickShare=0.5;   // click and wind roughly equal at the peak
const est=oldPeak/oldG*newG*(clickShare*click+(1-clickShare));
assert(est<0.80&&20*Math.log10(est)<-1.9,'estimated peak <= -1.9 dBFS, got '+est.toFixed(3));
assert(worst<0.9,'even with no click gain the duck alone keeps it under 0.9: '+worst.toFixed(3));
console.log('home audio headroom OK est='+est.toFixed(3)+' ('+(20*Math.log10(est)).toFixed(1)+' dBFS)');
