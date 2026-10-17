# Lakeside lighting numbers + pavilion fix (Voice Bot)

## Task 2: pavilion fix
Commit 0932b6b59621f41e5b70e3d8e5fbc03039f39796 (tree 0e071fe0…), on top of d8cd409, branch voice/build05-lakeside-playable. Not pushed.

Cause: the r5h3 exporter wrote the 34 source meshes from the Blender ASSETS collection (hide_render, never rendered) into scene_r5h_slim_transforms.json. Each one is named exactly after its GLB and sits at the origin with an identity transform. That stacks the houses and the pavilion on the bridge and doubles the lake, terrain and bridge, which z-fight.

Fix: `isLakesideAssetTemplate` (name === GLB basename) is now filtered out in `lakesideSceneInstances`. Instances go from 465 to 431. Bundle bytes are unchanged. Real placements match the blend with 0 position differences.

Test: test_lakeside_entry now has 8/8 asserts passing. Full suite: 49/54, with only the 5 known failures (production-integrity, legacy-board-ui-pure, reward-background-return, cloud-web-contract, navigation-guard BLOCKED_BROWSER).

Follow-up for 场景设计部: drop the ASSETS collection from the exporter. The instance counts in the handoff are currently overstated by 34.

Render: pavilion_before_after.png

## Task 1: checking GGbot's dirlight v2 (209d4e8) against r5h3

### Sun direction
sunForward [-0.4182, -0.3983, 0.8164] is correct. Blender Sun (-0.418, -0.816, -0.398) maps to Y-up as (x, z, -y).

For shaders, the direction toward the sun is L = (0.4182, 0.3983, -0.8164).

### Sun color
Linear (1, 0.6, 0.32) is correct, which is sRGB 255/203/153. The sun strength in Blender is 7.2.

### skyColor
GGbot uses sRGB 28/143/184. This is exactly the r5h3 world-ramp zenith stop (pos 0.38, linear 0.0116/0.2747/0.4793), so it is correct as the zenith colour.

The cosine-weighted hemisphere average, with the cyan fill Sun.001 included, is linear 0.1057/0.3637/0.5421 (sRGB 91/162/194). Use that value instead if shade looks too saturated or dark. Either one is justified.

### groundColor
Warm is correct. Below the horizon the r5h3 ramp clamps to linear (1, 0.5457, 0.1441), sRGB 255/195/106. Use that exact value.

### Ambient strength
Physically, skyIllum/sunIllum = 1/7.2 = 0.139. This assumes Cocos builtin-standard divides direct light by π and ambient by nothing (not verified on device).

GGbot's 0.75 is about 5x the physical value. It does make up for the missing sky reflection and the AgX Punchy grade. My proxy matched the reference best at roughly 0.55 × physical with the world-average sky colour. I can't verify 0.75 without the Mac, so keep it if the device frame matches.

### Shadows
r5h3 has shadows on. No change needed: the cool shade comes from the ambient term.

### Colour space
GGbot's code converts linear values to sRGB8 before `new Color`. Light and ambient colours in Cocos are authored in sRGB, so this is the right approach (unverified on device).

### Water tint
GGbot uses sRGB 69/196/255 (linear 0.06/0.55/1.0), which multiplies the vertex colour. My proxy fit was linear 0.24/0.6/1.0 (sRGB 134/203/255). Both are empirical.

