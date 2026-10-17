/* QF-0008v3 first-open audit shim — injected ONLY into the per-run TEST COPY of game.js by wechat_first_open_audit.cjs. Never ship.
 * v3: in-project positive control ("canary": one console.error carrying this run's token, at boot and on ping), capability record
 * (which console levels / wx handlers were really installed, and whether they are still installed when read), overflow counter. */
;(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : (typeof GameGlobal !== 'undefined' ? GameGlobal : this);
  if (!g || g.__QF_FIRST_OPEN_AUDIT__) return;
  var MAX = 500;
  var A = g.__QF_FIRST_OPEN_AUDIT__ = {version: '0008v3', token: '__QF_TOKEN__', installedAt: Date.now(), errors: [], warns: [], logs: [], onError: [], unhandled: [], dropped: 0,
    heartbeat: false, canaryAtBoot: false, wrapped: [], onErrorRegistered: false, onUnhandledRejectionRegistered: false, installErrors: []};
  function fmt(args) {
    try {
      return Array.prototype.map.call(args, function (a) {
        if (a && a.stack) return String(a.message || '') + '\n' + String(a.stack);
        if (a && typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
        return String(a);
      }).join(' ').slice(0, 4000);
    } catch (e) { return '<unformattable>'; }
  }
  function push(list, rec) { if (list.length < MAX) list.push(rec); else A.dropped++; }
  var c = g.console || (typeof console !== 'undefined' ? console : null);
  var wrappers = {};
  if (c) ['error', 'warn', 'log', 'info'].forEach(function (level) {
    var orig = c[level];
    if (typeof orig !== 'function') { A.installErrors.push('console.' + level + ' missing'); return; }
    var w = function () {
      try { push(level === 'error' ? A.errors : level === 'warn' ? A.warns : A.logs, {t: Date.now(), level: level, msg: fmt(arguments)}); } catch (e) {}
      return orig.apply(c, arguments);
    };
    try { c[level] = w; wrappers[level] = w; A.wrapped.push(level); } catch (e) { A.installErrors.push('console.' + level + ': ' + e); }
  }); else A.installErrors.push('no console');
  try { if (typeof wx !== 'undefined' && wx.onError) { wx.onError(function (e) { push(A.onError, {t: Date.now(), msg: fmt([e && (e.message || e)]), stack: e && e.stack ? String(e.stack) : ''}); }); A.onErrorRegistered = true; } } catch (e) { A.installErrors.push('wx.onError: ' + e); }
  try { if (typeof wx !== 'undefined' && wx.onUnhandledRejection) { wx.onUnhandledRejection(function (r) { push(A.unhandled, {t: Date.now(), msg: fmt([r && (r.reason || r)])}); }); A.onUnhandledRejectionRegistered = true; } } catch (e) { A.installErrors.push('wx.onUnhandledRejection: ' + e); }
  /** levels whose wrapper is still the installed function (game code may replace console later) */
  A.stillWrapped = function () { var out = []; for (var k in wrappers) if (c && c[k] === wrappers[k]) out.push(k); return out; };
  A.ping = function () { if (c) { c.log('[QF-AUDIT-HEARTBEAT-LATE] ' + A.token); c.error('[QF-AUDIT-CANARY-LATE] ' + A.token); } return A.token; };
  try { if (c) { c.log('[QF-AUDIT-HEARTBEAT] ' + A.token); A.heartbeat = true; c.error('[QF-AUDIT-CANARY] ' + A.token); A.canaryAtBoot = true; } } catch (e) { A.installErrors.push('boot heartbeat/canary: ' + e); }
})();
