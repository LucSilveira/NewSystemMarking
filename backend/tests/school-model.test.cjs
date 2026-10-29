'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {CATALOG}=require('../scripts/seed-school.cjs');
const {validatePayload}=require('../src/rules.cjs');
test('10 ocupações, 9 avaliadores e 9 competidores',()=>{
 assert.equal(CATALOG.length,10);assert.equal(CATALOG.filter(a=>a[2]).length,9);assert.equal(CATALOG.reduce((n,a)=>n+a[3].length,0),9);
});
test('ocupação em dupla e vagas vazias',()=>{
 assert.equal(CATALOG.find(a=>a[0]==='54')[3].length,2);
 assert.equal(CATALOG.find(a=>a[0]==='11')[3].length,0);
 assert.equal(CATALOG.find(a=>a[0]==='45')[3].length,0);
});

test('rejeita execuções entre ocupações distintas',()=>{
 const refs={occupations:[{id:'occupation-17'},{id:'occupation-08'}],exams:[{id:'exam17',occupationId:'occupation-17'}],competitors:[{id:'comp08',occupationId:'occupation-08'}],activities:[],competencies:[],editions:[],wsos:[],occupationAreas:[],examTypes:[]};
 const errs=validatePayload('executions',{examId:'exam17',competitorId:'comp08',date:'2026-10-28'},refs);
 assert.ok(errs.some(x=>x.includes('ocupações diferentes')));
});
test('equipes exigem integrantes da mesma ocupação',()=>{
 const refs={occupations:[{id:'a'},{id:'b'}],competitors:[{id:'x',occupationId:'a'},{id:'y',occupationId:'b'}]};
 assert.ok(validatePayload('teams',{name:'Dupla',occupationId:'a',competitorIds:['x','y']},refs).some(x=>x.includes('outra ocupação')));
});
test('avaliadores podem atuar em mais de uma ocupação',()=>{
 const refs={occupations:[{id:'a'},{id:'b'}]};
 assert.deepEqual(validatePayload('evaluators',{name:'Expert',occupationIds:['a','b']},refs),[]);
});