The r5h3 water material itself has no fixed base colour. Its Base Color comes from the vertex colours: average linear 0.0786/0.412/0.4317 (sRGB 79/172/176, #4FACB0), deepest linear 0.006/0.144/0.238. Roughness is 0.01 and IOR is 1.33. The blue you see in the reference comes from sky reflection.

## Numbers for GGbot's water shader and fog

### Fresnel sky reflection
Reflection uses the r5h3 world ramp, driven by the up component of the reflected vector.

| Stop | Ramp position | Linear | sRGB |
|---|---|---|---|
| Zenith | 0.38 | 0.0116, 0.2747, 0.4793 | 28/143/184 |
| Low sky | 0.16 | 0.9216, 0.5776, 0.2705 | 246/200/142 |
| Horizon | 0.00 | 1.0, 0.5457, 0.1441 | 255/195/106 |
| (stop) | 0.06 | 1.0, 0.3231, 0.0908 | — |

The ramp interpolates linearly between stops.

Fresnel F0 = 0.02 (IOR 1.33), Schlick exponent 5.

Cheapest approach: add `mix(waterTint·albedo, skyRamp(R.y), F)` as emissive or additive in the existing water material. No textures needed.

### Specular streak
Use the sun colour, linear (1, 0.6, 0.32) / sRGB 255/203/153, with L = (0.4182, 0.3983, -0.8164) in Cocos space. Roughness in r5h3 is 0.01, which is very sharp, so a Blinn exponent of about 200–500 is reasonable. Add a little noise or bump to stretch it into a streak.

### Far-shore gold fog
In r5h3 the fog is the FX_fog_volume, using M_LK_fog Volume Scatter. Its colour is linear (1, 0.62, 0.38), which is sRGB 255/206/166 (#FFCEA6). Anisotropy is 0.78, so the fog glows toward the sun. Density is 0.0016 per metre, falling to 0 with height and with distance in the box.

Measured far-band highlight in the reference: about 207–226/166–176/146–164. If 255/206/166 looks too hot, use about 215/170/150.

Distances from the board camera (Blender camera at (0, -26.5, 13.2)):

| Feature | Distance |
|---|---|
| Board centre | about 30 m |
| Far trees and hills | about 82–126 m |

Suggested Cocos linear fog: fogStart about 45 m, fogEnd about 130 m, maximum fog amount about 0.35–0.45. The low density in r5h3 means the far objects are never fully fogged. The near board stays clear.

The compositor mist (start 5, depth 25, quadratic) is a render pass setting only and doesn't drive the look.

## Paste-ready block (GGbot field names; v2 values kept where they're correct)
```ts
export const LAKESIDE_DIR_LIGHT_PARAMS = Object.freeze({
  sunForward: [-0.4182, -0.3983, 0.8164] as const,          // verified
  sunColorLinear: [1.0, 0.6, 0.32] as const,                // verified (sRGB 255/203/153)
  sunIlluminanceScale: 1.0,
  ambientSkyColorLinear: [0.0116, 0.2747, 0.4793] as const, // r5h3 zenith = sRGB 28/143/184 (v2 OK); alt avg [0.1057,0.3637,0.5421]
  ambientGroundColorLinear: [1.0, 0.5457, 0.1441] as const, // r5h3 below-horizon clamp, sRGB 255/195/106
  ambientSkyIllumToSun: 0.75,                               // v2 empirical; physical 0.139 (needs device check)
});
export const LAKESIDE_WATER_PARAMS = Object.freeze({
  tintSrgb: [69, 196, 255] as const,                         // v2; proxy alt [134,203,255]
  fresnelF0: 0.02, fresnelPower: 5,
  skyZenithLinear: [0.0116, 0.2747, 0.4793] as const,
  skyLowLinear: [0.9216, 0.5776, 0.2705] as const,
  skyHorizonLinear: [1.0, 0.5457, 0.1441] as const,
  specColorLinear: [1.0, 0.6, 0.32] as const,
  toSunCocos: [0.4182, 0.3983, -0.8164] as const,
});
export const LAKESIDE_FOG_PARAMS = Object.freeze({
  colorSrgb: [255, 206, 166] as const, // alt [215,170,150]
  start: 45, end: 130, maxAmount: 0.4,
});
```

## Renders
- lights_3up.png: reference / GGbot v1 / my proxy
- r_*.png
- render2.py and presets.json: Blender proxy (vertex colour × material, single sun, step ambient)
