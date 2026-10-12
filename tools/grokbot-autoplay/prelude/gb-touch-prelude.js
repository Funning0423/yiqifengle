/* GROKBOT_AUTOPLAY touch prelude (T0, GGbot). TEST BUILDS ONLY: inject_prelude.sh prepends this to the
   WeChat build output game.js so it runs BEFORE the Cocos adapter/engine copy wx.onTouch*. It records every
   listener registered through wx.onTouchStart/Move/End/Cancel (engine touch source, adapter, T1 L3) and
   forwards to the real wx, unchanged. __gbTouch.emit(key, rawEvent) replays a synthetic raw event into the
   same listeners a real finger reaches. Never shipped: check_release_strip.sh fails if "__gbTouch" is found. */
/* T0 boot timing (GrokbotBoot.ts origin): __gbBoot.epoch = Date.now() at the first line of game.js; wx.loadSubpackage is wrapped
   (same options object fields, original success/fail/complete still called, same task returned) to record each subpackage download. */
(function(){var g=typeof GameGlobal!=='undefined'?GameGlobal:(typeof globalThis!=='undefined'?globalThis:this);if(!g||g.__gbBoot)return;
var b=g.__gbBoot={epoch:Date.now(),perf:(typeof performance!=='undefined'&&performance&&typeof performance.now==='function')?performance.now():null,sub:[],subWrapped:false};
var w=g.wx;if(!w||typeof w.loadSubpackage!=='function')return;var orig=w.loadSubpackage;
var wrapped=function(o){var e={name:o&&(o.name||o.root)||'?',begin:Date.now(),end:null,ok:null};b.sub.push(e);var o2={},k;if(o)for(k in o)o2[k]=o[k];
 var fin=function(ok){if(e.end===null){e.end=Date.now();e.ok=ok;}};
 o2.success=function(){fin(true);if(o&&typeof o.success==='function')return o.success.apply(this,arguments);};
 o2.fail=function(){fin(false);if(o&&typeof o.fail==='function')return o.fail.apply(this,arguments);};
 return orig.call(w,o2);};
try{w.loadSubpackage=wrapped;}catch(x){}b.subWrapped=w.loadSubpackage===wrapped;})();
(function(){var g=typeof GameGlobal!=='undefined'?GameGlobal:(typeof globalThis!=='undefined'?globalThis:this);var w=g&&g.wx;if(!w||g.__gbTouch)return;
var keys=['TouchStart','TouchMove','TouchEnd','TouchCancel'],L={},ok=true;
keys.forEach(function(k){var on=w['on'+k],off=w['off'+k],set=L['on'+k]=[];if(typeof on!=='function'){ok=false;return;}
 var onW=function(f){if(typeof f==='function'&&set.indexOf(f)<0)set.push(f);return on.apply(w,arguments);};
 var offW=function(f){if(typeof f==='function'){var i=set.indexOf(f);if(i>=0)set.splice(i,1);}else set.length=0;return typeof off==='function'?off.apply(w,arguments):undefined;};
 try{w['on'+k]=onW;w['off'+k]=offW;}catch(e){}if(w['on'+k]!==onW)ok=false;});
g.__gbTouch={wrapped:ok,listeners:L,emit:function(key,ev){var l=(L[key]||[]).slice();for(var i=0;i<l.length;i++){try{l[i](ev);}catch(e){console.error('GB_MARK touch-listener-exception',e);}}return l.length;}};
if(!ok){g.__gbTouch.emit=null;console.warn('GB_MARK touch-prelude-unavailable 0 reason=wx-not-writable');}
/*__GB_MODE__*/})();
