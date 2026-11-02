'use strict';
/** Arquivos JSON independentes, com leitura cacheada e gravação atômica.
 * Não é um banco transacional; o cache reduz I/O, mas não substitui SQLite/PostgreSQL.
 * Em desenvolvimento, o cache é invalidado por mtime/size caso um JSON seja editado por fora.
 */
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const DATA_DIR=path.resolve(process.env.DATA_DIR || path.resolve(__dirname,'../data'));
const RESOURCES=['occupations','occupationAreas','wsos','examTypes','editions','competitors','competencies','exams','executions','technicalAssessments','activities','evaluators','teams'];
const cache=new Map();
function fileFor(name){if(!RESOURCES.includes(name))throw new Error('Coleção desconhecida: '+name);return path.join(DATA_DIR,`${name}.json`)}
function read(name){
 const file=fileFor(name),stat=fs.statSync(file),prior=cache.get(name);
 if(prior&&prior.mtimeMs===stat.mtimeMs&&prior.size===stat.size)return prior.rows;
 const body=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!Array.isArray(body[name]))throw new Error(`${name}.json deve ter chave ${name} com array`);
 cache.set(name,{mtimeMs:stat.mtimeMs,size:stat.size,rows:body[name]});
 return body[name];
}
function write(name,rows){
 if(!Array.isArray(rows))throw new Error('Esperado array');
 const dest=fileFor(name),tmp=`${dest}.tmp-${process.pid}-${randomUUID()}`;
 try{
  fs.writeFileSync(tmp,JSON.stringify({[name]:rows},null,2)+'\n');
  fs.renameSync(tmp,dest);
  const stat=fs.statSync(dest);
  cache.set(name,{mtimeMs:stat.mtimeMs,size:stat.size,rows});
 }catch(error){try{fs.unlinkSync(tmp)}catch{}throw error}
}
function clearCache(){cache.clear()}
function all(){return Object.fromEntries(RESOURCES.map(name=>[name,read(name)]))}
module.exports={DATA_DIR,RESOURCES,fileFor,read,write,all,clearCache};
