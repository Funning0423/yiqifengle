/* V4's independent, visible-time camera/character/door tracks.
 * Browser: load camera-v4-data.js, then camera-v4.js; use CameraV4.sample(seconds).
 * CommonJS: require('./camera-v4'). No DOM, clock, storage, timers or dependencies.
 * All positions are Y-up world units. Girl yaw is radians; doorAngle is degrees.
 * Sampling is absolute-time, history-independent, and clamps to [0, 18].
 * Each returned pose is owned by the caller; mutations cannot alter source data.
 *
 * Optional pure clock (the game may instead provide its own visible seconds):
 *   var clock = new CameraV4.VisibleTimeline();
 *   clock.tick(nowMilliseconds);       // first call establishes a baseline
 *   clock.pause(); clock.resume();     // next tick rebases: no background jump
 *   clock.resume(nowMilliseconds);     // explicit baseline is also supported
 *   clock.advance(dtSeconds);          // alternative externally managed dt API
 *   clock.restart();                   // explicit repeat, starts at time zero
 *   clock.cancel();                    // freezes; only restart can start again
 * All methods return snapshot(): {time, status, paused, done, cancelled, runId, pose}.
 * Use either tick or advance. Switching to advance drops the tick baseline.
 * No completion callbacks are invoked; commit game state in the owning controller.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./camera-v4-data'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./camera-v4-data'], factory);
  } else root.CameraV4 = factory(root.CameraV4Data);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
  'use strict';
  if (!data || !data.frames || data.frames.length !== 541) {
    throw new Error('CameraV4 requires the 541 final V4 pose samples');
  }
  var frames = data.frames, count = frames.length, width = data.columns.length;
  var duration = data.duration, slopes = [], i, channel;

  function finite(value) { return typeof value === 'number' && isFinite(value); }
  function clampTime(value) {
    if (typeof value !== 'number' || value !== value) return 0;
    return Math.max(0, Math.min(duration, value));
  }

  // Fritsch-Carlson/PCHIP derivatives preserve the shape of each dense source
  // channel. Unlike an unconstrained cubic they cannot overshoot door/sit bounds
  // or create motion in a held segment. Exact source samples remain exact.
  function endSlope(h0, h1, d0, d1) {
    var result = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (result * d0 <= 0) return 0;
    if (d0 * d1 < 0 && Math.abs(result) > 3 * Math.abs(d0)) return 3 * d0;
    return result;
  }
  for (i = 0; i < count; i++) slopes[i] = new Array(width);
  for (channel = 1; channel < width; channel++) {
    var intervals = [], secants = [];
    for (i = 0; i < count - 1; i++) {
      intervals[i] = frames[i + 1][0] - frames[i][0];
      secants[i] = (frames[i + 1][channel] - frames[i][channel]) / intervals[i];
    }
    slopes[0][channel] = endSlope(intervals[0], intervals[1], secants[0], secants[1]);
    slopes[count - 1][channel] = endSlope(intervals[count - 2], intervals[count - 3],
      secants[count - 2], secants[count - 3]);
    for (i = 1; i < count - 1; i++) {
      var before = secants[i - 1], after = secants[i];
      if (before * after <= 0) slopes[i][channel] = 0;
      else {
        var w1 = 2 * intervals[i] + intervals[i - 1];
        var w2 = intervals[i] + 2 * intervals[i - 1];
        slopes[i][channel] = (w1 + w2) / (w1 / before + w2 / after);
      }
    }
  }

  function poseFromRow(row, time) {
    return {
      time: time,
      camera: {
        position: [row[1], row[2], row[3]],
        lookat: [row[4], row[5], row[6]],
        verticalFov: data.verticalFov
      },
      girl: {
        position: [row[7], row[8], row[9]],
        yaw: row[10], distance: row[11], speed: row[12], sit: row[13]
      },
      doorAngle: row[14]
    };
  }

  function sample(seconds) {
    var time = clampTime(seconds);
    if (time === 0) return poseFromRow(frames[0], time);
    if (time === duration) return poseFromRow(frames[count - 1], time);
    // Binary search respects the exported timestamps (rounded to six decimals),
    // so every one of the 541 recorded poses reproduces without time drift.
    var low = 0, high = count - 1;
    while (high - low > 1) {
      var mid = (low + high) >> 1;
      if (frames[mid][0] <= time) low = mid;
      else high = mid;
    }
    var a = frames[low], b = frames[high];
    if (time === a[0]) return poseFromRow(a, time);
    var h = b[0] - a[0], u = (time - a[0]) / h;
    var u2 = u * u, u3 = u2 * u;
    var h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u;
    var h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    var row = new Array(width);
    for (var col = 1; col < width; col++) {
      if (a[col] === b[col]) row[col] = a[col];
      else {
        var value = h00 * a[col] + h10 * h * slopes[low][col] +
          h01 * b[col] + h11 * h * slopes[high][col];
        // Limit floating-point noise at monotone interval bounds too.
        row[col] = Math.max(Math.min(a[col], b[col]), Math.min(Math.max(a[col], b[col]), value));
      }
    }
    return poseFromRow(row, time);
  }

  function VisibleTimeline() {
    this.time = 0;
    this.status = 'active';
    this.runId = 1;
    this._lastTick = null;
    this._remainder = 0;
  }
  VisibleTimeline.prototype.snapshot = function () {
    return {
      time: this.time,
      status: this.status,
      paused: this.status === 'paused',
      done: this.status === 'completed',
      cancelled: this.status === 'cancelled',
      runId: this.runId,
      pose: sample(this.time)
    };
  };
  VisibleTimeline.prototype._advance = function (seconds) {
    if (this.status !== 'active' || !finite(seconds) || seconds <= 0) return;
    // Compensated accumulation keeps different visible dt partitions aligned.
    var adjusted = seconds - this._remainder;
    var sum = this.time + adjusted;
    this._remainder = (sum - this.time) - adjusted;
    this.time = Math.min(duration, sum);
    if (this.time >= duration) {
      this.time = duration;
      this._remainder = 0;
      this.status = 'completed';
      this._lastTick = null;
    }
  };
  VisibleTimeline.prototype.advance = function (seconds) {
    this._lastTick = null;
    this._advance(seconds);
    return this.snapshot();
  };
  VisibleTimeline.prototype.tick = function (nowMilliseconds) {
    if (this.status !== 'active' || !finite(nowMilliseconds)) return this.snapshot();
    if (this._lastTick === null) this._lastTick = nowMilliseconds;
    else if (nowMilliseconds > this._lastTick) {
      var seconds = (nowMilliseconds - this._lastTick) / 1000;
      this._lastTick = nowMilliseconds;
      this._advance(seconds);
    }
    return this.snapshot();
  };
  VisibleTimeline.prototype.pause = function () {
    if (this.status === 'active') {
      this.status = 'paused';
      this._lastTick = null;
    }
    return this.snapshot();
  };
  VisibleTimeline.prototype.resume = function (nowMilliseconds) {
    if (this.status === 'paused') {
      this.status = 'active';
      this._lastTick = finite(nowMilliseconds) ? nowMilliseconds : null;
    }
    return this.snapshot();
  };
  VisibleTimeline.prototype.cancel = function () {
    if (this.status === 'active' || this.status === 'paused') {
      this.status = 'cancelled';
      this._lastTick = null;
    }
    return this.snapshot();
  };
  VisibleTimeline.prototype.restart = function (nowMilliseconds) {
    this.time = 0;
    this.status = 'active';
    this.runId++;
    this._remainder = 0;
    this._lastTick = finite(nowMilliseconds) ? nowMilliseconds : null;
    return this.snapshot();
  };
  VisibleTimeline.prototype.repeat = VisibleTimeline.prototype.restart;

  return Object.freeze({
    duration: duration,
    verticalFov: data.verticalFov,
    sampleRate: data.sampleRate,
    sampleCount: count,
    source: data.source,
    sample: sample,
    VisibleTimeline: VisibleTimeline,
    createTimeline: function () { return new VisibleTimeline(); }
  });
}));
