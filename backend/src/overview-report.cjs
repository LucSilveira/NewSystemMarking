'use strict';
/** Resumo operacional por ocupação/competidor calculado exclusivamente na API.
 * Não mistura rascunhos com aproveitamento final e limita os itens de histórico.
 */
const round=n=>Math.round((n+Number.EPSILON)*10000)/10000;
function buildOverviewReport(db,{occupationId,competitorId='all'}={}){
  if(!occupationId||!db.occupations.some(o=>String(o.id)===String(occupationId)))throw new Error('Ocupação inválida ou não autorizada');
  const competitorIds=new Set(db.competitors.filter(c=>String(c.occupationId)===String(occupationId)).map(c=>String(c.id)));
  if(competitorId!=='all'&&!competitorIds.has(String(competitorId)))throw new Error('Competidor não pertence à ocupação');
  const exams=db.exams.filter(e=>String(e.occupationId)===String(occupationId));
  const selectedExams=new Set(exams.map(e=>String(e.id)));
  const executions=db.executions.filter(e=>competitorIds.has(String(e.competitorId))&&(competitorId==='all'||String(e.competitorId)===String(competitorId))&&selectedExams.has(String(e.examId)));
  const activities=db.activities.filter(a=>{
    const occ=String(a.occupationId||db.competitors.find(c=>String(c.id)===String(a.competitorId))?.occupationId||db.exams.find(e=>String(e.id)===String(a.examId))?.occupationId||'');
    return occ===String(occupationId)&&(competitorId==='all'||String(a.competitorId)===String(competitorId));
  });
  const completed=executions.filter(e=>e.status==='finalized'&&Number.isFinite(e.overallScore)&&Number.isFinite(e.maxScore)&&e.maxScore>0);
  const earned=completed.reduce((n,e)=>n+e.overallScore,0);
  const possible=completed.reduce((n,e)=>n+e.maxScore,0);
  const wsosResults=new Map(db.wsos.filter(w=>String(w.occupationId)===String(occupationId)).map(w=>[String(w.code),{id:w.id,code:w.code,name:w.name,earned:0,maxScore:0,count:0}]));
  for(const run of completed)for(const part of run.wsosResults||[]){
    const section=wsosResults.get(String(part.wsosSection));
    if(!section||!Number.isFinite(part.earned)||!Number.isFinite(part.maxScore)||part.maxScore<=0)continue;
    section.earned+=part.earned;section.maxScore+=part.maxScore;section.count++;
  }
  const dateToday=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
  const latest=[...executions].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,6).map(e=>({id:e.id,examId:e.examId,competitorId:e.competitorId,date:e.date,status:e.status,complete:e.complete,overallScore:e.overallScore,percentage:e.percentage,coverage:e.coverage}));
  const upcoming=[...activities].filter(a=>a.date>=dateToday).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,5).map(a=>({id:a.id,title:a.title,date:a.date,startTime:a.startTime,location:a.location,status:a.status}));
  return {
    counts:{exams:exams.length,executions:executions.length,activities:activities.length},
    overall:possible?round(earned/possible*100):null,
    latest,upcoming,
    wsosResults:[...wsosResults.values()].map(w=>({...w,earned:round(w.earned),maxScore:round(w.maxScore),percentage:w.maxScore?round(w.earned/w.maxScore*100):null}))
  };
}
module.exports={buildOverviewReport};
