import test from 'node:test';
import assert from 'node:assert/strict';
import {soleEvaluatorDestination} from '../src/lib/workspaceAccess.js';

const occupations=[{id:'occupation-17',code:'17',name:'Tecnologias Web'},{id:'occupation-05',code:'05',name:'CAD'}];

test('avaliador com uma ocupação entra direto no painel dessa ocupação',()=>{
  const user={role:'evaluator',occupationIds:['occupation-17']};
  assert.equal(soleEvaluatorDestination(user,occupations),'/17/painel');
});
test('código com zero à esquerda é preservado',()=>{
  const user={role:'evaluator',occupationIds:['occupation-05']};
  assert.equal(soleEvaluatorDestination(user,occupations),'/05/painel');
});
test('avaliador com mais de uma ocupação continua no painel de escolha',()=>{
  const user={role:'evaluator',occupationIds:['occupation-17','occupation-05']};
  assert.equal(soleEvaluatorDestination(user,occupations),null);
});
test('administrador não é redirecionado automaticamente',()=>{
  assert.equal(soleEvaluatorDestination({role:'admin',occupationIds:['occupation-17']},occupations),null);
});
test('dados de ocupações ainda não carregados não geram destino incorreto',()=>{
  assert.equal(soleEvaluatorDestination({role:'evaluator',occupationIds:['occupation-17']},[]),null);
});
test('contas sem ocupação associada permanecem na tela de treinamento',()=>{
  assert.equal(soleEvaluatorDestination({role:'evaluator',occupationIds:[]},occupations),null);
});
