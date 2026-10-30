import {existsSync,readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';

// Content fingerprints also detect a replacement ZIP with preserved timestamps.
export function prepareResearch(root,{runNpm,log=console.log,rebuild=false}){
 const paths=['package.json','package-lock.json','tsconfig.base.json','SCIENCEPAL-TEAM-START.md','SCIENCEPAL-CASE-BRIEF.md'];
 const manifests=['package.json','package-lock.json'];
 const walk=dir=>{if(!existsSync(join(root,dir)))return;for(const e of readdirSync(join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=dir+'/'+e.name;if(e.isSymbolicLink())throw Error('构建输入不能是符号链接：'+p);if(e.isDirectory())walk(p);else if(e.isFile())paths.push(p);}};
 for(const group of ['apps','packages'])for(const w of readdirSync(join(root,group),{withFileTypes:true}).filter(e=>e.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
  const base=group+'/'+w.name;for(const e of readdirSync(join(root,base),{withFileTypes:true})){if(e.isFile()&&/\.(json|js|ts|html)$/.test(e.name)&&(e.name==='package.json'||e.name==='index.html'||e.name.includes('config'))){paths.push(base+'/'+e.name);if(e.name==='package.json')manifests.push(base+'/'+e.name);}}
  walk(base+'/src');walk(base+'/public');
 }
 const hash=names=>{const h=createHash('sha256');for(const p of [...names].sort()){h.update(p+'\0');h.update(readFileSync(join(root,p)));h.update('\0');}return h.digest('hex');};
 const dependencyHash=hash(manifests),sourceHash=hash(paths),nodeMajor=process.versions.node.split('.')[0];
 const stampPath=join(root,'data/research-setup.json');let stamp={};try{stamp=JSON.parse(readFileSync(stampPath,'utf8'));}catch{}
 const save=()=>{mkdirSync(dirname(stampPath),{recursive:true});writeFileSync(stampPath,JSON.stringify(stamp,null,2));};
 const install=!existsSync(join(root,'node_modules/typescript/package.json'))||stamp.dependencyHash!==dependencyHash||stamp.nodeMajor!==nodeMajor;
 if(install){log('首次准备或依赖有变更：正在安装依赖，请保持终端开启。');runNpm(['ci']);stamp={dependencyHash,nodeMajor};save();}
 const outputs=['apps/host/dist/sciencepal/local-panel-main.js','apps/web/dist/index.html','apps/web/dist/research-replay/1crn/case.json'];
 const build=install||rebuild||stamp.sourceHash!==sourceHash||outputs.some(p=>!existsSync(join(root,p)));
 if(build){log('正在构建最新科研工作区与回放，请保持终端开启。');runNpm(['run','build']);if(outputs.some(p=>!existsSync(join(root,p))))throw Error('构建缺少本机入口或回放文件，请检查上方构建日志。');stamp.sourceHash=sourceHash;save();}
 return {installed:install,built:build};
}
