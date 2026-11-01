/** Generation-owned preview loader. No storage, global asset release or shared-request cancellation. */
export class PreviewLease<T> {
  private generation = 0; private disposed = false; private live: T | null = null;
  private cancelWait: (() => void) | null = null;
  constructor(private release: (value: T) => void, private timeoutMs = 30000) {}
  async load(provider: () => Promise<T>): Promise<T> {
    if (this.disposed) throw Error('preview-disposed');
    this.cancelWait?.(); const generation = ++this.generation;
    if (this.live !== null) { this.release(this.live); this.live = null; }
    let timer: any; let settled = false;
    return new Promise<T>((resolve, reject) => {
      const fail = (reason: string) => { if (settled) return; settled = true; clearTimeout(timer); if (generation === this.generation) this.cancelWait = null; reject(Error(reason)); };
      this.cancelWait = () => fail('preview-superseded'); timer = setTimeout(() => fail('preview-load-timeout'), this.timeoutMs);
      Promise.resolve().then(() => { if (settled || this.disposed || generation !== this.generation) throw Error('preview-superseded'); return provider(); }).then(value => {
        if (settled || this.disposed || generation !== this.generation) { this.release(value); return; }
        settled = true; clearTimeout(timer); this.cancelWait = null; this.live = value; resolve(value);
      }, error => { if (settled) return; settled = true; clearTimeout(timer); if (generation === this.generation) this.cancelWait = null; reject(error); });
    });
  }
  clear() { this.cancelWait?.(); this.cancelWait = null; ++this.generation; if (this.live !== null) { const value = this.live; this.live = null; this.release(value); } }
  dispose() { if (this.disposed) return; this.disposed = true; this.clear(); }
}
