'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {examValidation}=require('../src/rules.cjs');
const {all}=require('../src/data.cjs');
const refs=all();
const base={id:'new-cis',title:'Nova Prova',module:'MA',occupationId:'occupation-17',typeKey:'speed-test',editionId:'',maxScore:0,areaIds:[],competencyIds:[],subcriteria:[],cisImportedAt:'2026-10-29T00:00:00.000Z'};

test('aceita criação de prova a partir de CIS, mesmo com edição e fatores técnicos em branco',()=>{
 assert.deepEqual(examValidation(base,refs),[]);
});
test('não cria prova CIS com título já existente na mesma ocupação',()=>{
 const existing=refs.exams.find(e=>e.occupationId==='occupation-17');
 assert.ok(existing);
 const duplicate={...base,title:`  ${existing.title.toUpperCase()}  `};
 assert.match(examValidation(duplicate,refs).join(' '),/Já existe uma prova com este título/);
});
test('edição de prova CIS já cadastrada não fica bloqueada pelo próprio título',()=>{
 const existing=refs.exams.find(e=>e.occupationId==='occupation-17');
 const edited={...base,id:existing.id,title:existing.title};
 assert.deepEqual(examValidation(edited,refs,{currentId:existing.id}),[]);
});
test('regra de duplicação CIS não interfere na criação manual legada',()=>{
 const existing=refs.exams.find(e=>e.occupationId==='occupation-17');
 assert.ok(existing);
 assert.deepEqual(examValidation({...base,title:existing.title,cisImportedAt:null},refs),[]);
});
