/** Hands the flight-warmed sky-city board model to the next mountRegion(skycity). No engine import. */
let ready: any = null;
export function publishSkycityBoardModel(model: any): void { ready = model; }
export function takeSkycityBoardModel(): any { const n = ready; ready = null; return n; }
export function skycityBoardModelReady(): boolean { return !!ready; }
