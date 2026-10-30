import test from 'node:test';
import assert from 'node:assert/strict';
import {readOccupationRoute,executionPath} from '../src/lib/occupationRouting.js';
test('execution creation and batch import have distinct URLs',()=>{
 assert.deepEqual(readOccupationRoute('/17/execucoes/nova'),{type:'workspace',code:'17',page:'executions',executionView:'new'});
 assert.deepEqual(readOccupationRoute('/05/execucoes/importar'),{type:'workspace',code:'05',page:'executions',executionView:'batch'});
});
test('editing a historical execution keeps occupation context',()=>{
 const url=executionPath('54','a1b2c3-d4');assert.equal(url,'/54/execucoes/a1b2c3-d4');
 assert.deepEqual(readOccupationRoute(url),{type:'workspace',code:'54',page:'executions',executionView:'edit',executionId:'a1b2c3-d4'});
});
test('disallows paths outside the execution workspace',()=>{
 assert.equal(readOccupationRoute('/17/provas/nova').type,'notfound');
 assert.equal(readOccupationRoute('/17/execucoes/%E0%A4%A').type,'notfound');
 assert.throws(()=>executionPath('17','../other'));
});
