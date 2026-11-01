const A=require('./audit.cjs');const land=A.landingFor([390,844]);
for(const v of [0,45,-45,90,-90,180]){const fr=A.startCamera(v),S=A.newShot(land);const k=A.kinematics({camera:(t,f)=>S.camera(t,f),timing:S.timing,cut:S.cut},fr);const p=S.camera(0,fr);console.log(v,k.linAccMax,k.linAt,k.angAccMax,'jump',Math.hypot(...p.position.map((x,i)=>x-fr.position[i])).toFixed(4));}
