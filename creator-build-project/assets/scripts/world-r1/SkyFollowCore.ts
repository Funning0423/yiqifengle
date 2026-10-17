/** r4-prep (lead): during the island→lakeside journey blend the island sky dome (and its cloud layer) follow the blended lakeside
 *  sky instead of covering it. Both are builtin-unlit (output = mainColor × SRGBToLinear(vertex colour), then gamma out), opaque and
 *  already one draw each, so no fade/transparency (no new pass, no extra DC): only the instance's mainColor moves.
 *  mainColor(w): the shown average goes from base × domeAverage to the target along a straight sRGB line (r4 sky-dome fix; was a
 *  linear lerp of mainColor): base = the island's own day (1) or night tint, target =
 *  the lakeside end clear colour (sRGB bytes → linear), domeAverage = mean SRGBToLinear(vertex colour) of that mesh. w = 0 is exactly
 *  the island look (no pop at the start); w = 1 puts the dome's average on the lakeside clear colour (the board then covers it with its
 *  own camera). Pure, no cc import. */
export type Rgb3=readonly [number,number,number]|readonly number[];
export const srgb8ToLinear=(b:number)=>{const c=Math.max(0,Math.min(255,b))/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};
export const srgbToLinear=(c:number)=>{c=Math.max(0,Math.min(1,c));return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};
export const SKY_FOLLOW_MAX_GAIN=8;
/** Mean SRGBToLinear(vertex colour) (rgb) of a colour stream with `stride` components per vertex. Bytes (0..255) when `normalized8`. */
export function vertexColorAverageLinear(colors:ArrayLike<number>|null|undefined,stride:number,normalized8=false):[number,number,number]{
 if(!colors||!(stride>=3)||colors.length<stride)return [1,1,1];
 const n=Math.floor(colors.length/stride),k=normalized8?1/255:1;let r=0,g=0,b=0;
 for(let i=0;i<n;i++){r+=srgbToLinear(colors[i*stride]*k);g+=srgbToLinear(colors[i*stride+1]*k);b+=srgbToLinear(colors[i*stride+2]*k);}
 const out:[number,number,number]=[r/n,g/n,b/n];return out.every(v=>Number.isFinite(v)&&v>0)?out:[1,1,1];
}
/** Inverse of srgbToLinear on 0..1 (used only to place the dome's blend in sRGB). */
export const linearToSrgbUnit=(l:number)=>{const c=Math.max(0,Math.min(1,l));return c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055;};
/** Linear mainColor rgb for the dome at blend weight w (clamped 0..1). target null or w <= 0 → base.
 *  r4 sky-dome fix (lead: no hue detour): what the mesh shows on average (mainColor × average) is lerped in sRGB from the island
 *  start (base × average) to the target, then turned back into a linear mainColor. A straight line in sRGB keeps every channel
 *  monotonic and the hue moving one way from the start hue to the end hue (a linear-rgb line can bend the sRGB hue, e.g. the cloud
 *  layer). w = 0 / 1 are exactly the island base / the target gain (clamped to SKY_FOLLOW_MAX_GAIN), as before. */
export function skyFollowColor(base:Rgb3,target:Rgb3|null,average:Rgb3,w:number):[number,number,number]{
 const t=Math.max(0,Math.min(1,Number.isFinite(w)?w:0));if(!target||t<=0)return [base[0],base[1],base[2]];
 const out:[number,number,number]=[0,0,0];
 for(let i=0;i<3;i++){const a=Math.max(1e-4,average[i]),gain=Math.min(SKY_FOLLOW_MAX_GAIN,srgb8ToLinear(target[i])/a);
  if(t>=1){out[i]=gain;continue;}const s0=linearToSrgbUnit(base[i]*a),s1=linearToSrgbUnit(gain*a);out[i]=srgbToLinear(s0+(s1-s0)*t)/a;}
 return out;
}
/** r4-prep (C/D, lead): far view = the same set on both sides of the journey→board swap. The lakeside far hills / far shore are in
 *  the journey from the set-off and come IN with the blend (the layered fog thins as w rises); the island-only sky props (sky dome,
 *  cloud layer, gulls) then fade OUT over [start, end] of the blend weight, done before the landing (w reaches 1 before she stops).
 *  With the dome gone the sky IS the camera clear colour, which the journey end and the board take from the same
 *  lakesideModeLighting(mode).clearColor. Returns the props' visibility: 1 = island look, 0 = gone. */
export const ISLAND_SKY_FADE={start:.6,end:.95} as const;
export function islandSkyFade(w:number):number{
 const t=Math.max(0,Math.min(1,((Number.isFinite(w)?w:0)-ISLAND_SKY_FADE.start)/(ISLAND_SKY_FADE.end-ISLAND_SKY_FADE.start)));
 return 1-t*t*(3-2*t);
}
