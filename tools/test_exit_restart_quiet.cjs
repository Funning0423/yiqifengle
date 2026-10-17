// V1 follow-up: when the exit restarts after a background trip the wind/waves beds stop at once (no ~1 s tail).
const fs=require('fs'),path=require('path'),assert=require('assert');
const A=path.join(__dirname,'..','creator-build-project/assets/scripts/audio'),rd=f=>fs.readFileSync(path.join(A,f),'utf8');
const ga=rd('GameAudio.ts'),wa=rd('WindAudio.ts'),aa=rd('AmbienceAudio.ts');
assert(/static ambienceQuieters: Array<\(\) => void> = \[\];/.test(ga));
assert(/if \(state === 'standing' \|\| \(prev === 'paused' && state !== 'paused'\)\) GameAudio\.quietAmbience\(/.test(ga),'quiet on standing / leaving paused');
assert(/\(GameAudio as any\)\.ambienceQuieters\?\.push\(\(\) => \{ const w = WindAudio\.instance;/.test(wa),'wind registers');
assert(/\(GameAudio as any\)\.ambienceQuieters\?\.push\(\(\) => \(AmbienceAudio as any\)\.inst\?\.quiet\(\)\);/.test(aa),'waves register');
// Behaviour of the quiet bodies on a stand-in object (same statements as the source).
const wq=wa.match(/  quiet\(\) \{\n([\s\S]*?)\n  \}\n/)[1];
const w={s:.9,sWind:.8,gust:1,quietFor:0,softSrc:{volume:.6,playing:true},strongSrc:{volume:.5,playing:true},paused:0,pauseLoops(){for(const s of [this.softSrc,this.strongSrc])if(s.playing){s.playing=false;this.paused++;}}};
const calls=[];new Function('AmbienceAudio','WindAudio','IDLE_PAUSE_S',wq.replace(/this\./g,'self.').replace(/^/,'const self=this;\n')).call(w,{setWindExit:v=>calls.push(['exit',v])},{duckBgm:v=>calls.push(['duck',v])},1);
assert.equal(w.s,0);assert.equal(w.sWind,0);assert.equal(w.gust,-1);assert.equal(w.softSrc.volume,0);assert.equal(w.strongSrc.volume,0);assert.equal(w.paused,2);assert.deepStrictEqual(calls,[['exit',0],['duck',0]]);
const aq=aa.match(/  quiet\(\) \{ ([^\n]*) \}\n/)[1];const a={vol:.5,src:{volume:.5,playing:true,pause(){this.playing=false;}}};
new Function(aq.replace(/this\./g,'self.').replace(/^/,'const self=this;')).call(a);assert.equal(a.vol,0);assert.equal(a.src.volume,0);assert.equal(a.src.playing,false);
console.log('exit restart quiet OK');
// V1r: backgrounding zeroes the beds immediately (not only pauses them).
assert(/private onHide\(\) \{ GameAudio\.quietAmbience\('hide'\); this\.suspend\('hidden'\); \}/.test(ga),'quiet on hide');
console.log('hide quiet OK');
