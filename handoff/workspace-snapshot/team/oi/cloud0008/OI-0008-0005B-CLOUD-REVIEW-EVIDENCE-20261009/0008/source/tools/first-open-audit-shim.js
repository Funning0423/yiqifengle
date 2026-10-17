/* QF-0008 first-open audit shim — injected ONLY into the per-run TEST COPY of game.js by wechat_first_open_audit.cjs. Never ship. */
;(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this);
  if (!g || g.__QF_FIRST_OPEN_AUDIT__) return;
  var A = g.__QF_FIRST_OPEN_AUDIT__ = {version: '0008-v1', token: '__QF_TOKEN__', installedAt: Date.now(), errors: [], warns: [], onError: [], unhandled: [], heartbeat: false, wrapped: []};
  function fmt(args) {
    try {
      return Array.prototype.map.call(args, function (a) {
        if (a && a.stack) return String(a.message || '') + '\n' + String(a.stack);
        if (a && typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
        return String(a);
      }).join(' ').slice(0, 4000);
    } catch (e) { return '<unformattable>'; }
  }
  var c = g.console || (typeof console !== 'undefined' ? console : null);
  if (c) ['error', 'warn'].forEach(function (level) {
    var orig = c[level];
    if (typeof orig !== 'function') return;
    c[level] = function () {
      try { var list = level === 'error' ? A.errors : A.warns; if (list.length < 500) list.push({t: Date.now(), msg: fmt(arguments)}); } catch (e) {}
      return orig.apply(c, arguments);
    };
    A.wrapped.push(level);
  });
  try { if (typeof wx !== 'undefined' && wx.onError) wx.onError(function (e) { A.onError.push({t: Date.now(), msg: fmt([e && (e.message || e)]), stack: e && e.stack ? String(e.stack) : ''}); }); } catch (e) {}
  try { if (typeof wx !== 'undefined' && wx.onUnhandledRejection) wx.onUnhandledRejection(function (r) { A.unhandled.push({t: Date.now(), msg: fmt([r && (r.reason || r)])}); }); } catch (e) {}
  A.ping = function () { if (c) c.log('[QF-AUDIT-HEARTBEAT-LATE] ' + A.token); return A.token; };
  try { if (c) c.log('[QF-AUDIT-HEARTBEAT] ' + A.token); A.heartbeat = true; } catch (e) {}
})();
