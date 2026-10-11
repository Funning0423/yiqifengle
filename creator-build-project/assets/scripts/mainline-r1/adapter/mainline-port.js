'use strict';

var Core = require('../runtime/index'),
  copy = Core.Session.copy;
var COMMANDS = ['startStage', 'previewAction', 'cancelPreview', 'commitAction', 'pause', 'resume', 'resumeActive', 'requestExit', 'discardActive', 'retrySave', 'finish', 'openChest', 'claimRegion', 'equipCharm'];
function createSynchronousStorage(localStorage) {
  if (!localStorage || typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') throw Error('A real synchronous localStorage port must be injected');
  return {
    load: function load(k) {
      return localStorage.getItem(k);
    },
    save: function save(k, v) {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    }
  };
}
function present(snapshot, edge) {
  var s = copy(snapshot),
    v = s.visual;
  if (v && s.state === 'run.resolving') {
    var attempt = s.active.attemptId;
    s.active = copy(edge === 'after' ? v.afterState : v.beforeState);
    s.active.attemptId = attempt;
  }
  s.uiTitle = s.active ? s.active.name : '主线旅程';
  s.uiStatus = s.state === 'run.paused' ? '已暂停 · 请继续' : s.state === 'run.unsaved' || s.state === 'result.unsaved' ? '保存未完成 · 请重试' : s.state === 'error.readonly' ? '存档保护 · 请重新读取' : s.active ? s.active.name : '';
  if (s.result) s.uiResultCaption = s.result.saved ? s.result.outcome === 'won' ? s.result.stars + ' 星 · 已保存' : '本局已保存' : '胜利尚未保存';
  // Keep the real provider identity. Native UI must read active.goalOrder.
  return s;
}
function bind(controller, view, lifecycle) {
  var disposed = false,
    animating = null,
    epoch = 0;
  function refresh() {
    if (disposed) return;
    var s = controller.snapshot(),
      v = s.visual;
    if (animating && (!v || v.token !== animating)) {
      epoch++;
      animating = null;
      if (view.cancelAnimations) view.cancelAnimations();
    }
    view.render(present(s, 'before'));
    if (s.state !== 'run.resolving' || !v || animating === v.token) return;
    var token = v.token,
      ownEpoch = epoch,
      used = false;
    animating = token;
    try {
      view.animate(v, present(s, 'before'), function () {
        if (disposed || used || epoch !== ownEpoch) return;
        used = true;
        var current = controller.snapshot();
        if (!current.visual || current.visual.token !== token) return;
        view.render(present(current, 'after'));
        animating = null;
        var r = controller.finishVisualStep(token);
        if (r.ok) refresh();
      });
    } catch (e) {
      hide();
      if (view.onError) view.onError(e);
    }
  }
  function hide() {
    if (disposed) return {
      ok: false,
      reason: 'disposed'
    };
    epoch++;
    animating = null;
    var r = controller.onHide();
    if (view.cancelAnimations) view.cancelAnimations();
    refresh();
    return r;
  }
  function show() {
    if (disposed) return {
      ok: false,
      reason: 'disposed'
    };
    var r = controller.onShow();
    refresh();
    return r;
  }
  if (lifecycle && lifecycle.onHide) lifecycle.onHide(hide);
  if (lifecycle && lifecycle.onShow) lifecycle.onShow(show);
  refresh();
  return {
    refresh: refresh,
    hide: hide,
    show: show,
    command: function command(name) {
      if (disposed) return {
        ok: false,
        reason: 'disposed'
      };
      if (COMMANDS.indexOf(name) < 0 || typeof controller[name] !== 'function') return {
        ok: false,
        reason: 'unknown-command'
      };
      var args = Array.prototype.slice.call(arguments, 1),
        r = controller[name].apply(controller, args);
      refresh();
      return r;
    },
    dispose: function dispose() {
      if (disposed) return {
        ok: true,
        duplicate: true
      };
      var r = hide();
      disposed = true;
      epoch++;
      if (lifecycle && lifecycle.offHide) lifecycle.offHide(hide);
      if (lifecycle && lifecycle.offShow) lifecycle.offShow(show);
      if (view.cancelAnimations) view.cancelAnimations();
      return r;
    }
  };
}
function createPort(localStorage) {
  var platform = createSynchronousStorage(localStorage),
    journey = new Core.JourneyBridge(platform);
  return {
    platform: platform,
    journey: journey.readOnlyView(),
    journeySnapshot: function journeySnapshot() {
      return journey.snapshot();
    },
    createController: function createController() {
      return new Core.Controller({
        platform: platform,
        journeyBridge: journey
      });
    },
    bind: bind
  };
}
module.exports = {
  createPort: createPort,
  createSynchronousStorage: createSynchronousStorage,
  bind: bind,
  present: present
};
