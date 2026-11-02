// Metadados e agrupamentos de Execuções: nenhuma lógica depende de títulos únicos.
const normalized = v => String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const examHasCis = exam => (exam?.subcriteria||[]).some(s=>(s.aspects||[]).length>0);
export const examHasConsistentCis = exam => {
  const aspects=(exam?.subcriteria||[]).flatMap(s=>s.aspects||[]);
  const max=aspects.reduce((t,a)=>t+Number(a.maxScore||0),0);
  return aspects.length>0 && aspects.every(a=>a.id && (a.method==='M'||a.method==='J') && Number.isFinite(Number(a.maxScore)) && Number(a.maxScore)>=0) && Math.abs(Number(exam.maxScore)-max)<.000001;
};
export const editionLabel=(exam,editions)=>editions.find(e=>e.id===exam?.editionId)?.name || 'Sem edição';
export const typeLabel=(exam,types)=>types.find(t=>t.id===exam?.typeKey||t.key===exam?.typeKey)?.name || 'Sem tipo';
export function examSearchGroups(exams,editions,query=''){
  const search=normalized(query);
  const matching=exams.filter(e=>normalized(`${e.module} ${e.title} ${editionLabel(e,editions)}`).includes(search));
  const grouped=new Map();
  for(const e of matching){const label=editionLabel(e,editions),a=grouped.get(label)||[];a.push(e);grouped.set(label,a);}
  return [...grouped.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')).map(([edition,items])=>({edition,items:items.sort((a,b)=>String(a.module).localeCompare(String(b.module),'pt-BR')||a.title.localeCompare(b.title,'pt-BR'))}));
}
export function executionGroups(rows,exams,editions,types,groupBy='edition'){
  const groups=new Map();
  for(const execution of rows){
    const exam=exams.find(e=>e.id===execution.examId)||execution.examSnapshot||{};
    const label=groupBy==='type'?typeLabel(exam,types):editionLabel(exam,editions);
    const list=groups.get(label)||[];list.push(execution);groups.set(label,list);
  }
  return [...groups.entries()].map(([label,items])=>({label,items:items.sort((a,b)=>String(b.date).localeCompare(String(a.date)))}))
    .sort((a,b)=>String(b.items[0]?.date||'').localeCompare(String(a.items[0]?.date||''))||a.label.localeCompare(b.label,'pt-BR'));
}

/** Dentro de uma edição/tipo, cada prova possui um histórico independente de tentativas. */
export function executionExamHistories(executions,exams){
  const byExam=new Map();
  for(const execution of executions){
    const id=String(execution.examId||execution.examSnapshot?.id||'sem-prova');
    if(!byExam.has(id)) byExam.set(id,[]);
    byExam.get(id).push(execution);
  }
  return [...byExam.entries()].map(([examId,items])=>{
    const sorted=[...items].sort((a,b)=>
      String(b.date||'').localeCompare(String(a.date||'')) ||
      String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')) ||
      String(b.id||'').localeCompare(String(a.id||'')));
    const exam=exams.find(e=>String(e.id)===examId)||sorted[0]?.examSnapshot||{};
    return {examId,exam,latest:sorted[0],executions:sorted,count:sorted.length};
  }).sort((a,b)=>String(b.latest?.date||'').localeCompare(String(a.latest?.date||''))||
    String(a.exam?.title||'').localeCompare(String(b.exam?.title||''),'pt-BR'));
}
