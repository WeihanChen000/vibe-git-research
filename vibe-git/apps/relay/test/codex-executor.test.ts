import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {describe,it,expect,vi,afterEach} from "vitest";
import {spawn} from "node:child_process";
import {CodexExecutor} from "../src/executor.js";
vi.mock("node:child_process",()=>({spawn:vi.fn()}));
afterEach(()=>vi.restoreAllMocks());
function server(status:string, rejectThread=false){
 const child=Object.assign(new EventEmitter(),{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough(),killed:false,kill:vi.fn()});
 child.kill.mockImplementation(()=>{child.killed=true;child.emit("close",0);return true;});
 const calls:any[]=[];
 child.stdin.on("data",chunk=>{for(const line of String(chunk).trim().split("\n")){
  const m=JSON.parse(line);calls.push(m);if(m.id===undefined)continue;
  const reply=(result:unknown)=>child.stdout.write(JSON.stringify({id:m.id,result})+"\n");
  if(m.method==="thread/start"&&(rejectThread||!["read-only","workspace-write","danger-full-access"].includes(m.params.sandbox)))
   child.stdout.write(JSON.stringify({id:m.id,error:{code:-32600,message:"Invalid sandbox mode"}})+"\n");
  else if(m.method==="thread/start")reply({thread:{id:"thread-test"}});
  else if(m.method==="turn/start"){reply({turn:{id:"turn-test"}});queueMicrotask(()=>child.stdout.write(JSON.stringify({method:"turn/completed",params:{turn:{status}}})+"\n"));}
  else reply({});
 }});
 vi.mocked(spawn).mockReturnValue(child as any);
 return {child,calls};
}
const capability={state:"available",detail:"fixture",version:"fixture",transports:{appServer:"available",cli:"available",preferred:"app-server"}} as const;
describe("Codex App Server wire contract",()=>{
 it("uses thread sandbox enum and turn sandbox tagged object without broadening access",async()=>{
  const {calls,child}=server("completed");
  const h=await new CodexExecutor(capability,"fixture").start({prompt:"bounded task",transportRequested:"app-server"} as any,process.cwd());
  expect(await h.done).toMatchObject({status:"COMPLETED"});
  expect(calls.find(m=>m.method==="thread/start").params.sandbox).toBe("workspace-write");
  expect(calls.find(m=>m.method==="turn/start").params.sandboxPolicy).toMatchObject({type:"workspaceWrite",writableRoots:[process.cwd()]});
  child.kill();
 });
 it("reports thread rejection as safe to retry without submitting a model turn",async()=>{
  const {calls,child}=server("completed",true);
  await expect(new CodexExecutor(capability,"fixture").start({prompt:"task",transportRequested:"app-server"} as any,process.cwd())).rejects.toMatchObject({safeToRetry:true});
  expect(calls.some(m=>m.method==="turn/start")).toBe(false);expect(child.kill).toHaveBeenCalled();
 });
 it("does not treat unknown terminal status as completed",async()=>{
  const {child}=server("unknown");
  const h=await new CodexExecutor(capability,"fixture").start({prompt:"task",transportRequested:"app-server"} as any,process.cwd());
  expect((await h.done).status).toBe("FAILED");child.kill();
 });
});
