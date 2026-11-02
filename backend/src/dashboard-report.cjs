'use strict';
/**
 * Agregação de evidências CIS para o Dashboard, executada na API.
 * Aspects are read from the execution snapshot, never from the latest exam mapping.
 * WSOS / area / competency percentages have independent denominators and must not be summed.
 */
const {dateStr}=require('./rules.cjs');
const round=n=>Math.round((Number(n)+Number.EPSILON)*10000)/10000;
const cleanId=value=>String(value??'');
const scoreValid=(s,max)=>s&&typeof s.score==='number'&&Number.isFinite(s.score)&&Number.isFinite(max)&&max>0&&s.score>=0&&s.score<=max+0.000001;
const isoDate=d=>[d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-');
const brDate=(d)=>{
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
};
const shiftDate=(date,delta)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+delta);return isoDate(d)};
const fromMonth=date=>`${date.slice(0,7)}-01`;
const fromYear=date=>`${date.slice(0,4)}-01-01`;
const unique=values=>[...new Set((values||[]).filter(x=>x!=null).map(cleanId))];
const linkedCompetencies=aspect=>unique([...(aspect.competencyIds||[]),...(aspect.competencyLinks||[]).map(x=>x.competencyId)]);
function parseRange(input={},clock=new Date()){
 const currentDate=brDate(clock);
 const range=['all','month','90d','year','custom'].includes(input.range)?input.range:'all';
 let dateFrom=range==='month'?fromMonth(currentDate):range==='90d'?shiftDate(currentDate,-89):range==='year'?fromYear(currentDate):null;
 let dateTo=currentDate;
 if(range==='custom'){
  dateFrom=dateStr(input.dateFrom)?input.dateFrom:null;
  dateTo=dateStr(input.dateTo)?input.dateTo:currentDate;
  if(!dateFrom||dateFrom>dateTo)throw new Error('Intervalo inválido: informe datas válidas de início e término');
 }
 return {range,dateFrom,dateTo};
}
const percentage=(earned,possible)=>possible>0?round(100*earned/possible):null;
function metric(reference){return {...reference,earned:0,possible:0,aspectGrades:0,executionIds:new Set()}}
function add(metricItem,score,max,executionId){metricItem.earned+=score;metricItem.possible+=max;metricItem.aspectGrades++;metricItem.executionIds.add(executionId)}
function finish(item){const {executionIds,...rest}=item;return {...rest,earned:round(item.earned),possible:round(item.possible),percentage:percentage(item.earned,item.possible),executionCount:executionIds.size}}
function bucketLabel(bucket,period){if(period.range==='month'||period.range==='custom'&&period.dateFrom&&period.dateFrom.slice(0,7)===period.dateTo.slice(0,7))return `${bucket.slice(8,10)}/${bucket.slice(5,7)}`;return `${bucket.slice(5,7)}/${bucket.slice(0,4)}`;}
function buildDashboardReport(db,params={},clock=new Date()){
 const occupationId=cleanId(params.occupationId);
 if(!occupationId||!db.occupations.some(o=>cleanId(o.id)===occupationId))throw new Error('Ocupação não encontrada ou não autorizada');
 const period=parseRange(params,clock);
 const competitorId=params.competitorId&&params.competitorId!=='all'?cleanId(params.competitorId):null;
 if(competitorId&&!db.competitors.some(c=>cleanId(c.id)===competitorId&&cleanId(c.occupationId)===occupationId))throw new Error('Competidor não pertence à ocupação ou não está autorizado');
 const areaId=params.areaId&&params.areaId!=='all'?cleanId(params.areaId):null;
 const wsosList=db.wsos.filter(x=>cleanId(x.occupationId)===occupationId);
 const areaList=db.occupationAreas.filter(x=>cleanId(x.occupationId)===occupationId);
 const compList=db.competencies.filter(x=>cleanId(x.occupationId)===occupationId);
 if(areaId&&!areaList.some(a=>cleanId(a.id)===areaId))throw new Error('Área não pertence à ocupação');
 const wsos=new Map(wsosList.map(x=>[cleanId(x.code),metric({id:x.id,code:x.code,name:x.name})]));
 const areas=new Map(areaList.map(x=>[cleanId(x.id),metric({id:x.id,name:x.name})]));
 const competencies=new Map(compList.map(x=>[cleanId(x.id),metric({id:x.id,name:x.name,category:x.category||'technical',areaIds:x.areaIds||[]})]));
 const exams=new Map(db.exams.map(e=>[cleanId(e.id),e]));
 const trends=new Map();let overallEarned=0,overallPossible=0,executionCount=0,ignored=0,aspectGrades=0;
 const finalized=db.executions.filter(e=>{
  const comp=db.competitors.find(c=>cleanId(c.id)===cleanId(e.competitorId));
  return comp&&cleanId(comp.occupationId)===occupationId&&(!competitorId||cleanId(comp.id)===competitorId)&&(!period.dateFrom||e.date>=period.dateFrom)&&e.date<=period.dateTo;
 });
 for(const execution of finalized){
  if(execution.status!=='finalized'||execution.mode!=='aspects'){ignored++;continue}
  const exam=execution.examSnapshot||exams.get(cleanId(execution.examId));if(!exam)continue;
  const byScore=new Map((execution.scores||[]).map(s=>[cleanId(s.id),s]));
  const date=String(execution.date||'');if(!dateStr(date))continue;
  let earned=0,possible=0,graded=0;
  const bucket=(period.range==='month'||period.range==='custom'&&period.dateFrom&&period.dateFrom.slice(0,7)===period.dateTo.slice(0,7))?date:date.slice(0,7);
  const areaBucket=trends.get(bucket)||new Map();trends.set(bucket,areaBucket);
  for(const sub of exam.subcriteria||[])for(const aspect of sub.aspects||[]){
   const item=byScore.get(cleanId(aspect.id));const max=Number(aspect.maxScore);
   if(!scoreValid(item,max))continue;
   const score=Number(item.score);earned+=score;possible+=max;graded++;
   const section=wsos.get(cleanId(aspect.wsosSection));if(section)add(section,score,max,execution.id);
   for(const id of unique(aspect.areaIds||[])){
    const area=areas.get(id);if(!area)continue;
    add(area,score,max,execution.id);
    if(!areaBucket.has(id))areaBucket.set(id,metric({id}));
    add(areaBucket.get(id),score,max,execution.id);
   }
   for(const id of linkedCompetencies(aspect)){
    const comp=competencies.get(id);if(comp)add(comp,score,max,execution.id);
   }
  }
  if(graded){executionCount++;overallEarned+=earned;overallPossible+=possible;aspectGrades+=graded}
 }
 const areaSeries=[...trends.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([bucket,values])=>({
  bucket,label:bucketLabel(bucket,period),areas:Object.fromEntries([...values.entries()].map(([id,m])=>[id,finish(m)]))
 }));
 const relevantCompetencies=[...competencies.values()].filter(c=>!areaId||(c.areaIds||[]).some(x=>cleanId(x)===areaId)).map(finish);
 const areaResult=[...areas.values()].map(finish);
 return {
  meta:{occupationId,competitorId,areaId,...period,finalizedExecutions:executionCount,excludedExecutions:ignored,aspectGrades},
  summary:{earned:round(overallEarned),possible:round(overallPossible),percentage:percentage(overallEarned,overallPossible),finalizedExecutions:executionCount,areasWithEvidence:areaResult.filter(a=>a.possible>0).length,areasTotal:areas.size,competenciesWithEvidence:relevantCompetencies.filter(c=>c.possible>0).length,competenciesTotal:relevantCompetencies.length},
  wsos:[...wsos.values()].map(finish),areas:areaResult,trend:areaSeries,competencies:relevantCompetencies
 };
}
module.exports={buildDashboardReport,parseRange};
