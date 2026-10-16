'use strict';
// Minimal cc stub for SeaNightTint: Vec4, isValid, MeshRenderer (component key), Node tree.
class Vec4{constructor(x=0,y=0,z=0,w=0){this.x=x;this.y=y;this.z=z;this.w=w;}clone(){return new Vec4(this.x,this.y,this.z,this.w);}}
class MeshRenderer{}
const isValid=o=>!!o&&!o.destroyed;
module.exports={Vec4,MeshRenderer,isValid,Node:class{}};
