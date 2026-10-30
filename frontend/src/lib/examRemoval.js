/** Registros que impedem a exclusão segura de uma prova. */
export function examRemovalBlockers(examId, db) {
  const count=(rows,field)=> (Array.isArray(rows)?rows:[]).filter(row=>row[field]===examId).length;
  return [
    {singular:'execução',plural:'execuções',count:count(db.executions,'examId')},
    {singular:'atividade',plural:'atividades',count:count(db.activities,'examId')},
    {singular:'prova adaptada',plural:'provas adaptadas',count:count(db.exams,'sourceExamId')}
  ].filter(item=>item.count>0);
}

export function examRemovalWarning(blockers) {
  return blockers.map(({singular,plural,count})=>`${count} ${count===1?singular:plural}`).join(', ');
}
