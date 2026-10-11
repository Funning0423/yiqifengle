/** Thin view cancellation guard for the incoming R4 controller; contains no game rules or save writes. */
export class VisualEpoch {
  private epoch = 0;
  private pending = new Set<string>();
  private issued = new Set<string>();
  invalidate(): void { this.epoch++; this.pending.clear(); this.issued.clear(); }
  once(token: string, finish: () => void): () => boolean {
    if (!token || this.issued.has(token)) throw new Error('Empty or duplicate visual token');
    const issuedAt = this.epoch;
    this.issued.add(token);
    this.pending.add(token);
    return () => {
      if (issuedAt !== this.epoch || !this.pending.delete(token)) return false;
      finish();
      return true;
    };
  }
}
