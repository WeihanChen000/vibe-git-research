/** Independent browser-test runner; never uses the user's browser profile or model accounts. */
import {existsSync,readFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const configured=process.env.PLAYWRIGHT_MODULE;
const local=process.env.LOCALAPPDATA;
const modulePath=configured?resolve(configured):local?join(local,'VibeGit','browser-tests','node_modules','playwright-core','index.mjs'):undefined;
if(!modulePath||!existsSync(modulePath)){
 console.error('Browser test tools are not configured. See docs/research/BROWSER-TEST-SETUP.md, or set PLAYWRIGHT_MODULE to playwright-core/index.mjs.');
 process.exit(1);
}
const pkg=JSON.parse(readFileSync(join(dirname(modulePath),'package.json'),'utf8'));
const {chromium}=await import(pathToFileURL(modulePath).href);
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.setContent('<title>Vibe-Git isolated browser check</title><button>ready</button>');
 await page.getByRole('button',{name:'ready',exact:true}).click();
 console.log(JSON.stringify({playwright:pkg.version,browser:browser.version(),isolatedBrowser:true,check:'passed'}));
}catch(error){
 console.error('Could not launch the matching test Chromium. Run the pinned playwright-core CLI install chromium from the setup guide.');
 console.error(error.message);process.exitCode=1;
}finally{await browser?.close();}
if(process.exitCode||process.argv.includes('--check'))process.exit(process.exitCode??0);
const output=process.env.VIBE_EXPERIMENT_OUT?resolve(process.env.VIBE_EXPERIMENT_OUT):resolve(root,'../output/browser-tests',new Date().toISOString().replace(/[:.]/g,'-'));
console.log('Private test output: '+output);
const child=spawn(process.execPath,[join(root,'apps/host/scripts/verify-workflow-experiments.mjs')],{
 cwd:root,env:{...process.env,PLAYWRIGHT_MODULE:modulePath,VIBE_EXPERIMENT_OUT:output},stdio:'inherit',windowsHide:true
});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
