import test from 'node:test';
import assert from 'node:assert/strict';
import {examRemovalBlockers,examRemovalWarning} from '../src/lib/examRemoval.js';

const db={
 executions:[{id:'e1',examId:'exam-1'},{id:'e2',examId:'exam-2'}],
 activities:[{id:'a1',examId:'exam-1'},{id:'a2',examId:'exam-1'}],
 exams:[{id:'exam-1'},{id:'exam-2',sourceExamId:'exam-1'}]
};
test('prova sem vínculos pode ser excluída',()=>{
 assert.deepEqual(examRemovalBlockers('exam-2',{...db,executions:[],activities:[]}),[]);
});
test('lista execuções, atividades e adaptações que impedem excluir',()=>{
 assert.deepEqual(examRemovalBlockers('exam-1',db),[
  {singular:'execução',plural:'execuções',count:1},{singular:'atividade',plural:'atividades',count:2},{singular:'prova adaptada',plural:'provas adaptadas',count:1}
 ]);
});
test('não confunde vínculos entre provas diferentes',()=>{
 assert.deepEqual(examRemovalBlockers('exam-2',db),[{singular:'execução',plural:'execuções',count:1}]);
});
test('gera um aviso de vínculos compreensível',()=>{
 assert.equal(examRemovalWarning(examRemovalBlockers('exam-1',db)),'1 execução, 2 atividades, 1 prova adaptada');
});
