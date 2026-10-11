import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameWindow } from '../creator-project/assets/scripts/FrameWindow.ts';
import { VisualEpoch } from '../creator-project/assets/scripts/VisualEpoch.ts';

test('frame window is bounded, preserves chronological wrap and raw stalls', () => {
  const frames = new FrameWindow(3);
  [0, 10, 30, 60, 170].forEach(n => frames.tick(n));
  assert.deepEqual(frames.raw(), [20, 30, 110]);
  assert.equal(frames.report().medianFrameIntervalMs, 30);
  assert.equal(frames.report().p95FrameIntervalMs, 110);
  assert.equal(frames.report().droppedSampleCount, 1);
  assert.equal(frames.report().stallsOver100Ms, 1);
  assert.equal(frames.report().gpuMs, null);
});
test('background gaps excluded while actual stalls stay visible', () => {
  const frames = new FrameWindow();
  frames.tick(0); frames.tick(16); frames.discontinuity(); frames.tick(12000); frames.tick(12017);
  assert.deepEqual(frames.raw(), [16, 17]);
  assert.equal(new FrameWindow().report().medianFrameIntervalMs, null);
});
test('old visual callbacks and duplicate completions cannot acknowledge R4 steps', () => {
  const view = new VisualEpoch(); let acknowledgements = 0;
  const first = view.once('a', () => acknowledgements++);
  assert.throws(() => view.once('a', () => {}));
  view.invalidate(); assert.equal(first(), false);
  const current = view.once('b', () => acknowledgements++);
  assert.equal(current(), true); assert.equal(current(), false); assert.equal(acknowledgements, 1);
  assert.throws(() => view.once('b', () => {}));
});
