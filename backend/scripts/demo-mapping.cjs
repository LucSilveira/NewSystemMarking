'use strict';
/** Opt-in sample exam. Never overwrites a real exam or a CIS import. */
const {read,write}=require('../src/data.cjs');
const {examValidation}=require('../src/rules.cjs');
const {all}=require('../src/data.cjs');
const id='demo-mapping-2026';
const exams=read('exams');
if(exams.some(e=>e.id===id)){
 console.log('Exemplo já existe — nenhum dado alterado.');
 process.exit(0);
}
const exam={
 id,title:'DEMONSTRAÇÃO — Mapeamento técnico',module:'DEMO',editionId:'wsc-2026',typeKey:'frontend',occupationId:'occupation-17',
 description:'Exercício fictício para validar relações. NÃO representa o CIS oficial.',technicalDetails:'Pontos e classificações apenas ilustrativos.',technicalChallenges:['Navegação SPA','Persistência de estado','Animação de interface'],
 documentUrl:'',maxScore:0.75,areaIds:['area-frontend','area-design'],competencyIds:['comp-spa','comp-storage','comp-animation'],sourceExamId:null,version:1,
 subcriteria:[{id:'demo-b1',code:'D1',title:'Três aspectos de demonstração',aspects:[
 {id:'demo-a1',description:'Navegação SPA sem recarregar a página (exemplo)',method:'M',maxScore:0.25,wsosSection:'4',considerations:'Critério ilustrativo.',areaIds:['area-frontend'],competencyIds:['comp-spa']},
 {id:'demo-a2',description:'Persistência do estado do usuário (exemplo)',method:'M',maxScore:0.25,wsosSection:'4',considerations:'Critério ilustrativo.',areaIds:['area-frontend'],competencyIds:['comp-storage']},
 {id:'demo-a3',description:'Transição animada e interação (exemplo)',method:'J',maxScore:0.25,wsosSection:'3',considerations:'Critério ilustrativo.',judgement:{0:'Ausente',1:'Básico',2:'Parcial',3:'Completo'},areaIds:['area-design','area-frontend'],competencyIds:['comp-animation','comp-spa']}
 ]}],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
};
const issues=examValidation(exam,all());if(issues.length){console.error(issues);process.exit(1)}
require('./backup.cjs');
write('exams',[...exams,exam]);
console.log('Prova DEMO criada. Abra Provas > DEMO > Editar / mapear. O restante dos dados foi preservado.');
