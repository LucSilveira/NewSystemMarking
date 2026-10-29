'use strict';
// One-time migration from the v0.3 monolithic db.json to separate files.
// Must be run while server is stopped. Confirm explicitly because it replaces local collections.
const fs=require('node:fs');const path=require('node:path');const {RESOURCES,read,write}=require('../src/data.cjs');
if(process.env.CONFIRM_IMPORT!=='YES'){console.error('Importação substitui os arquivos atuais. Pare a API, faça backup e defina CONFIRM_IMPORT=YES.');process.exit(1)}
const source=process.argv[2];if(!source||!fs.existsSync(source)){console.error('Informe o caminho do db.json antigo.');process.exit(1)}
const old=JSON.parse(fs.readFileSync(source,'utf8'));
if(!Array.isArray(old.exams)||!Array.isArray(old.editions))throw new Error('O JSON não parece ser da v0.3');
require('./backup.cjs');
for(const resource of RESOURCES){if(!Array.isArray(old[resource]))continue;const rows=old[resource].map(v=>{
  const item={...v};if(resource==='exams'||resource==='editions')item.occupationId=item.occupationId||'occupation-17';
  if(resource==='wsos')item.occupationId=item.occupationId||'occupation-17';
  if(resource==='exams')item.competencyIds=item.competencyIds||[];
  return item;
});write(resource,rows);console.log(`${resource}: ${rows.length} importados`)}
console.log('Migração concluída. Revise os arquivos e execute npm run db:check.');
