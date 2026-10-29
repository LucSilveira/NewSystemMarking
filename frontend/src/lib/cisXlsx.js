import {parseCisRows} from './cisParser.js';

/** XLSX processado no navegador; nenhum arquivo é enviado ou armazenado no back-end. */
export async function readCisXlsx(file) {
  if (!file) throw new Error('Selecione um arquivo XLSX.');
  if (!/\.xlsx$/i.test(file.name)) throw new Error('O arquivo deve ter extensão .xlsx.');
  if (file.size>10*1024*1024) throw new Error('O arquivo excede o limite de 10 MB.');
  const {readSheet}=await import('read-excel-file/browser');
  const rows=await readSheet(file); // O CIS fornecido usa a primeira aba.
  return parseCisRows(rows);
}
