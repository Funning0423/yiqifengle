/** Raw frame intervals only. Never represents GPU timing or JS work time. */
export class FrameWindow {
  private samples: Float64Array;
  private cursor = 0;
  private count = 0;
  private total = 0;
  private previous: number | null = null;
  constructor(capacity = 120000) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Invalid capacity');
    this.samples = new Float64Array(capacity);
  }
  discontinuity(): void { this.previous = null; }
  tick(nowMs: number): void {
    if (!Number.isFinite(nowMs)) throw new Error('Invalid timestamp');
    if (this.previous !== null && nowMs > this.previous) {
      this.samples[this.cursor] = nowMs - this.previous;
      this.cursor = (this.cursor + 1) % this.samples.length;
      this.count = Math.min(this.count + 1, this.samples.length);
      this.total++;
    }
    this.previous = nowMs;
  }
  raw(): number[] {
    const start = this.count === this.samples.length ? this.cursor : 0;
    return Array.from({length: this.count}, (_, i) => this.samples[(start + i) % this.samples.length]);
  }
  report() {
    const sorted = this.raw().sort((a, b) => a - b);
    const percentile = (q: number) => sorted.length ? sorted[Math.ceil(q * sorted.length) - 1] : null;
    return { sampleCount: this.count, totalSampleCount: this.total, droppedSampleCount: this.total - this.count,
      medianFrameIntervalMs: percentile(0.5), p95FrameIntervalMs: percentile(0.95),
      maxFrameIntervalMs: sorted.length ? sorted[sorted.length - 1] : null,
      stallsOver100Ms: sorted.filter(n => n > 100).length, gpuMs: null, mainThreadWorkMs: null,
      metric: 'observed frame callback interval; not GPU or CPU work duration' };
  }
}
