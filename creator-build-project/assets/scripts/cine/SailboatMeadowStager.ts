/**
 * Spreads the meadow mount across frames so no single frame pays for it (PR #56 r4:
 * one 183 ms frame at timing frame 78 pushed the clock past sceneSwapFrame before the
 * meadow had rendered its warm frames, so the cover held for one frame).
 *
 *   instantiate  one frame from SAILBOAT_STAGE_INSTANTIATE_FROM_FRAME (cloud closing),
 *                prefab cloned with its root inactive: no onLoad / onEnable, nothing drawn.
 *   prepare      next frame, still inactive: vertex-colour variants, cameras/clips off,
 *                key light child. Nothing touches the world camera here.
 *   activate     only under a full cloud bank: root on with its children off, then the
 *                children in SAILBOAT_STAGE_SLICES slices balanced by renderer count,
 *                one slice per frame. The night sky is applied with the first slice.
 *   mounted      the driver then counts its usual warm frames before the cover may open.
 *
 * Pure: the cc work is injected, so tools/cine/test_sailboat_transition.cjs runs it in Node.
 * No @ccclass.
 */

export const SAILBOAT_STAGE_INSTANTIATE_FROM_FRAME = 66;
export const SAILBOAT_STAGE_SLICES = 2;

export type MeadowStagePhase = 'idle' | 'instantiated' | 'prepared' | 'activating' | 'mounted' | 'failed';

export interface MeadowStageOps<N> {
  /** Clone the prefab under the mount parent with its root inactive. */
  instantiate(): N;
  /** Inactive prep. Returns the root's children with a cost weight (renderer count). */
  prepare(root: N): { child: N; weight: number }[];
  /** Before the first slice: children off, root on, night sky applied. */
  openRoot(root: N, children: N[]): void;
  activate(children: N[]): void;
  now(): number;
  log(message: string): void;
}

export interface MeadowStageInput { frame: number; covered: boolean; prefabReady: boolean }

export interface MeadowStager<N> {
  readonly phase: MeadowStagePhase;
  readonly root: N | null;
  /** True once every slice is active. */
  readonly mounted: boolean;
  /** At most one stage per call. Returns true if this call did work. */
  step(input: MeadowStageInput): boolean;
}

/** Greedy split into n slices with near-equal weight, keeping each child's order inside a slice. */
export function sliceByWeight<N>(items: { child: N; weight: number }[], n: number): N[][] {
  const count = Math.max(1, Math.min(n, items.length));
  const slices: { list: { child: N; index: number }[]; weight: number }[] = [];
  for (let i = 0; i < count; i++) slices.push({ list: [], weight: 0 });
  const order = items.map((it, index) => ({ child: it.child, weight: it.weight > 0 ? it.weight : 0, index }));
  order.sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (let i = 0; i < order.length; i++) {
    let best = 0;
    for (let s = 1; s < count; s++) if (slices[s].weight < slices[best].weight) best = s;
    slices[best].list.push({ child: order[i].child, index: order[i].index });
    slices[best].weight += order[i].weight;
  }
  const out: N[][] = [];
  for (let s = 0; s < count; s++) {
    slices[s].list.sort((a, b) => a.index - b.index);
    out.push(slices[s].list.map(x => x.child));
  }
  return out;
}

export function createMeadowStager<N>(ops: MeadowStageOps<N>, opts?: { fromFrame?: number; slices?: number }): MeadowStager<N> {
  const fromFrame = opts && typeof opts.fromFrame === 'number' ? opts.fromFrame : SAILBOAT_STAGE_INSTANTIATE_FROM_FRAME;
  const sliceCount = opts && typeof opts.slices === 'number' ? opts.slices : SAILBOAT_STAGE_SLICES;
  let phase: MeadowStagePhase = 'idle';
  let root: N | null = null;
  let slices: N[][] = [];
  let children: N[] = [];
  let next = 0;
  const timed = (label: string, work: () => void) => {
    const t0 = ops.now();
    work();
    ops.log('[sailboat] meadow ' + label + ' ms ' + Math.round(ops.now() - t0));
  };
  return {
    get phase() { return phase; },
    get root() { return root; },
    get mounted() { return phase === 'mounted'; },
    step(input: MeadowStageInput): boolean {
      if (phase === 'mounted' || phase === 'failed') return false;
      try {
        if (phase === 'idle') {
          // Early only from the cloud-closing frames; if the prefab is late, start as soon as it lands under cover.
          if (!input.prefabReady || (input.frame < fromFrame && !input.covered)) return false;
          timed('instantiate frame ' + input.frame, () => { root = ops.instantiate(); });
          phase = 'instantiated';
          return true;
        }
        if (phase === 'instantiated') {
          timed('prepare frame ' + input.frame, () => {
            const items = ops.prepare(root as N);
            children = items.map(it => it.child);
            slices = sliceByWeight(items, sliceCount);
          });
          phase = 'prepared';
          return true;
        }
        if (!input.covered) return false;
        if (phase === 'prepared') {
          timed('activate 1/' + slices.length + ' frame ' + input.frame, () => {
            ops.openRoot(root as N, children);
            if (slices.length) ops.activate(slices[0]);
          });
          next = 1;
          phase = next >= slices.length ? 'mounted' : 'activating';
          return true;
        }
        timed('activate ' + (next + 1) + '/' + slices.length + ' frame ' + input.frame, () => { ops.activate(slices[next]); });
        next += 1;
        if (next >= slices.length) phase = 'mounted';
        return true;
      } catch (error) {
        phase = 'failed';
        throw error;
      }
    },
  };
}
