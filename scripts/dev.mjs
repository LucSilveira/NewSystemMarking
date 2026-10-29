import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const processes=[];
for(const folder of ['backend','frontend']) {
  const child=spawn('npm',['run','dev'],{cwd:fileURLToPath(new URL(`../${folder}/`,import.meta.url)),stdio:'inherit',shell:process.platform==='win32'});
  processes.push(child);
}
function close(){for(const p of processes)if(!p.killed)p.kill();}
process.on('SIGINT',()=>{close();process.exit(0)});
process.on('SIGTERM',()=>{close();process.exit(0)});
for(const p of processes) p.on('exit',(code)=>{if(code && code!==0){close();process.exitCode=code;}});
