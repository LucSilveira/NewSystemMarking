import test from 'node:test';
import assert from 'node:assert/strict';
import {examAreaIds, catalogOptions, filterExamCatalog, activeExamFilterCount} from '../src/lib/examCatalogFilters.js';

const base = [
  {id:'a',title:'Speed Test',module:'MA',referenceCountry:'Brasil',typeKey:'speed',editionId:'2026',areaIds:['front'],subcriteria:[],sourceExamId:null},
  {id:'b',title:'Design Implementation',module:'MF',referenceCountry:'China',typeKey:'design',editionId:'2026',areaIds:[],subcriteria:[{aspects:[{areaIds:['ui','front']}]}],sourceExamId:null},
  {id:'c',title:'Speed Test adaptada',module:'MA',referenceCountry:'Brasil',typeKey:'speed',editionId:'2025',areaIds:['back'],subcriteria:[],sourceExamId:'a'},
  {id:'d',title:'Formulário',module:'MB',referenceCountry:'Portugal',typeKey:'frontend',editionId:'2025',areaIds:[],subcriteria:[],sourceExamId:null}
];
const refs={examTypes:[{key:'speed',name:'Teste de velocidade'},{key:'design',name:'Implementação de Design'},{key:'frontend',name:'Front-end'}],editions:[{id:'2026',name:'WorldSkills 2026'},{id:'2025',name:'Nacional 2025'}],occupationAreas:[{id:'front',name:'Front-end'},{id:'back',name:'Back-end'},{id:'ui',name:'Interface de usuário'}]};
const run = filters => filterExamCatalog(base,filters,refs).map(x=>x.id);

test('áreas abrangem o campo geral e os vínculos dos aspectos CIS, sem repetição',()=>{
  assert.deepEqual(examAreaIds(base[1]),['ui','front']);
  assert.deepEqual(examAreaIds(base[0]),['front']);
  assert.deepEqual(examAreaIds({areaIds:['front'],subcriteria:[{aspects:[{areaIds:['front','ui']}]}]}),['front','ui']);
});
test('áreas multisselecionadas são OR entre si, combinadas com tipo via AND',()=>{
  assert.deepEqual(run({areaIds:['front','back']}),['a','b','c']);
  assert.deepEqual(run({areaIds:['front','ui'],typeKey:'speed'}),['a']);
});
test('filtros combinados incluem módulo, edição, país e original/adaptada',()=>{
  assert.deepEqual(run({module:'MA',editionId:'2025',country:'BRASIL',origin:'adapted'}),['c']);
  assert.deepEqual(run({origin:'original'}),['a','b','d']);
  assert.deepEqual(run({typeKey:'design',module:'MF'}),['b']);
  assert.deepEqual(run({typeKey:'design',module:'MA'}),[]);
});
test('busca ignora acentos, pesquisa edição, tipo e área',()=>{
  assert.deepEqual(run({search:'implementacao de design'}),['b']);
  assert.deepEqual(run({search:'nacional 2025'}),['c','d']);
  assert.deepEqual(run({search:'Interface de usuario'}),['b']);
  assert.deepEqual(run({search:'speed TEST'}),['a','c']);
});
test('opções são dinâmicas, incluindo versões e códigos cadastrados',()=>{
  assert.deepEqual(catalogOptions(base,refs.examTypes,refs.occupationAreas).modules,['MA','MB','MF']);
  assert.deepEqual(catalogOptions(base,refs.examTypes,refs.occupationAreas).countries,['Brasil','China','Portugal']);
});
test('estado limpo e contagem de filtros ativos',()=>{
  assert.deepEqual(run({}),['a','b','c','d']);
  assert.equal(activeExamFilterCount({search:'',typeKey:'all',areaIds:[],module:'all',editionId:'all',country:'all',origin:'all'}),0);
  assert.equal(activeExamFilterCount({search:'web',typeKey:'speed',areaIds:['front','ui'],module:'MA',editionId:'all',country:'all',origin:'adapted'}),6);
});
test('não quebra com provas sem subcritérios, ausência de referências e propriedades vazias',()=>{
  assert.deepEqual(examAreaIds({}),[]);
  assert.deepEqual(filterExamCatalog([{id:1,title:'ABC'}],{search:'abc'}).map(x=>x.id),[1]);
});
