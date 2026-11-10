'use strict';
/** Shared helpers for the meta-allowlist and manifest-files-exist gates (GGbot). */
const fs=require('fs'),path=require('path'),cp=require('child_process');
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Cocos 3.x compressed uuid form used in build config.json ("bb978abb-…" -> "bbl4q72Q…"). */
function compressUuid(u){const h=u.replace(/-/g,'');if(!/^[0-9a-f]{32}$/i.test(h))return u;let o=h.slice(0,2);for(let i=2;i<32;i+=3){const v=parseInt(h.slice(i,i+3),16);o+=B64[v>>6]+B64[v&63];}return o;}
function git(root,args){return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:256<<20,stdio:['ignore','pipe','pipe']});}
/** Scan root: explicit --root, else REPO_ROOT, else `git rev-parse --show-toplevel` of the current directory.
 *  Never the directory that contains the script. */
function repoRoot(explicit){
  if(explicit)return path.resolve(explicit);
  if(process.env.REPO_ROOT)return path.resolve(process.env.REPO_ROOT);
  try{return git(process.cwd(),['rev-parse','--show-toplevel']).trim();}
  catch(e){const err=new Error('NO_ROOT: set --root or REPO_ROOT, or run inside the git worktree');err.code='NO_ROOT';throw err;}
}
function walk(dir,pred,out=[]){if(!fs.existsSync(dir))return out;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,pred,out);else if(pred(p))out.push(p);}return out;}
/** Bundle dirs in a Cocos build output (wechat: subpackages/<b>, assets/<b>, remote/<b>; web: assets/<b>). */
function bundleDir(buildDir,name){for(const s of ['subpackages','assets','remote']){const d=path.join(buildDir,s,name);if(fs.existsSync(d)&&fs.readdirSync(d).some(f=>/^config(\.[0-9a-f]+)?\.json$/.test(f)))return d;}return null;}
module.exports={compressUuid,git,walk,bundleDir,repoRoot};
