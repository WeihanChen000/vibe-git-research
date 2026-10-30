// One local process owns this Host and captain panel. No tunnel or account calls.
import {resolve,join,relative,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {spawn} from 'node:child_process';
import {buildApp} from '../apps/host/dist/app.js';
import {buildResearchPanel} from '../apps/host/dist/sciencepal/local-panel.js';
process.env.SCIENCEPAL_ENABLED='1';
process.env.VIBE_GIT_DATA_DIR ||= resolve('data/sciencepal');
const profileDir=process.env.VIBE_GIT_RESEARCH_PROFILE||join(process.env.LOCALAPPDATA||homedir(),'VibeGit','team-research');
const rel=relative(process.cwd(),resolve(profileDir));if(!rel||(!rel.startsWith('..')&&!isAbsolute(rel)))throw Error('个人身份目录必须在项目外');
let host,panel,closing=false;
async function close(){if(closing)return;closing=true;await panel?.app.close();await host?.close();}
try{
 host=await buildApp({logger:false});
 const origin=await host.listen({host:'127.0.0.1',port:Number(process.env.PORT||8788)});
 panel=await buildResearchPanel({profileDir,captainFile:resolve(process.env.VIBE_GIT_MEMBER_FILE||join(process.env.VIBE_GIT_DATA_DIR,'v20/captain.json')),hostUrl:origin});await panel.listen();
 const url=panel.ticket();console.log(['队长房间与本人入口已启动（仅本机）。保持此终端开启。',url,'跨电脑仍需配置可信 HTTPS 邀请；本入口不会自动公开房间。'].join('\n'));
 if(!process.argv.includes('--no-open')){const p=process.platform==='win32'?spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'}):spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});p.on('error',()=>console.log('请使用上方备用链接'));p.unref();}
 process.once('SIGINT',()=>void close().then(()=>process.exit(0)));process.once('SIGTERM',()=>void close().then(()=>process.exit(0)));
}catch(e){await close();console.error(e?.code==='EADDRINUSE'?'房间端口已被占用。本入口未停止现有服务。已有房间请用 open-research.cmd --captain 打开本人入口。':e.message);process.exitCode=1;}
