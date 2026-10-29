import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCisRows,importSubcriteria,preserveAspectRelations} from '../src/lib/cisParser.js';
function r(entries={}) {const row=Array(14).fill(null);for(const [k,v] of Object.entries(entries))row[k.charCodeAt(0)-65]=v;return row;}
const mock=[
 r({A:'ID',B:'Name',K:'Mark'}),
 r({A:'A',B:'Mini Test Projects',K:2.5}),
 r({A:'B',B:'Conference Mobile',K:1}),
 r({A:'Sub\nCriterion\nID',B:'Sub Criterion Name',L:'Criterion A'}),
 r({A:'A1',B:'Client-side',C:1}),
 r({D:'M',E:'Persistência de dados',G:'Reduzir 0,25 por erro',H:0,I:4,K:1.5}),
 r({D:'J',E:'Qualidade de código',I:4,K:1}),
 r({F:3,G:'Perfeito'}),r({F:2,G:'Bom'}),r({F:1,G:'Parcial'}),r({F:0,G:'Ausente'}),
 r({A:'Sub Criterion ID',L:'Criterion B'}),
 r({A:'B1',B:'SPA'}),r({D:'M',E:'Rota funciona',I:4,K:1}),
 r({A:'Sub Criterion ID',L:'Criterion C'}),
];
test('lê módulos por L, e subcritérios por A',()=>{
 const result=parseCisRows(mock);
 assert.deepEqual(result.modules.map(x=>x.module),['MA','MB']);
 assert.deepEqual(result.modules.map(x=>x.totalScore),[2.5,1]);
 assert.equal(result.headerCount,3);
 assert.equal(result.modules[0].subcriteria[0].code,'A1');
});
test('preserva G e os quatro níveis Judgement sem criar 4 aspectos',()=>{
 const a=parseCisRows(mock).modules[0].subcriteria[0].aspects;
 assert.equal(a.length,2);
 assert.equal(a[0].considerations,'Reduzir 0,25 por erro');
 assert.equal(a[0].measurementRequirement,0);
 assert.equal(a[1].judgement[0],'Ausente');
 assert.equal(a[1].judgement[3],'Perfeito');
});
test('reimportação preserva mapeamento e id dos aspectos correspondentes',()=>{
 const m=parseCisRows(mock).modules[0];
 let id=0;
 const imported=importSubcriteria(m,()=>`novo-${++id}`);
 const old={subcriteria:[{...imported[0],id:'antigo-sub',aspects:[{...imported[0].aspects[0],id:'antigo-asp',areaIds:['area-1'],competencyIds:['comp-1']},imported[0].aspects[1]]}]};
 const merged=preserveAspectRelations(old,imported);
 assert.equal(merged[0].id,'antigo-sub');
 assert.equal(merged[0].aspects[0].id,'antigo-asp');
 assert.deepEqual(merged[0].aspects[0].competencyIds,['comp-1']);
});
test('rejeita planilha que não contém cabeçalhos de CIS',()=>{
 assert.throws(()=>parseCisRows([r({A:'A1',D:'M',E:'abc'})]),/Nenhum bloco CIS/);
});
