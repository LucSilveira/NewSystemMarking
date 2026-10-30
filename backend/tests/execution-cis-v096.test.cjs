'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {computeExecution,executionChangeLocked}=require('../src/rules.cjs');
const exam={maxScore:1,subcriteria:[{code:'B1',id:'s1',aspects:[{id:'m1',method:'M',maxScore:.25,wsosSection:'4'},{id:'j1',method:'J',maxScore:.75,wsosSection:'3'}]}]};
test('measurement checked full and judgement three votes',()=>{
 const result=computeExecution({mode:'aspects',status:'finalized',scores:[{id:'m1',score:.25,achieved:true,source:'manual'},{id:'j1',votes:[2,2,3],source:'manual'}]},exam);
 assert.equal(result.complete,true);assert.equal(result.status,'finalized');assert.equal(result.coverage,100);assert.equal(result.overallScore,round(0.25+.75*7/9));assert.deepEqual(result.scores[1].votes,[2,2,3]);
});
const round=n=>Math.round((n+Number.EPSILON)*1e6)/1e6;
test('imported Judgement score accepted without fabricating votes',()=>{
 const result=computeExecution({mode:'aspects',status:'draft',scores:[{id:'j1',score:0,source:'xlsx'}]},exam);
 assert.equal(result.coverage,50);assert.equal(result.overallScore,null);assert.equal(result.scores[0].score,0);assert.equal(result.scores[0].votes,undefined);
});
test('partial correction can be draft but not finalized',()=>{
 assert.equal(computeExecution({mode:'aspects',status:'draft',scores:[{id:'m1',score:0,achieved:false}]},exam).status,'draft');
 assert.throws(()=>computeExecution({mode:'aspects',status:'finalized',scores:[{id:'m1',score:0,achieved:false}]},exam),/Finalize somente/);
});
test('invalid judgement votes, score or measurement state rejected',()=>{
 assert.throws(()=>computeExecution({mode:'aspects',scores:[{id:'j1',votes:[0,1]}]},exam),/três votos/);
 assert.throws(()=>computeExecution({mode:'aspects',scores:[{id:'j1',votes:[1,2,4]}]},exam),/três votos/);
 assert.throws(()=>computeExecution({mode:'aspects',scores:[{id:'m1',score:.2,achieved:false}]},exam),/deve valer zero/);
 assert.throws(()=>computeExecution({mode:'aspects',scores:[{id:'m1',score:.3,achieved:true}]},exam),/limite/);
});
test('keeps legacy modes and previous judgementLevel mechanism',()=>{
 assert.equal(computeExecution({mode:'aspects',scores:[{id:'j1',judgementLevel:3},{id:'m1',score:.25}]},exam).overallScore,1);
 assert.equal(computeExecution({mode:'overall',scores:[{id:'overall',score:.6}]},exam).overallScore,.6);
});

test('finalized execution requires explicit reopening before editing',()=>{
 const saved={status:'finalized',scores:[{id:'m1',score:.25}],mode:'aspects',notes:'ok',date:'2026-10-29',examId:'x',competitorId:'c'};
 assert.equal(executionChangeLocked(saved,{...saved,status:'draft'}),false);
 assert.equal(executionChangeLocked(saved,{...saved,status:'draft',scores:[{id:'m1',score:0}]}),true);
 assert.equal(executionChangeLocked(saved,{...saved,status:'finalized',notes:'changed'}),true);
});
