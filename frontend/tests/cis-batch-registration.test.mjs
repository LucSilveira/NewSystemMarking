import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestBatchRegistrations,batchTitleConflicts,batchCreatedExam} from '../src/lib/cisBatchRegistration.js';
import {createExamFromCis} from '../src/lib/cisExamCreation.js';

const modules=[
  {module:'MB',title:'Frontend',totalScore:2,subcriteria:[]},
  {module:'MD',title:'Frontend',totalScore:4,subcriteria:[]},
  {module:'ME',title:'Backend',totalScore:6,subcriteria:[]}
];
const db={occupations:[{id:'o17'}],examTypes:[{key:'frontend'},{key:'backend'}],exams:[]};
test('lote sugere provas novas e diferencia módulos com mesmo título CIS',()=>{
  const choices=suggestBatchRegistrations(modules,db);
  assert.equal(choices.MB.title,'MB — Frontend');
  assert.equal(choices.MD.title,'MD — Frontend');
  assert.equal(choices.ME.title,'Backend');
  assert.ok(Object.values(choices).every(m=>m.enabled));
  assert.equal(choices.MB.typeKey,'frontend');
  assert.equal(choices.ME.typeKey,'backend');
});
test('provas já existentes são desmarcadas e nunca alteradas em lote',()=>{
  const choices=suggestBatchRegistrations(modules,{...db,exams:[{title:' Backend ',occupationId:'o17',id:'e1'}]});
  assert.equal(choices.ME.enabled,false);
  assert.equal(choices.MB.enabled,true);
  assert.deepEqual(batchTitleConflicts(modules,choices,[{title:'Backend',occupationId:'o17'}],'o17'),{});
  choices.ME.enabled=true;
  assert.match(batchTitleConflicts(modules,choices,[{title:'Backend',occupationId:'o17'}],'o17').ME,/Já existe/);
});
test('títulos são validados apenas na ocupação atual',()=>{
  const choices=suggestBatchRegistrations([modules[2]],db);
  const clash=batchTitleConflicts([modules[2]],choices,[{title:' backend ',occupationId:'o17'}],'o17');
  assert.match(clash.ME,/Já existe/);
  assert.deepEqual(batchTitleConflicts([modules[2]],choices,[{title:'Backend',occupationId:'o09'}],'o17'),{});
});
test('não permite dois módulos selecionados com mesmo título',()=>{
  const choices=suggestBatchRegistrations(modules,db);
  choices.MB.title='  MESMO  título';choices.MD.title='mesmo titulo';
  const clash=batchTitleConflicts(modules,choices,[],'o17');
  assert.match(clash.MB,/repetido/);
  assert.match(clash.MD,/repetido/);
});
test('lote utiliza edição e país compartilhados com substituição por módulo, preservando CIS',()=>{
  const item=modules[0];
  const opts={id:'new',date:'2026-10-29T22:00:00Z',occupationId:'o17',
    createExamFromCis,importSubcriteria:()=>[{id:'sub',aspects:[{id:'a',description:'Test',maxScore:2,method:'M'}]}]};
  const saved=batchCreatedExam(item,{title:'MB — Frontend',typeKey:'frontend',editionId:'',referenceCountry:''},{editionId:'shanghai',referenceCountry:'China'},opts);
  assert.equal(saved.editionId,'shanghai');assert.equal(saved.referenceCountry,'China');
  assert.equal(saved.title,'MB — Frontend');assert.equal(saved.maxScore,2);
  assert.equal(saved.cisImportedAt,'2026-10-29T22:00:00Z');
  assert.equal(saved.subcriteria[0].id,'sub');
  const override=batchCreatedExam(item,{title:'Customizada',typeKey:'backend',editionId:'2025',referenceCountry:'Brasil'},{editionId:'shanghai',referenceCountry:'China'},opts);
  assert.equal(override.editionId,'2025');assert.equal(override.referenceCountry,'Brasil');
});
