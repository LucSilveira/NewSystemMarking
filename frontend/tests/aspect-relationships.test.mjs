import test from 'node:test';
import assert from 'node:assert/strict';
import {aspectKey, dropTargets, updateAspectRelationships} from '../src/lib/aspectRelationships.js';
const data = [{id:'s1',aspects:[
  {id:'a1',description:'A',maxScore:0.25,wsosSection:'4',areaIds:[],competencyIds:['c1']},
  {id:'a2',description:'B',maxScore:1,wsosSection:'5',areaIds:['area-1'],competencyIds:[]}
]}];
test('Drop individual afeta só o destino',()=>{
  assert.deepEqual(dropTargets('s1::a2',['s1::a1']),['s1::a2']);
});
test('Selecionados permitem associar a vários aspectos',()=>{
  const out=updateAspectRelationships(data,[aspectKey('s1','a1'),aspectKey('s1','a2')],{kind:'competency',id:'c2'});
  assert.deepEqual(out[0].aspects[0].competencyIds,['c1','c2']);
  assert.deepEqual(out[0].aspects[1].competencyIds,['c2']);
  assert.equal(out[0].aspects[1].maxScore,1);
  assert.equal(out[0].aspects[1].wsosSection,'5');
});
test('Não duplica vínculos ao repetir o drag',()=>{
  const out=updateAspectRelationships(data,['s1::a1'],{kind:'competency',id:'c1'});
  assert.deepEqual(out[0].aspects[0].competencyIds,['c1']);
});
test('Remover vínculo preserva outros e metadados CIS',()=>{
  const out=updateAspectRelationships(data,['s1::a2'],{kind:'area',id:'area-1',operation:'remove'});
  assert.deepEqual(out[0].aspects[1].areaIds,[]);
  assert.equal(out[0].aspects[1].maxScore,1);
  assert.equal(out[0].aspects[1].wsosSection,'5');
});
test('CompetencyLinks antigos permanecem reconhecidos ao editar',()=>{
  const legacy=[{id:'s1',aspects:[{id:'a1',competencyLinks:[{competencyId:'old',role:'primary'}]}]}];
  const out=updateAspectRelationships(legacy,['s1::a1'],{kind:'competency',id:'new'});
  assert.deepEqual(out[0].aspects[0].competencyIds,['old','new']);
});
test('Rejeita tipo de vínculo desconhecido',()=>{
  assert.throws(()=>updateAspectRelationships(data,['s1::a1'],{kind:'other',id:'x'}));
});

// Regras de seleção de múltiplas ORIGENS na biblioteca (v0.7.4).
import {selectSourceRelations, dragSourceRelations, updateAspectRelationshipsBatch} from '../src/lib/aspectRelationships.js';
test('Shift seleciona um intervalo dentro do grupo',()=>{
  const start=selectSourceRelations(null,{kind:'competency',id:'c1'});
  const range=selectSourceRelations(start,{kind:'competency',id:'c3',mode:'range',orderedIds:['c1','c2','c3','c4'],anchorId:'c1'});
  assert.deepEqual(range,{kind:'competency',ids:['c1','c2','c3']});
});
test('Shift adiciona intervalo aos itens já selecionados',()=>{
  const previous={kind:'area',ids:['a4']};
  const range=selectSourceRelations(previous,{kind:'area',id:'a3',mode:'range',orderedIds:['a1','a2','a3','a4'],anchorId:'a1'});
  assert.deepEqual(range.ids,['a4','a1','a2','a3']);
});
test('Botão + alterna itens e mantém seleção sem duplicações',()=>{
  let selection=selectSourceRelations(null,{kind:'area',id:'a1',mode:'toggle'});
  selection=selectSourceRelations(selection,{kind:'area',id:'a2',mode:'toggle'});
  selection=selectSourceRelations(selection,{kind:'area',id:'a1',mode:'toggle'});
  assert.deepEqual(selection,{kind:'area',ids:['a2']});
});
test('Seleção de uma área não mistura competências no mesmo arraste',()=>{
  const selection=selectSourceRelations({kind:'area',ids:['a1','a2']},{kind:'competency',id:'c1',mode:'toggle'});
  assert.deepEqual(selection,{kind:'competency',ids:['c1']});
  assert.deepEqual(dragSourceRelations(selection,'area','a2'),{kind:'area',ids:['a2']});
});
test('Arrastar item marcado carrega todos, item não marcado carrega só ele',()=>{
  const selection={kind:'competency',ids:['c1','c2']};
  assert.deepEqual(dragSourceRelations(selection,'competency','c1'),{kind:'competency',ids:['c1','c2']});
  assert.deepEqual(dragSourceRelations(selection,'competency','c3'),{kind:'competency',ids:['c3']});
});
test('Múltiplas competências aplicam a múltiplos aspectos sem duplicar pontos nem WSOS',()=>{
  const out=updateAspectRelationshipsBatch(data,['s1::a1','s1::a2'],{kind:'competency',ids:['c1','c2','c2']});
  assert.deepEqual(out[0].aspects[0].competencyIds,['c1','c2']);
  assert.deepEqual(out[0].aspects[1].competencyIds,['c1','c2']);
  assert.equal(out[0].aspects[0].maxScore,0.25);
  assert.equal(out[0].aspects[1].wsosSection,'5');
});
test('Remover vários vínculos não afeta as outras associações',()=>{
  const out=updateAspectRelationshipsBatch(data,['s1::a1'],{kind:'competency',ids:['c1','c2'],operation:'remove'});
  assert.deepEqual(out[0].aspects[0].competencyIds,[]);
  assert.deepEqual(out[0].aspects[1].areaIds,['area-1']);
});
