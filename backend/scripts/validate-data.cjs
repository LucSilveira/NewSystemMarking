'use strict';
const {RESOURCES,all}=require('../src/data.cjs');const {examValidation}=require('../src/rules.cjs');
try{const refs=all();let bad=0;for(const resource of RESOURCES){const unique=new Set();for(const item of refs[resource]){if(!item.id||unique.has(item.id)){console.error(`${resource}: ID ausente ou duplicado: ${item.id}`);bad++}unique.add(item.id)}}
for(const e of refs.exams){const issues=examValidation(e,refs);for(const issue of issues){console.error(`Prova ${e.id}: ${issue}`);bad++}}
console.log(`Arquivos: ${RESOURCES.length}, registros: ${RESOURCES.map(k=>`${k}=${refs[k].length}`).join(', ')}`);
if(bad)process.exitCode=1;else console.log('Estrutura básica válida.');
}catch(e){console.error(e);process.exitCode=1}
