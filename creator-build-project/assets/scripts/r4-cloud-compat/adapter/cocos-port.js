/* Engine-free binding seam. Inject Cocos APIs; this is not a compiled Cocos project. */
'use strict';

var COMMANDS = new Set(['selectRegion', 'selectStage', 'startStage', 'previewAction', 'cancelPreview', 'commitAction', 'pause', 'resume', 'resumeActive', 'requestExit', 'discardActive', 'retrySave', 'finish', 'claimMemento']);
function createSynchronousStorage(localStorage) {
  if (!localStorage || typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') throw Error('A synchronous localStorage-like object is required');
  return {
    load: function load(key) {
      return localStorage.getItem(key);
    },
    save: function save(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }
  };
}
function bindChallengeController(controller, view, lifecycle) {
  var _lifecycle$onHide, _lifecycle$onShow;
  if (!controller || typeof controller.snapshot !== 'function' || !view || typeof view.render !== 'function' || typeof view.animate !== 'function') throw Error('Controller and render/animate view are required');
  var disposed = false,
    animating = null;
  function presentationFailed(error) {
    if (disposed) return;
    animating = null;
    controller.pause();
    try { if (view.cancelAnimations) view.cancelAnimations(); } catch (_) {}
    try { view.render(controller.snapshot()); } catch (_) {}
    console.error('[QF_BOARD_PRESENTATION_ERROR]', String(error && error.stack || error));
    if (view.onError) { try { view.onError(error); } catch (_) {} }
  }
  function refresh() {
    var _snapshot$visual;
    if (disposed) return;
    var snapshot = controller.snapshot();
    if (animating && ((_snapshot$visual = snapshot.visual) === null || _snapshot$visual === void 0 ? void 0 : _snapshot$visual.token) !== animating) {
      var _view$cancelAnimation;
      animating = null;
      (_view$cancelAnimation = view.cancelAnimations) === null || _view$cancelAnimation === void 0 || _view$cancelAnimation.call(view);
    }
    try { view.render(snapshot); } catch (error) { presentationFailed(error); return; }
    var visual = snapshot.visual;
    if (snapshot.state !== 'run.resolving' || !visual || animating === visual.token) return;
    var token = visual.token;
    animating = token;
    try {
      view.animate(visual, snapshot, function () {
        if (disposed) return;
        if (animating === token) animating = null;
        try {
          var result = controller.finishVisualStep(token);
          // A stale completion is a no-op, including during a newer animation.
          if (result.ok || result.reason !== 'stale-token') refresh();
        } catch (error) { presentationFailed(error); }
      });
    } catch (error) {
      presentationFailed(error);
    }
  }
  function hide() {
    if (!disposed) {
      var _view$cancelAnimation3;
      var result = controller.onHide();
      animating = null;
      (_view$cancelAnimation3 = view.cancelAnimations) === null || _view$cancelAnimation3 === void 0 || _view$cancelAnimation3.call(view);
      refresh();
      return result;
    }
  }
  function show() {
    if (!disposed) {
      var result = controller.onShow();
      refresh();
      return result;
    }
  }
  lifecycle === null || lifecycle === void 0 || (_lifecycle$onHide = lifecycle.onHide) === null || _lifecycle$onHide === void 0 || _lifecycle$onHide.call(lifecycle, hide);
  lifecycle === null || lifecycle === void 0 || (_lifecycle$onShow = lifecycle.onShow) === null || _lifecycle$onShow === void 0 || _lifecycle$onShow.call(lifecycle, show);
  refresh();
  return {
    command: function command(name) {
      if (disposed) return {
        ok: false,
        reason: 'disposed'
      };
      if (!COMMANDS.has(name)) return {
        ok: false,
        reason: 'unknown-command'
      };
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      var result = controller[name].apply(controller, args);
      refresh();
      return result;
    },
    refresh: refresh,
    hide: hide,
    show: show,
    dispose: function dispose() {
      var _lifecycle$offHide, _lifecycle$offShow, _view$cancelAnimation4;
      if (disposed) return {
        ok: true,
        duplicate: true
      };
      var result = hide();
      disposed = true;
      lifecycle === null || lifecycle === void 0 || (_lifecycle$offHide = lifecycle.offHide) === null || _lifecycle$offHide === void 0 || _lifecycle$offHide.call(lifecycle, hide);
      lifecycle === null || lifecycle === void 0 || (_lifecycle$offShow = lifecycle.offShow) === null || _lifecycle$offShow === void 0 || _lifecycle$offShow.call(lifecycle, show);
      (_view$cancelAnimation4 = view.cancelAnimations) === null || _view$cancelAnimation4 === void 0 || _view$cancelAnimation4.call(view);
      return result; // On failure, retain storage/error UI. Cold restore replays the durable intent.
    }
  };
}
module.exports = {
  createSynchronousStorage: createSynchronousStorage,
  bindChallengeController: bindChallengeController
};
