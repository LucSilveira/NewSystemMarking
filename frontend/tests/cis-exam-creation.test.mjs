import test from 'node:test';
import assert from 'node:assert/strict';
import {CREATE_NEW_EXAM,normalizedTitle,findTitleClashes,recommendedType,suggestCisMappings,createExamFromCis,missingWsosSections} from '../src/lib/cisExamCreation.js';

const types=['speed-test','frontend','backend','design-implementation','team-challenge'].map(key=>({key,name:key}));
const modules=[
 {module:'MA',title:'Nova prova de speed',totalScore:2.5,subcriteria:[{aspects:[{wsosSection:'1'},{wsosSection:'4'}]}]},
 {module:'MB',title:'Conference Mobile',totalScore:16.5,subcriteria:[{aspects:[{wsosSection:'4'}]}]},
 {module:'MC',title:'Outra prova',totalScore:12,subcriteria:[{aspects:[{wsosSection:'5'}]}]}
];
const exam={id:'existing',occupationId:'occupation-17',title:'Conference Mobile',module:'MB',maxScore:16.5,subcriteria:[]};
const db={occupations:[{id:'occupation-17',code:'17'}],exams:[exam],examTypes:types,editions:[]};

test('normaliza maiúsculas, espaços e acentos para impedir duplicação de títulos',()=>{
 assert.equal(normalizedTitle('  CONFERÊNCIA   MOBILE '),normalizedTitle('conferencia mobile'));
 assert.equal(findTitleClashes([{...exam,title:'  Conferência   MOBILE '}],exam.occupationId,'Conferencia Mobile').length,1);
 assert.equal(findTitleClashes([{...exam,occupationId:'occupation-08'}],exam.occupationId,exam.title).length,0);
});
test('recomenda criação para título novo e vínculo para título existente',()=>{
 const mapping=suggestCisMappings(modules,db);
 assert.equal(mapping.MA.mode,'create');
 assert.equal(mapping.MA.enabled,false);
 assert.equal(mapping.MA.typeKey,'speed-test');
 assert.equal(mapping.MB.mode,'existing');
 assert.equal(mapping.MB.examId,'existing');
 assert.equal(mapping.MB.enabled,true);
 assert.equal(mapping.MC.mode,'create');
 assert.equal(mapping.MC.typeKey,'backend');
 assert.equal(CREATE_NEW_EXAM,'__create__');
});
test('não escolhe automaticamente entre títulos duplicados',()=>{
 const mapping=suggestCisMappings([modules[1]],{...db,exams:[exam,{...exam,id:'second'}]});
 assert.equal(mapping.MB.mode,'existing');
 assert.equal(mapping.MB.examId,'');
 assert.equal(mapping.MB.enabled,false);
});
test('tipo não é inventado quando não há correspondência inequívoca',()=>{
 assert.equal(recommendedType('MA',[{key:'desktop'},{key:'api'}]),'');
 assert.equal(recommendedType('MA',[{key:'generic'}]),'generic');
});
test('nova prova contém os campos obrigatórios e estrutura CIS editável',()=>{
 const subs=[{id:'sub',aspects:[{id:'aspect',description:'Validar',maxScore:2.5,method:'M',areaIds:[],competencyIds:[]}]}];
 const result=createExamFromCis(modules[0],{occupationId:'occupation-17',typeKey:'speed-test',editionId:'',id:'new',date:'2026-10-29T00:00:00.000Z',subcriteria:subs});
 assert.equal(result.id,'new');
 assert.equal(result.maxScore,2.5);
 assert.equal(result.module,'MA');
 assert.equal(result.title,'Nova prova de speed');
 assert.equal(result.occupationId,'occupation-17');
 assert.deepEqual(result.subcriteria,subs);
 assert.deepEqual(result.technicalChallenges,[]);
 assert.equal(result.sourceExamId,null);
 assert.equal(result.version,1);
 assert.equal(result.cisImportedAt,'2026-10-29T00:00:00.000Z');
});
test('valida tipo de prova e ocupação ao construir cadastro',()=>{
 assert.throws(()=>createExamFromCis(modules[0],{occupationId:'occupation-17'}),/tipo de prova/);
 assert.throws(()=>createExamFromCis(modules[0],{typeKey:'speed-test'}),/Ocupação/);
});
test('identifica seções WSOS ausentes no cadastro da modalidade',()=>{
 assert.deepEqual(missingWsosSections(modules[0],[{code:'1'}]),['4']);
 assert.deepEqual(missingWsosSections(modules[2],[{code:'5'}]),[]);
});
