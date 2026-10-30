/** Build the SAME topology as a forced-read-only, credential-free public static site. */
import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(root,'../docs/replay');
await mkdir(out,{recursive:true});
const child=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'build','--base','./','--outDir',out],{cwd:join(root,'apps/web'),env:{...process.env,VITE_PUBLIC_REPLAY:'1'},stdio:'inherit',windowsHide:true});
const code=await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res);});
if(code!==0)throw Error('Public replay build failed');
await writeFile(join(out,'.nojekyll'),'');
console.log('Public build is read-only even without ?replay=1; live Host APIs are disabled in this build.');
