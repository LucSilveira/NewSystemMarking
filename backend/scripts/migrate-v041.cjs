'use strict';
/** Import the user's v0.4.x JSON records into v0.5 without flattening them. */
const fs=require('node:fs');const path=require('node:path');
const {DATA_DIR,RESOURCES,write}=require('../src/data.cjs');
const source=process.argv[2];
if(!source){console.error('Uso: node backend/scripts/migrate-v041.cjs "CAMINHO/DA/V0.4.1/backend/data"');process.exit(1)}
const oldDir=path.resolve(source);
if(oldDir===DATA_DIR){console.error('A origem deve ser a pasta de dados da versão ANTERIOR, não a atual.');process.exit(1)}
const migrated={};
for(const resource of RESOURCES.filter(r=>r!=='occupationAreas')){
 const file=path.join(oldDir,`${resource}.json`);
 if(!fs.existsSync(file)){console.error(`Arquivo antigo ausente: ${file}`);process.exit(1)}
 try{const value=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(value[resource]))throw new Error('Esperado objeto com array '+resource);
  migrated[resource]=value[resource];
 }catch(e){console.error(`Arquivo inválido ${resource}:`,e.message);process.exit(1)}
}
require('./backup.cjs');
for(const [resource,rows] of Object.entries(migrated)){
 if(resource==='exams'){
  const normalized=rows.map(e=>({...e,areaIds:Array.isArray(e.areaIds)?e.areaIds:[]}));
  write(resource,normalized);
 }else write(resource,rows);
}
console.log('Importação concluída. occupationAreas.json da v0.5 foi preservado.');
console.log('Registros importados:',Object.entries(migrated).map(([k,v])=>`${k}=${v.length}`).join(', '));
console.log('Antes de executar a aplicação: npm run db:check');
