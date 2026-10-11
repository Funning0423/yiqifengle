/* GROKBOT_AUTOPLAY touch prelude (T0, GGbot). TEST BUILDS ONLY: inject_prelude.sh prepends this to the
   WeChat build output game.js so it runs BEFORE the Cocos adapter/engine copy wx.onTouch*. It records every
   listener registered through wx.onTouchStart/Move/End/Cancel (engine touch source, adapter, T1 L3) and
   forwards to the real wx, unchanged. __gbTouch.emit(key, rawEvent) replays a synthetic raw event into the
   same listeners a real finger reaches. Never shipped: check_release_strip.sh fails if "__gbTouch" is found. */
(function(){var g=typeof GameGlobal!=='undefined'?GameGlobal:(typeof globalThis!=='undefined'?globalThis:this);var w=g&&g.wx;if(!w||g.__gbTouch)return;
var keys=['TouchStart','TouchMove','TouchEnd','TouchCancel'],L={},ok=true;
keys.forEach(function(k){var on=w['on'+k],off=w['off'+k],set=L['on'+k]=[];if(typeof on!=='function'){ok=false;return;}
 var onW=function(f){if(typeof f==='function'&&set.indexOf(f)<0)set.push(f);return on.apply(w,arguments);};
 var offW=function(f){if(typeof f==='function'){var i=set.indexOf(f);if(i>=0)set.splice(i,1);}else set.length=0;return typeof off==='function'?off.apply(w,arguments):undefined;};
 try{w['on'+k]=onW;w['off'+k]=offW;}catch(e){}if(w['on'+k]!==onW)ok=false;});
g.__gbTouch={wrapped:ok,listeners:L,emit:function(key,ev){var l=(L[key]||[]).slice();for(var i=0;i<l.length;i++){try{l[i](ev);}catch(e){console.error('GB_MARK touch-listener-exception',e);}}return l.length;}};
if(!ok){g.__gbTouch.emit=null;console.warn('GB_MARK touch-prelude-unavailable 0 reason=wx-not-writable');}
/*__GB_MODE__*/})();
