// Análise independente das evidências CIS e dos registros subjetivos do avaliador.
// Nenhuma nota pode ser atribuída a uma competência sem vínculo com o aspecto avaliado.
export const COMPETENCY_CATEGORIES = Object.freeze([
  {value:'technical',label:'Técnica',description:'Tecnologias, ferramentas e práticas da ocupação'},
  {value:'cognitive',label:'Cognitiva',description:'Leitura, raciocínio e interpretação'},
  {value:'behavioral',label:'Comportamental',description:'Colaboração, organização e atitudes'},
  {value:'communication',label:'Idiomas e comunicação',description:'Inglês, expressão e compreensão'},
  {value:'other',label:'Outra habilidade',description:'Outros fatores acompanhados pelo avaliador'},
]);

export const competencyCategory = value =>
  COMPETENCY_CATEGORIES.find(item=>item.value===value) || COMPETENCY_CATEGORIES[0];

export function dateBR(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (value||'—');
}

export function aspectLinkedToCompetency(aspect,competencyId){
  if(!aspect||!competencyId)return false;
  const id=String(competencyId);
  return (Array.isArray(aspect.competencyIds)&&aspect.competencyIds.some(value=>String(value)===id)) ||
    (Array.isArray(aspect.competencyLinks)&&aspect.competencyLinks.some(link=>String(link?.competencyId)===id));
}

export function getCompetencyCisStats(competencyId,competitorId,executions=[],exams=[]){
  let pointsEarned=0,pointsAvailable=0,aspectGrades=0;
  const history=[];
  const distinctMappedAspects=new Set();
  const examById=new Map(exams.map(exam=>[String(exam.id),exam]));
  const relevant=executions.filter(run=>
    String(run.competitorId)===String(competitorId) &&
    (run.status==='finalized'||(run.status==null&&run.complete===true)) &&
    run.mode==='aspects'
  );
  for(const run of relevant){
    // O snapshot da execução preserva o mapeamento utilizado naquele momento.
    const exam=run.examSnapshot||examById.get(String(run.examId));
    if(!exam)continue;
    const mapping=new Map();
    for(const sub of exam.subcriteria||[]){
      for(const aspect of sub.aspects||[]){
        if(aspectLinkedToCompetency(aspect,competencyId))mapping.set(String(aspect.id),aspect);
      }
    }
    let earned=0,possible=0,count=0;
    const seen=new Set();
    for(const score of run.scores||[]){
      const id=String(score.id);
      const aspect=mapping.get(id);
      if(!aspect||seen.has(id))continue;
      const max=Number(aspect.maxScore);
      const awarded=Number(score.score);
      if(!Number.isFinite(max)||max<=0||!Number.isFinite(awarded)||awarded<0||awarded>max+0.000001)continue;
      seen.add(id);
      count++;
      earned+=awarded;
      possible+=max;
      distinctMappedAspects.add(`${run.examId}:${id}`);
    }
    if(!count)continue;
    pointsEarned+=earned;
    pointsAvailable+=possible;
    aspectGrades+=count;
    history.push({
      executionId:run.id,examId:run.examId,examTitle:exam.title||'Prova',module:exam.module||'',
      date:run.date||'',earned,possible,percentage:possible?earned/possible*100:null,aspectCount:count,
    });
  }
  history.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.executionId).localeCompare(String(a.executionId)));
  return {
    earned:pointsEarned,possible:pointsAvailable,percentage:pointsAvailable?pointsEarned/pointsAvailable*100:null,
    aspectGrades,uniqueAspects:distinctMappedAspects.size,executionCount:history.length,history,
  };
}

export function getCompetencyAssessments(competencyId,competitorId,assessments=[]){
  return assessments.filter(item=>String(item.competencyId)===String(competencyId)&&String(item.competitorId)===String(competitorId))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
}
