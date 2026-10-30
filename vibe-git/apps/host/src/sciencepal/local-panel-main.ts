import {spawn} from 'node:child_process';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {buildResearchPanel} from './local-panel.js';
const profileDir=process.env.VIBE_GIT_RESEARCH_PROFILE||join(process.env.LOCALAPPDATA||homedir(),'VibeGit','team-research');
const inside=relative(process.cwd(),resolve(profileDir));
if(!inside||(!inside.startsWith('..')&&!isAbsolute(inside)))throw new Error('个人身份与 Key 必须保存在项目目录外，请清除 VIBE_GIT_RESEARCH_PROFILE 或选择个人目录');
const captain=process.argv.includes('--captain');
const panel=await buildResearchPanel({profileDir,...(captain?{captainFile:resolve(process.env.VIBE_GIT_MEMBER_FILE||'data/sciencepal/v20/captain.json'),hostUrl:process.env.VIBE_GIT_HOST||'http://127.0.0.1:8788'}:{})});
await panel.listen();console.log('本人科研工作区（保持此终端运行，浏览器未打开时使用此备用链接）：\n'+panel.ticket());
if(process.argv.includes('--open')){
 const url=panel.ticket();
 const child=process.platform==='win32'?spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'}):spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});
 child.on('error',()=>console.log('未能自动打开浏览器，请使用上方备用链接。'));child.unref();
}
let closing=false;const close=async()=>{if(closing)return;closing=true;await panel.app.close();process.exit(0);};process.once('SIGINT',()=>void close());process.once('SIGTERM',()=>void close());
