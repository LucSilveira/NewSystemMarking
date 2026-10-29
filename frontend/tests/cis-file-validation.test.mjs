import test from 'node:test';
import assert from 'node:assert/strict';
import {isCisXlsx} from '../src/lib/cisFileValidation.js';

test('aceita XLSX de qualquer capitalização', () => {
  assert.equal(isCisXlsx({name:'CIS.xlsx'}),true);
  assert.equal(isCisXlsx({name:'CIS.XLSX'}),true);
});

test('recusa formato antigo, PDF e seleção vazia', () => {
  assert.equal(isCisXlsx({name:'CIS.xls'}),false);
  assert.equal(isCisXlsx({name:'CIS.pdf'}),false);
  assert.equal(isCisXlsx(undefined),false);
});
