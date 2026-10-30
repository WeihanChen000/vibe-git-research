import { SP_HEARTBEAT_TTL_MS, type SPConnection, type SPMemberPresence } from "@vibe-git/protocol";
import type { V20Repository } from "../v20/repository.js";
import { badRequest, revisionConflict } from "../domain/errors.js";
type RecordValue={instanceId:string;at:number;status:SPConnection["status"];reason:string};
const reasons:Record<string,string>={ready:"连接正常",working:"正在处理任务",error:"连接器发生错误，请本人打开本机入口检查",stopped:"连接器已停止",unknown:"提交结果待核对，禁止重复启动"};
export function memberPresence(repo:V20Repository,nodeId:string,projectId:string,now=Date.now()):SPMemberPresence{
  const read=(channel:"panel"|"connector"):SPConnection=>{
    const raw=repo.getMeta(`sp_presence_${nodeId}_${channel}_${channel==="panel"?"room":projectId}`);
    if(!raw)return {channel,state:"never",status:"stopped",lastSeen:null,reason:channel==="panel"?"本机入口尚未连接":"本项目连接器尚未启动"};
    const v=JSON.parse(raw) as RecordValue,expired=now-v.at>SP_HEARTBEAT_TTL_MS;
    return {channel,state:expired||v.status==="stopped"?"offline":"online",status:v.status,lastSeen:new Date(v.at).toISOString(),reason:expired?"超过 30 秒未收到心跳，请本人检查网络或重新打开入口":v.reason};
  };
  return {panel:read("panel"),connector:read("connector")};
}
export function recordPresence(repo:V20Repository,nodeId:string,projectId:string,raw:Record<string,unknown>,now=Date.now()){
  const {channel,instanceId,status}=raw;
  if(!["panel","connector"].includes(String(channel))||typeof instanceId!=="string"||!/^[a-zA-Z0-9_-]{8,120}$/.test(instanceId)||typeof status!=="string"||!Object.hasOwn(reasons,status))throw badRequest("心跳参数无效");
  const key=`sp_presence_${nodeId}_${channel}_${channel==="panel"?"room":projectId}`,previous=repo.getMeta(key),old=previous?JSON.parse(previous) as RecordValue:null;
  if(old&&old.instanceId!==instanceId&&old.status!=="stopped"&&now-old.at<=SP_HEARTBEAT_TTL_MS){
    if(status==="stopped")return;
    if(channel==="connector")throw revisionConflict("本项目已有活跃连接器，请回到原入口，不要重复启动");
  }
  repo.setMeta(key,JSON.stringify({instanceId,at:now,status,reason:reasons[status]}));
}
