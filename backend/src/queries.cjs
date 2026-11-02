'use strict';
/** Paginação e filtros aplicados depois do escopo de autorização.
 * Apenas colunas permitidas podem ser filtradas/ordenadas.
 */
const {RESOURCES}=require('./data.cjs');
const SEARCH_FIELDS={
 occupations:['name','code','description'],
 occupationAreas:['name','description'],wsos:['name','code'],
 examTypes:['name','key'],editions:['name','phase','year'],
 competitors:['name'],evaluators:['name','email'],
 competencies:['name','description','category'],
 exams:['title','module','country','description'],
 executions:['date','status'],technicalAssessments:['date','notes'],
 activities:['title','type','notes'],teams:['name']
};
const FILTER_FIELDS=new Set(['occupationId','examId','competitorId','editionId','typeKey','status','category','module','phase','date','activityId','referenceCountry','areaId','competencyId','dateFrom','dateTo']);
const SORT_FIELDS=new Set(['date','createdAt','updatedAt','title','name','code','module','year','status','maxScore']);
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const naturalSort=(a,b)=>String(a??'').localeCompare(String(b??''),'pt-BR',{numeric:true});
const linkedIds=(row,key)=>new Set([...(Array.isArray(row[key])?row[key]:[]),...(row.subcriteria||[]).flatMap(sub=>(sub.aspects||[]).flatMap(a=>Array.isArray(a[key])?a[key]:[]))]);
// Busca relacional aplicada no servidor: rótulos de edição, tipo, áreas,
// prova e competidor, além dos campos armazenados na própria coleção.
function searchIndex(db){
 return {
  editions:new Map(db.editions.map(e=>[String(e.id),e.name])),
  types:new Map(db.examTypes.map(t=>[`${t.occupationId||''}:${t.key}`,t.name])),
  areas:new Map(db.occupationAreas.map(a=>[String(a.id),a.name])),
  exams:new Map(db.exams.map(e=>[String(e.id),e])),
  competitors:new Map(db.competitors.map(c=>[String(c.id),c.name]))
 };
}
function searchableText(resource,row,index){
 const values=SEARCH_FIELDS[resource].map(field=>row[field]);
 if(resource==='exams'){
  values.push(index.editions.get(String(row.editionId)));
  values.push(index.types.get(`${row.occupationId||''}:${row.typeKey}`)||index.types.get(`:${row.typeKey}`));
  for(const id of linkedIds(row,'areaIds'))values.push(index.areas.get(String(id)));
 }
 if(resource==='executions'){
  const exam=index.exams.get(String(row.examId))||row.examSnapshot;
  values.push(exam?.title,exam?.module,index.competitors.get(String(row.competitorId)));
  values.push(index.editions.get(String(exam?.editionId)));
 }
 if(resource==='competencies')for(const id of row.areaIds||[])values.push(index.areas.get(String(id)));
 return normalize(values.join(' '));
}
// Lista leve opcional: detalhes completos continuam em GET /api/:resource/:id.
function summaryRow(resource,row,db){
 if(resource==='exams')return {
  id:row.id,occupationId:row.occupationId,title:row.title,module:row.module,
  editionId:row.editionId,typeKey:row.typeKey,referenceCountry:row.referenceCountry,
  maxScore:row.maxScore,sourceExamId:row.sourceExamId,version:row.version,
  updatedAt:row.updatedAt,aspectCount:(row.subcriteria||[]).reduce((n,s)=>n+(s.aspects||[]).length,0)
 };
 if(resource==='executions')return {
  id:row.id,occupationId:db.competitors.find(c=>c.id===row.competitorId)?.occupationId,
  examId:row.examId,competitorId:row.competitorId,date:row.date,status:row.status,
  overallScore:row.overallScore,maxScore:row.maxScore,percentage:row.percentage,
  coverage:row.coverage,complete:row.complete,updatedAt:row.updatedAt
 };
 return row;
}

const numberParam=(raw,def,max)=>raw==null?def:Math.min(max,Math.max(1,Number.isSafeInteger(Number(raw))?Number(raw):def));
function matchesOccupation(resource,row,db,id){
 if(!id)return true;
 if(resource==='occupations')return row.id===id;
 if(resource==='evaluators')return (row.occupationIds||[]).includes(id);
 const relation=row.occupationId||
  db.competitors?.find(c=>c.id===row.competitorId)?.occupationId||
  db.exams?.find(e=>e.id===row.examId)?.occupationId;
 return relation===id;
}
function queryCollection(resource,db,user,params,visible){
 if(!RESOURCES.includes(resource))throw new Error('Coleção não encontrada');
 const filters=Object.fromEntries(Object.entries(params||{}).filter(([key])=>FILTER_FIELDS.has(key)));
 const page=numberParam(params.page,1,1000000),pageSize=numberParam(params.pageSize,25,100);
 const sortBy=SORT_FIELDS.has(params.sortBy)?params.sortBy:resource==='executions'?'date':'name';
 const direction=params.sortDirection==='asc'?1:-1;
 const term=normalize(params.search||'').trim().slice(0,100);
 const index=term?searchIndex(db):null;
 let rows=db[resource].filter(row=>visible(user,resource,row,db));
 rows=rows.filter(row=>{
  if(!matchesOccupation(resource,row,db,filters.occupationId))return false;
  for(const [key,value] of Object.entries(filters)){
   if(key==='occupationId')continue;
   if(key==='dateFrom'){if(!row.date||row.date<value)return false;continue}
   if(key==='dateTo'){if(!row.date||row.date>value)return false;continue}
   if(key==='areaId'||key==='competencyId'){if(!linkedIds(row,key==='areaId'?'areaIds':'competencyIds').has(value))return false;continue}
   if(value!==''&&value!=null&&String(row[key]??'')!==String(value))return false;
  }
  return !term||searchableText(resource,row,index).includes(term);
 });
 rows.sort((a,b)=>direction*naturalSort(a[sortBy],b[sortBy]));
 const total=rows.length;
 const slice=rows.slice((page-1)*pageSize,page*pageSize);
 return {items:params.view==='summary'?slice.map(r=>summaryRow(resource,r,db)):slice,page,pageSize,total,pages:Math.ceil(total/pageSize)};
}
module.exports={queryCollection};
