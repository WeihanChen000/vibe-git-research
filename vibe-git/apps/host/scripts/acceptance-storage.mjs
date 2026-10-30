import {mkdir,readFile,writeFile,rename,unlink,open} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
export async function atomicJson(path,value){
 await mkdir(dirname(path),{recursive:true});
 const temporary=path+'.'+randomUUID()+'.tmp';
 try{await writeFile(temporary,JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});await rename(temporary,path);}
 finally{await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
/** Fail closed on an existing lock. --status never dispatches or owns a lock. */
export async function acquireAcceptanceLock(root){
 const path=join(root,'acceptance.lock');let handle;
 try{handle=await open(path,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await handle.close();}
 catch(e){if(e.code==='EEXIST')throw Error('Acceptance already has a runner lock. Use --status; do not run twice. If the previous process exited, verify its PID and remove only acceptance.lock in the private acceptance directory.');throw e;}
 return async()=>{const value=JSON.parse(await readFile(path,'utf8'));if(value.pid!==process.pid)throw Error('Runner lock ownership changed');await unlink(path);};
}

// A saved follow-up must advance; reply() would reject or duplicate the answer.
export function connectorAction(runStatus,journal){return runStatus==='NEEDS_INPUT'&&!journal.followUp?'reply':'step';}
