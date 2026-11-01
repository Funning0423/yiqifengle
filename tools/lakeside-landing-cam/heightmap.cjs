// max geometry height (lake-local y) per 4 m cell around the departure: skycity + lake, for routing the lens
const Jn=require('../journey-integration/journey-scene.cjs'),LKS=require('../journey-integration/lakeside/lakeside-scene.cjs'),{decode}=require('../camera-frame-test/glb_geometry.cjs');
const {H,S,rotY,add,sub,yaw,sOff}=Jn,LC=H.load(S+'region/LakesideCameraLayout.ts');
const S6=add(rotY(yaw,[0.2,0.032,-27.8]),sOff),LJ=LC.lakesideJourney(S6),toL=p=>rotY(-LJ.yawDeg,sub(p,LJ.root));
(async()=>{const g=await decode(Jn.ROOT+'/creator-build-project/assets/bundles/region_skycity/env_skycity.glb');const C=4,mx={},mn={};
 const put=(q)=>{if(q[0]<-40||q[0]>44||q[2]<20||q[2]>112)return;const k=Math.floor(q[0]/C)+','+Math.floor(q[2]/C);mx[k]=Math.max(mx[k]??-1e9,q[1]);if(q[1]>(+process.env.ABOVE||6))mn[k]=Math.min(mn[k]??1e9,q[1]);};
 for(const n in g.meshes){if(/cloudsea|cumulus_far|cloud_small|Icosphere|_after/.test(n))continue;for(const tri of g.meshes[n])for(const v of tri)put(toL(add(rotY(yaw,v),sOff)));}
 console.log('S6 L',toL(S6).map(v=>v.toFixed(1)).join(','),' rows z (south→north... printed top=z112), cols x -40..44; value=max y (m) of skycity, . = none');
 let hdr='z\\x ';for(let x=-40;x<44;x+=C)hdr+=String(x).padStart(4);console.log(hdr);
 for(let z=108;z>=20;z-=C){let s=String(z).padStart(4);for(let x=-40;x<44;x+=C){const k=Math.floor(x/C)+','+Math.floor(z/C);const V=process.env.MODE==='min'?mn[k]:mx[k];s+=V===undefined?'   .':String(Math.round(V)).padStart(4);}console.log(s);}})();
