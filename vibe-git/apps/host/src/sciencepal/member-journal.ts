import {createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const exists=async(path:string)=>{try{await stat(path);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}};
/** Both local panel and CLI resolve the SAME journal; never silently replace an in-flight legacy log. */
export async function memberJournalPath(profile:string,host:string,nodeId:string,projectId:string){
 if(!/^[a-zA-Z0-9_-]{1,120}$/.test(projectId))throw Error('项目 ID 格式不正确');
 const scope=createHash('sha256').update(`${new URL(host).origin}\n${nodeId}\n${projectId}`).digest('hex');
 const current=join(resolve(profile),'connector-'+scope.slice(0,24)+'.json'),legacy=join(resolve(profile),'connector-'+projectId+'.json');
 const read=async(path:string)=>{if(!await exists(path))return null;const data=JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));if(data.scope!==scope||data.journal?.projectId!==projectId)throw Error('连接器日志属于其他身份或项目，请保留日志并核对');return data;};
 const now=await read(current),old=await read(legacy);
 if(now&&old&&old.journal.phase!=='IDLE')throw Error('发现两份日志且旧入口仍有未完成任务，请先核对原日志，不会自动切换');
 if(now)return current;
 if(old)return legacy;
 if(await exists(legacy+'.lock'))throw Error('旧连接器日志仍被锁定，请先停止原入口，不会创建第二份日志');
 return current;
}
