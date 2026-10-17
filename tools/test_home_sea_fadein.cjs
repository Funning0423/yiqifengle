// A3: returning home from the meadow the waves bed fades in from 0 (no stale level stacking on the BGM fade-in).
const fs=require('fs'),path=require('path'),assert=require('assert');
const aa=fs.readFileSync(path.join(__dirname,'..','creator-build-project/assets/scripts/audio/AmbienceAudio.ts'),'utf8');
const reset='    if (this.bedOn && !src.playing) this.vol = 0;';
assert(aa.includes('const k = Math.min(1, dt * SMOOTH_PER_S);\n    // A3:')&&aa.includes(reset),'reset before smoothing');
assert(/console\.warn\('\[AmbienceAudio\] waves play failed', e\); \} \}\n    \}\n    this\.bedOn = src\.playing;\n/.test(aa),'bedOn recorded after play/pause');
assert(/private bedOn = false;/.test(aa));
// Stand-in loop with the same statements: bed playing at 0.441, then externally stopped on the home transition.
const self={vol:0.441,bedOn:true},src={playing:false},k=4/60,bed=1;let first=-1;
for(let i=0;i<120;i++){
  if(self.bedOn&&!src.playing)self.vol=0;
  self.vol+=(0.55-self.vol)*k;const heard=self.vol*bed;
  if(heard>=0.002&&!src.playing){src.playing=true;if(first<0)first=heard;}
  self.bedOn=src.playing;
}
assert(first>0&&first<0.05,'restart starts near 0, got '+first);
assert(self.vol>0.4,'reaches bed level in ~2 s, got '+self.vol);
console.log('home sea fade-in OK first='+first.toFixed(4));
