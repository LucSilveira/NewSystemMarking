'use strict';
const fs=require('node:fs');
const path=require('node:path');
const DATA_DIR=path.resolve(process.env.DATA_DIR || path.resolve(__dirname,'../data'));
const RESOURCES=['occupations','occupationAreas','wsos','examTypes','editions','competitors','competencies','exams','executions','technicalAssessments','activities','evaluators','teams'];
function fileFor(name){if(!RESOURCES.includes(name)) throw new Error('Coleção desconhecida: '+name);return path.join(DATA_DIR,`${name}.json`)}
function read(name){const body=JSON.parse(fs.readFileSync(fileFor(name),'utf8'));if(!Array.isArray(body[name]))throw new Error(`${name}.json deve ter chave ${name} com array`);return body[name];}
function write(name,rows){if(!Array.isArray(rows))throw new Error('Esperado array');const dest=fileFor(name);const tmp=`${dest}.tmp-${process.pid}-${Date.now()}`;fs.writeFileSync(tmp,JSON.stringify({[name]:rows},null,2)+'\n');fs.renameSync(tmp,dest);}
function all(){return Object.fromEntries(RESOURCES.map(name=>[name,read(name)]));}
module.exports={DATA_DIR,RESOURCES,fileFor,read,write,all};
