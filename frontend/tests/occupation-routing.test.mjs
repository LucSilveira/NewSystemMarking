import test from 'node:test';
import assert from 'node:assert/strict';
import {occupationPath,readOccupationRoute,occupationCode,ROUTES} from '../src/lib/occupationRouting.js';

test('raiz abre login e painel autenticado tem rota própria',()=>{assert.deepEqual(readOccupationRoute('/'),{type:'login'});assert.deepEqual(readOccupationRoute('/login'),{type:'login'});assert.deepEqual(readOccupationRoute('/painel'),{type:'home'});assert.deepEqual(readOccupationRoute('/admin'),{type:'admin'});});
test('código na URL identifica a ocupação e a tela',()=>{
  assert.deepEqual(readOccupationRoute('/17/provas'),{type:'workspace',code:'17',page:'exams'});
  assert.deepEqual(readOccupationRoute('/54/competidores'),{type:'workspace',code:'54',page:'competitors'});
  assert.deepEqual(readOccupationRoute('/05/execucoes'),{type:'workspace',code:'05',page:'executions'});
});
test('caminho apenas com código abre o painel daquela ocupação',()=>assert.deepEqual(readOccupationRoute('/17'),{type:'workspace',code:'17',page:'dashboard'}));
test('códigos com um dígito são normalizados',()=>{
  assert.equal(occupationCode('5'),'05');assert.equal(occupationPath('5','exams'),'/05/provas');
  assert.equal(occupationPath('#17','competencies'),'/17/competencias');
});
test('construtor de caminhos cobre todas as áreas',()=>{
  for(const [page,{slug}] of Object.entries(ROUTES)){
    assert.deepEqual(readOccupationRoute(occupationPath('17',page)),{type:'workspace',code:'17',page});
    assert.equal(occupationPath('17',page),`/17/${slug}`);
  }
});
test('URLs inválidas não caem silenciosamente na ocupação 17',()=>{
  for(const path of ['/qualquer/provas','/17/nao-existe','/17/provas/xxx','/%ZZ/provas'])assert.equal(readOccupationRoute(path).type,'notfound');
});
test('trailing slash é aceito',()=>assert.deepEqual(readOccupationRoute('/54/atividades/'),{type:'workspace',code:'54',page:'activities'}));
