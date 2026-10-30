import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveReferenceTab,referenceTabUrl} from '../src/lib/referenceTabRouting.js';

const CATEGORIES=['occupationAreas','wsos','examTypes','editions'];

test('usa a aba presente na URL, independente da ordem das abas',()=>{
  for(const tab of CATEGORIES) assert.equal(resolveReferenceTab(`?aba=${tab}`,CATEGORIES),tab);
});

test('sem parâmetro mantém a aba inicial existente (Edições)',()=>{
  assert.equal(resolveReferenceTab('',CATEGORIES),'editions');
  assert.equal(resolveReferenceTab('?foo=x',CATEGORIES),'editions');
});

test('parametro inválido não leva para uma aba inexistente',()=>{
  assert.equal(resolveReferenceTab('?aba=avaliadores',CATEGORIES),'editions');
  assert.equal(resolveReferenceTab('?aba=__proto__',CATEGORIES),'editions');
});

test('fallback usa a primeira aba disponível quando Edições não está permitida',()=>{
  assert.equal(resolveReferenceTab('?aba=editions',['wsos','examTypes']),'wsos');
});

test('a URL da modalidade mantém a ocupação e identifica a aba',()=>{
  assert.equal(referenceTabUrl('/17/cadastros','wsos'),'/17/cadastros?aba=wsos');
  assert.equal(referenceTabUrl('/54/cadastros','occupationAreas'),'/54/cadastros?aba=occupationAreas');
});

test('trocando abas preserva outros parâmetros e fragmento',()=>{
  assert.equal(referenceTabUrl('/17/cadastros?foo=bar&aba=wsos#s','editions'),'/17/cadastros?foo=bar&aba=editions#s');
});

test('links diretos e refresh mantêm a aba em todos os 4 módulos',()=>{
  for(const code of ['05','17','39','54']) for(const tab of CATEGORIES) {
    const url=referenceTabUrl(`/${code}/cadastros`,tab);
    assert.equal(resolveReferenceTab(new URL(url,'http://localhost').search,CATEGORIES),tab);
  }
});
