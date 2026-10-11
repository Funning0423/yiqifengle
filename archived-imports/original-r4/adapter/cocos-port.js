/* Engine-free binding seam. Inject Cocos APIs; this is not a compiled Cocos project. */
'use strict';
const COMMANDS = new Set(['selectRegion', 'selectStage', 'startStage', 'previewAction', 'cancelPreview', 'commitAction', 'pause', 'resume', 'resumeActive', 'requestExit', 'discardActive', 'retrySave', 'finish', 'claimMemento']);
function createSynchronousStorage(localStorage) {
  if (!localStorage || typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') throw Error('A synchronous localStorage-like object is required');
  return {
    load(key) { return localStorage.getItem(key); },
    save(key, value) { localStorage.setItem(key, JSON.stringify(value)); return true; }
  };
}
function bindChallengeController(controller, view, lifecycle) {
  if (!controller || typeof controller.snapshot !== 'function' || !view || typeof view.render !== 'function' || typeof view.animate !== 'function') throw Error('Controller and render/animate view are required');
  let disposed = false, animating = null;
  function refresh() {
    if (disposed) return;
    const snapshot = controller.snapshot();
    if (animating && snapshot.visual?.token !== animating) { animating = null; view.cancelAnimations?.(); }
    view.render(snapshot);
    const visual = snapshot.visual;
    if (snapshot.state !== 'run.resolving' || !visual || animating === visual.token) return;
    const token = visual.token; animating = token;
    try {
      view.animate(visual, snapshot, () => {
        if (disposed) return;
        if (animating === token) animating = null;
        const result = controller.finishVisualStep(token);
        // A stale completion is a no-op, including when it arrives during a newer animation.
        if (result.ok || result.reason !== 'stale-token') refresh();
      });
    } catch (error) {
      controller.onHide(); animating = null; view.cancelAnimations?.(); view.render(controller.snapshot()); view.onError?.(error);
    }
  }
  function hide() { if (!disposed) { const result = controller.onHide(); animating = null; view.cancelAnimations?.(); refresh(); return result; } }
  function show() { if (!disposed) { const result = controller.onShow(); refresh(); return result; } }
  lifecycle?.onHide?.(hide); lifecycle?.onShow?.(show);
  refresh();
  return {
    command(name, ...args) { if (disposed) return {ok: false, reason: 'disposed'}; if (!COMMANDS.has(name)) return {ok: false, reason: 'unknown-command'}; const result = controller[name](...args); refresh(); return result; },
    refresh, hide, show,
    dispose() {
      if (disposed) return {ok: true, duplicate: true};
      const result = hide(); disposed = true;
      lifecycle?.offHide?.(hide); lifecycle?.offShow?.(show); view.cancelAnimations?.();
      return result; // On failure, retain storage/error UI. Cold restore replays the durable intent.
    }
  };
}
module.exports = {createSynchronousStorage, bindChallengeController};
