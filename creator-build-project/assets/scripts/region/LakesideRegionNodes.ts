/** Lakeside graph beside the baked island/meadow/skycity nodes. Not emitted by bake-region-nodes. */
export const LAKESIDE_REGION_GRAPH={
 sourceSha256:'lakeside-shore-landing',
 gridM:0.4,
 exploreBox:[-20,-10,20,50] as const,
 nodes:[
  {key:'L0',region:'lakeside' as const,at:[1.2,.58,36] as const,role:'arrival' as const,faceDeg:180},
  {key:'L1',region:'lakeside' as const,at:[1.2,.58,24.5] as const,role:'optional' as const,faceDeg:180},
 ],
 edges:[
  {a:'L0',b:'L1',path:[[1.2,.58,36],[1.2,.58,30],[1.2,.58,24.5]] as const,lengthM:11.5},
 ],
};
