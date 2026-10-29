'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {examValidation,computeExecution,validatePayload}=require('../src/rules.cjs');
const {all}=require('../src/data.cjs');
const refs=all();
const exam={id:'test-map',title:'Teste de relações',editionId:'wsc-2026',typeKey:'frontend',occupationId:'occupation-17',maxScore:1,areaIds:['area-frontend','area-design'],competencyIds:['comp-storage','comp-animation'],subcriteria:[{id:'b4',code:'B4',aspects:[{id:'c1',description:'Persistência de estado',method:'M',maxScore:1,wsosSection:'4',areaIds:['area-frontend','area-design'],competencyIds:['comp-storage','comp-animation']}]}]};

test('aspecto pode referenciar várias áreas e competências sem alterar WSOS',()=>{
 assert.deepEqual(examValidation(exam,refs),[]);
 const out=computeExecution({mode:'aspects',scores:[{id:'c1',score:.75}]},exam);
 assert.equal(out.overallScore,.75);assert.equal(out.wsosResults[0].wsosSection,'4');
 assert.equal(out.wsosResults[0].earned,.75);
});
test('rejeita área que não foi escolhida na prova',()=>{
 const copy=structuredClone(exam);copy.subcriteria[0].aspects[0].areaIds.push('area-backend');
 assert.match(examValidation(copy,refs).join(' '),/fora da lista da prova/);
});
test('rejeita competência não cadastrada na prova',()=>{
 const copy=structuredClone(exam);copy.subcriteria[0].aspects[0].competencyIds.push('comp-api');
 assert.match(examValidation(copy,refs).join(' '),/competência fora da lista da prova/);
});
test('permite várias competências equivalentes e bloqueia IDs repetidos',()=>{
 const copy=structuredClone(exam);
 assert.deepEqual(examValidation(copy,refs),[]);
 copy.subcriteria[0].aspects[0].competencyIds.push('comp-storage');
 assert.match(examValidation(copy,refs).join(' '),/competências repetidas/);
});
test('mantém compatibilidade com vínculos antigos sem impor principal',()=>{
 const copy=structuredClone(exam);
 const aspect=copy.subcriteria[0].aspects[0];
 delete aspect.competencyIds;
 aspect.competencyLinks=[{competencyId:'comp-storage',role:'primary'},{competencyId:'comp-animation',role:'related'}];
 assert.deepEqual(examValidation(copy,refs),[]);
 // A classificação legada não interfere na pontuação WSOS do CIS.
 const result=computeExecution({mode:'aspects',scores:[{id:'c1',score:0.75}]},copy);
 assert.equal(result.overallScore,0.75);
 assert.equal(result.wsosResults[0].earned,0.75);
});
test('competências técnicas só podem referenciar áreas da sua ocupação',()=>{
 const issues=validatePayload('competencies',{name:'Teste',occupationId:'occupation-17',areaIds:['inexistente']},refs);
 assert.ok(issues.some(s=>s.includes('Área não pertence')));
});
test('sem relações técnicas o CIS original continua válido',()=>{
 const copy=structuredClone(exam);copy.areaIds=[];copy.competencyIds=[];copy.subcriteria[0].aspects[0].areaIds=[];copy.subcriteria[0].aspects[0].competencyIds=[];
 assert.deepEqual(examValidation(copy,refs),[]);
});
