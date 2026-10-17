// node findwater.cjs <web-dir> -> prints regex for region_lakeside asset(s) whose path contains water/lakeside-water
const fs=require('fs');const dir=process.argv[2]+'/assets/region_lakeside';const cfg=JSON.parse(fs.readFileSync(dir+'/config.json','utf8'));
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';const V={};for(let i=0;i<64;i++)V[B64.charCodeAt(i)]=i;const HEX='0123456789abcdef';
const T=[];for(let i=0;i<36;i++)if(![8,13,18,23].includes(i))T.push(i);
function dec(b){const [u,...rest]=b.split('@');if(u.length!==22)return b;const H=new Array(36).fill('-');H[0]=u[0];H[1]=u[1];let j=2;for(let i=2;i<22;i+=2){const l=V[u.charCodeAt(i)],r=V[u.charCodeAt(i+1)];H[T[j++]]=HEX[l>>2];H[T[j++]]=HEX[((l&3)<<2)|(r>>4)];H[T[j++]]=HEX[r&15];}return [H.join(''),...rest].join('@');}
const hits=[];for(const [k,v] of Object.entries(cfg.paths||{})){if(/lakeside-water/.test(v[0])){const raw=cfg.uuids[+k];hits.push({idx:k,path:v[0],type:cfg.types?cfg.types[v[1]]:v[1],raw,uuid:dec(raw)});}}
console.error(JSON.stringify(hits,null,1));
const ids=[...new Set(hits.map(h=>h.uuid.split('@')[0]))];
// files on disk containing those uuids
const files=[];const walk=d=>{for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=d+'/'+f.name;if(f.isDirectory())walk(p);else if(ids.some(id=>f.name.startsWith(id)))files.push(p.replace(process.argv[2],''));}};walk(dir);
console.error('FILES',JSON.stringify(files));
console.log('region_lakeside/.*('+ids.join('|')+')');
