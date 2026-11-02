'use strict';
/** Relatório de competências calculado no servidor, a partir do snapshot da execução. */
const linked=(aspect,id)=>(aspect.competencyIds||[]).some(x=>String(x)===String(id))||
  (aspect.competencyLinks||[]).some(x=>String(x.competencyId)===String(id));
const round=value=>Math.round((value+Number.EPSILON)*1e6)/1e6;
function reportCompetency(db,competitorId,competencyId){
 const exams=new Map(db.exams.map(x=>[x.id,x]));
 const history=[],unique=new Set();let earned=0,possible=0,aspectGrades=0;
 for(const run of db.executions){
  if(String(run.competitorId)!==String(competitorId)||run.mode!=='aspects'||run.status!=='finalized')continue;
  const exam=run.examSnapshot||exams.get(run.examId);if(!exam)continue;
  const mapped=new Map();for(const sub of exam.subcriteria||[])for(const aspect of sub.aspects||[]){if(linked(aspect,competencyId))mapped.set(String(aspect.id),aspect)}
  let pointsEarned=0,pointsPossible=0,count=0;const seen=new Set();
  for(const score of run.scores||[]){const id=String(score.id),aspect=mapped.get(id);
   if(!aspect||seen.has(id))continue;
   const max=Number(aspect.maxScore),value=Number(score.score);
   if(!Number.isFinite(max)||max<=0||!Number.isFinite(value)||value<0||value>max+0.000001)continue;
   seen.add(id);pointsEarned+=value;pointsPossible+=max;count++;unique.add(`${run.examId}:${id}`);
  }
  if(!count)continue;
  earned+=pointsEarned;possible+=pointsPossible;aspectGrades+=count;
  history.push({executionId:run.id,examId:run.examId,examTitle:exam.title||'Prova',module:exam.module||'',date:run.date||'',earned:round(pointsEarned),possible:round(pointsPossible),percentage:pointsPossible?round(pointsEarned/pointsPossible*100):null,aspectCount:count});
 }
 history.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.executionId).localeCompare(String(a.executionId)));
 return {earned:round(earned),possible:round(possible),percentage:possible?round(earned/possible*100):null,aspectGrades,uniqueAspects:unique.size,executionCount:history.length,history};
}
function reportCompetencies(db,competitorId){
 const latest=new Map();for(const item of db.technicalAssessments.filter(a=>a.competitorId===competitorId)){
  const previous=latest.get(item.competencyId);
  if(!previous||String(item.date)>String(previous.date)||(item.date===previous.date&&String(item.id)>String(previous.id)))latest.set(item.competencyId,item);
 }
 return db.competencies.filter(c=>c.occupationId===db.competitors.find(x=>x.id===competitorId)?.occupationId).map(c=>({
  competencyId:c.id,category:c.category||'technical',cis:reportCompetency(db,competitorId,c.id),latestAssessment:latest.get(c.id)||null,
 }));
}
module.exports={reportCompetency,reportCompetencies,linked};
