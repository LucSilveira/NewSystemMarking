import test from 'node:test';
import assert from 'node:assert/strict';
import {previewCisScores,mergeImportedScores,moduleFromCis} from '../src/lib/cisScores.js';
const exam={module:'MB',maxScore:.75,subcriteria:[{code:'B1',aspects:[{id:'a',description:'Reachable site',method:'M',maxScore:.25,cisSourceRow:3},{id:'b',description:'Commit quality',method:'J',maxScore:.50,cisSourceRow:4}]}]};
const module={module:'MB',subcriteria:[{code:'B1',aspects:[{description:'Reachable site',method:'M',sourceRow:3},{description:'Commit quality',method:'J',sourceRow:4}]}]};
test('imports numeric scores from L including zero for both M and J',()=>{
 const rows=[[],[],[null,null,null,null,null,null,null,null,null,null,null,0],[null,null,null,null,null,null,null,null,null,null,null,.45]];
 const p=previewCisScores(rows,module,exam);assert.equal(p.matched,2);assert.equal(p.missing,0);assert.equal(p.total,.45);assert.deepEqual(p.scores.map(s=>s.score),[0,.45]);assert.equal(p.scores[1].source,'xlsx');
});
test('rejects excessive score or nonnumeric without treating blank as zero',()=>{
 const p=previewCisScores([[],[],[,,,,,,,,,,,9],[,,,,,,,,,,,null]],module,exam);
 assert.equal(p.matched,0);assert.equal(p.missing,2);assert.match(p.warnings.join(' '),/fora do intervalo/);
});
test('does not map the correct column to an unrelated description',()=>{
 const modified={...exam,subcriteria:[{code:'B1',aspects:[{...exam.subcriteria[0].aspects[0],description:'Another aspect'}]}]};
 const p=previewCisScores([[],[],[,,,,,,,,,,,.2]],module,modified);
 assert.equal(p.matched,0);assert.match(p.warnings.join(' '),/não localizado/);
});
test('preserves existing manual scores by default and can replace on demand',()=>{
 const existing=[{id:'a',score:.25,source:'manual'}],imported=[{id:'a',score:0,source:'xlsx'},{id:'b',score:.4,source:'xlsx'}];
 const keep=mergeImportedScores(existing,imported);assert.equal(keep.scores[0].score,.25);assert.equal(keep.skipped,1);assert.equal(keep.added,1);
 const replace=mergeImportedScores(existing,imported,{replace:true});assert.equal(replace.scores[0].score,0);assert.equal(replace.replaced,1);
});
test('selects matching module',()=>assert.equal(moduleFromCis({modules:[module]},exam),module));
