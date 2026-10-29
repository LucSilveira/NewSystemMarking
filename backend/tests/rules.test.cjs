'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {computeExecution,validatePayload}=require('../src/rules.cjs');
const exam={maxScore:2,subcriteria:[{id:'b1',code:'B1',aspects:[{id:'a1',method:'M',maxScore:1,wsosSection:'4'},{id:'a2',method:'J',maxScore:1,wsosSection:'3'}]}]};
test('full aspect correction and WSOS totals',()=>{
 const out=computeExecution({mode:'aspects',scores:[{id:'a1',score:.5},{id:'a2',judgementLevel:3}]},exam);
 assert.equal(out.overallScore,1.5);assert.equal(out.coverage,100);assert.equal(out.wsosResults.length,2);
});
test('partial corrections do not fabricate final score',()=>{
 const out=computeExecution({mode:'aspects',scores:[{id:'a1',score:0}]},exam);
 assert.equal(out.overallScore,null);assert.equal(out.coverage,50);
});
test('reject score above maximum and duplicate aspect',()=>{
 assert.throws(()=>computeExecution({mode:'aspects',scores:[{id:'a1',score:1.1}]},exam));
 assert.throws(()=>computeExecution({mode:'aspects',scores:[{id:'a1',score:.5},{id:'a1',score:.5}]},exam));
});
test('an activity can be planned only to the end of the next three months',()=>{
 const refs={competitors:[],exams:[]}; const y=new Date().getFullYear()+3;
 assert.ok(validatePayload('activities',{title:'Teste',type:'training',date:`${y}-04-10`},refs).length>0);
});
