'use strict';
const dateStr=(v)=> typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).valueOf()) && new Date(`${v}T12:00:00Z`).toISOString().slice(0,10)===v;
const finite=(v)=>typeof v==='number' && Number.isFinite(v);
const round=(n)=>Math.round((n+Number.EPSILON)*1e6)/1e6;
const matches=(ref,arr)=>arr.some(x=>String(x.id)===String(ref));
function examAspects(exam){return (exam.subcriteria||[]).flatMap(s=>(s.aspects||[]).map(a=>({...a,subcriterionId:s.id,subcriterionCode:s.code})));}
function distinct(arr){return new Set(arr.map(String)).size===arr.length;}
function examValidation(exam,refs,{currentId}={}){const issues=[];
 // Evita importar um CIS como nova prova se já existir o mesmo título na ocupação.
 // Não altera regras de provas legadas, adaptações ou edições manuais.
 if(!currentId&&exam.cisImportedAt){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');
  const duplicated=(refs.exams||[]).some(existing=>existing.occupationId===exam.occupationId&&norm(existing.title)===norm(exam.title));
  if(duplicated)issues.push('Já existe uma prova com este título nesta ocupação; selecione a prova existente para importar o CIS');
 }
 if(!String(exam.title||'').trim())issues.push('Título da prova obrigatório');
 if(exam.editionId && !matches(exam.editionId,refs.editions))issues.push('Edição inexistente');
 const edition=refs.editions.find(e=>e.id===exam.editionId);if(edition?.occupationId && exam.occupationId!==edition.occupationId)issues.push('A edição da prova pertence a outra ocupação');
 if(!refs.occupations.some(o=>String(o.id)===String(exam.occupationId)))issues.push('Ocupação da prova inválida');
 if(!refs.examTypes.some(x=>x.key===exam.typeKey&&(!x.occupationId||x.occupationId===exam.occupationId)))issues.push('Tipo de prova inválido para esta ocupação');
 if(!finite(exam.maxScore)||exam.maxScore<0)issues.push('Pontuação máxima inválida');
 if(exam.documentUrl && !/^https?:\/\//i.test(exam.documentUrl))issues.push('URL do documento inválida');
 if(exam.sourceExamId && (!matches(exam.sourceExamId,refs.exams)||exam.sourceExamId===exam.id))issues.push('Prova de origem inválida');
 const arrOk=(a)=>Array.isArray(a)&&a.every(id=>typeof id==='string'&&id.trim())&&distinct(a);
 const allAreas=refs.occupationAreas||[];
 const examAreas=exam.areaIds||[],examComps=exam.competencyIds||[];
 if(!arrOk(examAreas))issues.push('Áreas da prova devem ser IDs únicos');
 if(!arrOk(examComps))issues.push('Competências da prova devem ser IDs únicos');
 for(const id of examAreas){const a=allAreas.find(x=>String(x.id)===String(id));if(!a || String(a.occupationId)!==String(exam.occupationId))issues.push(`Área da prova inválida: ${id}`);}
 for(const id of examComps){const c=refs.competencies.find(x=>String(x.id)===String(id));if(!c || (c.occupationId&&String(c.occupationId)!==String(exam.occupationId)))issues.push(`Competência da prova inválida: ${id}`);}
 const ids=new Set(), subIds=new Set();
 for(const sub of exam.subcriteria||[]){
  if(subIds.has(String(sub.id)))issues.push('ID de subcritério duplicado');subIds.add(String(sub.id));
  for(const a of sub.aspects||[]){
   if(!String(a.description||'').trim())issues.push('Aspecto sem descrição');
   if(!['M','J'].includes(a.method))issues.push('Método de aspecto inválido');
   if(!finite(a.maxScore)||a.maxScore<0)issues.push('Pontuação de aspecto inválida');
   const ws=refs.wsos.find(w=>String(w.code)===String(a.wsosSection)&&(!w.occupationId||String(w.occupationId)===String(exam.occupationId)));
   if(a.wsosSection && (!ws || (ws.occupationId&&String(ws.occupationId)!==String(exam.occupationId))))issues.push('Seção WSOS desconhecida ou de outra ocupação');
   if(ids.has(String(a.id)))issues.push('ID de aspecto duplicado');ids.add(String(a.id));
   if(!arrOk(a.areaIds||[]))issues.push(`Áreas duplicadas ou inválidas no aspecto ${a.id}`);
   for(const id of a.areaIds||[])if(!examAreas.includes(id))issues.push(`Aspecto ${a.id}: área fora da lista da prova (${id})`);
   // Novo cadastro: competências equivalentes. O formato legado com roles
   // permanece legível, sem exigir competência principal.
   const links=a.competencyLinks||[];
   if(!Array.isArray(links))issues.push(`Aspecto ${a.id}: vínculos de competências legados inválidos`);
   const legacyIds=Array.isArray(links)?links.map(l=>l?.competencyId):[];
   if(Array.isArray(links)&&!distinct(legacyIds))issues.push(`Aspecto ${a.id}: competências legadas repetidas`);
   const competencyIds=Array.isArray(a.competencyIds)?a.competencyIds:[];
   if(!arrOk(a.competencyIds||[]))issues.push(`Aspecto ${a.id}: competências repetidas ou inválidas`);
   for(const id of new Set([...competencyIds,...legacyIds])){
    if(typeof id!=='string'||!examComps.includes(id))issues.push(`Aspecto ${a.id}: competência fora da lista da prova (${id})`);
   }

  }
 }
 return [...new Set(issues)];
}
function executionChangeLocked(existing,candidate){
 if(existing?.status!=='finalized')return false;
 const fields=['scores','mode','notes','date','activityId','examId','competitorId'];
 return fields.some(key=>JSON.stringify(existing[key]??null)!==JSON.stringify(candidate[key]??null));
}
function computeExecution(execution,exam){if(!exam)throw new Error('Prova não encontrada');const mode=execution.mode||'overall';const max=Number(exam.maxScore);
 const raw=Array.isArray(execution.scores)?execution.scores:[];
 let earned=null,coverage=0,breakdown=[]; const itemsByMode={
 overall:[{id:'overall',maxScore:max,wsosSection:null}],
 wsos:(()=>{const aspects=examAspects(exam);if(!aspects.length) return [];
 const groups=new Map();for(const a of aspects){if(a.wsosSection){const id=String(a.wsosSection);groups.set(id,round((groups.get(id)||0)+Number(a.maxScore||0)))}}
 return [...groups].map(([id,maxScore])=>({id,maxScore,wsosSection:id}));})(),
 subcriteria:(exam.subcriteria||[]).map(s=>({id:s.id,maxScore:round((s.aspects||[]).reduce((sum,a)=>sum+Number(a.maxScore||0),0)),wsosSection:null})),
 aspects:examAspects(exam).map(a=>({id:a.id,maxScore:Number(a.maxScore),method:a.method,wsosSection:a.wsosSection||null}))
 };
 if(!Object.hasOwn(itemsByMode,mode))throw new Error('Modo de lançamento inválido');
 const items=itemsByMode[mode];if(mode!=='overall'&&!items.length)throw new Error('Não há critérios cadastrados para esse modo');
 const ids=new Set();let total=0;for(const s of raw){if(ids.has(s.id))throw new Error('Nota repetida');ids.add(s.id);
 const item=items.find(x=>x.id===s.id);if(!item)throw new Error('Aspecto/área/subcritério desconhecido: '+s.id);
 let score=s.score;
 if(mode==='aspects'){
  if(s.source!=null&&!['manual','xlsx'].includes(s.source))throw new Error('Origem de pontuação inválida: '+s.id);
  if(s.achieved!=null&&item.method!=='M')throw new Error('Indicador de medição em aspecto Judgement: '+s.id);
  if(s.achieved!=null&&typeof s.achieved!=='boolean')throw new Error('Indicador de medição inválido: '+s.id);
  if(item.method==='J'&&s.votes!=null){
   if(!Array.isArray(s.votes)||s.votes.length!==3||!s.votes.every(v=>Number.isInteger(v)&&v>=0&&v<=3))throw new Error('Julgamento exige três votos inteiros de 0 a 3: '+s.id);
   score=round(item.maxScore*s.votes.reduce((n,v)=>n+v,0)/9);
  } else if(item.method==='J'&&s.judgementLevel!=null){
   if(![0,1,2,3].includes(Number(s.judgementLevel)))throw new Error('Julgamento deve ser de 0 a 3');
   score=round(item.maxScore*Number(s.judgementLevel)/3);
  }
  if(item.method==='M'&&s.achieved===false&&score!==0)throw new Error('Medição não atingida deve valer zero: '+s.id);
 }
 if(!finite(score)||score<0||score>item.maxScore+0.000001)throw new Error('Pontuação fora do limite: '+s.id);
 total+=score;breakdown.push({id:s.id,score:round(score),maxScore:item.maxScore,wsosSection:item.wsosSection,
  ...(s.judgementLevel!=null&&item.method==='J'&&s.votes==null?{judgementLevel:Number(s.judgementLevel)}:{}),
  ...(mode==='aspects'?{
   ...(s.achieved!=null?{achieved:s.achieved}:{}),
   ...(s.votes!=null?{votes:[...s.votes]}:{}),
   ...(s.source?{source:s.source}:{}),
   ...(typeof s.note==='string'&&s.note.trim()?{note:s.note.trim().slice(0,500)}:{})
  }: {})});
 }
 if(mode==='overall'&&!breakdown.length&&finite(execution.overallScore)){
 if(execution.overallScore<0||execution.overallScore>max)throw new Error('Nota geral fora do limite');
 breakdown=[{id:'overall',score:execution.overallScore,maxScore:max,wsosSection:null}];total=execution.overallScore;
 }
 coverage=items.length?round(breakdown.length/items.length*100):0;
 // A complete detailed correction must also cover all original points.
 const coveredMax=items.reduce((sum,item)=>sum+item.maxScore,0);
 const structureComplete=mode==='overall'||Math.abs(coveredMax-max)<0.000001;
 earned=breakdown.length===items.length&&items.length&&structureComplete?round(total):null;
 const wsos=[];
 if(mode==='wsos'||mode==='aspects'){
 const map=new Map();for(const s of breakdown){if(!s.wsosSection)continue;const x=map.get(String(s.wsosSection))||{wsosSection:String(s.wsosSection),earned:0,maxScore:0,count:0};x.earned=round(x.earned+s.score);x.maxScore=round(x.maxScore+s.maxScore);x.count++;map.set(String(s.wsosSection),x)}
 for(const v of map.values()) wsos.push({...v,percentage:v.maxScore?round(v.earned/v.maxScore*100):0,partial:coverage<100});
 }
 const complete=coverage===100&&structureComplete;
 const status=execution.status||'draft';
 if(!['draft','finalized'].includes(status))throw new Error('Situação da correção inválida');
 if(status==='finalized'&&!complete)throw new Error('Finalize somente quando todos os aspectos estiverem avaliados e a pontuação do CIS estiver conciliada');
 return {mode,scores:breakdown,overallScore:earned,maxScore:max,coverage,complete,status,wsosResults:wsos,percentage:earned!=null&&max?round(earned/max*100):null};
}
function validatePayload(resource,value,refs,{currentId}={}){const errors=[];const req=(key)=>{if(!String(value[key]||'').trim())errors.push(`${key} obrigatório`)};
 if(resource==='exams')return examValidation(value,refs,{currentId});
 if(resource==='competitors'){req('name');if(!matches(value.occupationId,refs.occupations))errors.push('Modalidade inválida')}
 if(resource==='evaluators'){req('name');if(!Array.isArray(value.occupationIds)||value.occupationIds.length===0||!distinct(value.occupationIds)||value.occupationIds.some(id=>!matches(id,refs.occupations)))errors.push('Informe uma ou mais ocupações válidas para o avaliador')}
 if(resource==='teams'){req('name');if(!matches(value.occupationId,refs.occupations))errors.push('Ocupação da equipe inválida');if(!Array.isArray(value.competitorIds)||value.competitorIds.length<2||!distinct(value.competitorIds))errors.push('Equipe precisa de ao menos dois competidores distintos');else for(const id of value.competitorIds){const person=refs.competitors.find(c=>c.id===id);if(!person||person.occupationId!==value.occupationId)errors.push('Competidor de outra ocupação na equipe: '+id)}}
 if(resource==='occupations'){req('name');req('code')}
 if(resource==='wsos'){req('name');req('code');if(!matches(value.occupationId,refs.occupations))errors.push('Modalidade inválida')}
 if(resource==='examTypes'){req('name');req('key');if(value.occupationId&&!matches(value.occupationId,refs.occupations))errors.push('Ocupação do tipo de prova inválida');if(refs.examTypes.some(x=>x.key===value.key&&x.id!==currentId&&x.occupationId===value.occupationId))errors.push('Tipo de prova duplicado para a ocupação')}
 if(resource==='editions'){req('name');req('phase');if(value.occupationId&&!matches(value.occupationId,refs.occupations))errors.push('Ocupação da edição inválida');if(!Number.isInteger(Number(value.year))||Number(value.year)<2000)errors.push('Ano inválido')}
 if(resource==='occupationAreas'){req('name');if(!matches(value.occupationId,refs.occupations))errors.push('Ocupação da área inexistente')}
 if(resource==='competencies'){req('name');if(value.occupationId&&!matches(value.occupationId,refs.occupations))errors.push('Ocupação da competência inválida');if(value.wsosId&&!refs.wsos.some(w=>w.id===value.wsosId&&(!w.occupationId||w.occupationId===value.occupationId)))errors.push('WSOS de referência inexistente ou de outra ocupação');if(!Array.isArray(value.areaIds||[])||!distinct(value.areaIds||[]))errors.push('Áreas da competência inválidas');for(const id of value.areaIds||[]){const a=(refs.occupationAreas||[]).find(a=>a.id===id);if(!a||(value.occupationId&&a.occupationId!==value.occupationId))errors.push(`Área não pertence à ocupação da competência: ${id}`)}}
 if(resource==='executions'){if(!matches(value.examId,refs.exams))errors.push('Prova não cadastrada');if(!matches(value.competitorId,refs.competitors))errors.push('Competidor não cadastrado');const exam=refs.exams.find(x=>x.id===value.examId),competitor=refs.competitors.find(x=>x.id===value.competitorId);if(exam&&competitor&&exam.occupationId!==competitor.occupationId)errors.push('Prova e competidor pertencem a ocupações diferentes');if(!dateStr(value.date))errors.push('Data inválida');if(value.activityId&&!matches(value.activityId,refs.activities))errors.push('Atividade inexistente')}
 if(resource==='technicalAssessments'){const person=refs.competitors.find(x=>x.id===value.competitorId),competence=refs.competencies.find(x=>x.id===value.competencyId);if(person&&competence&&person.occupationId!==competence.occupationId)errors.push('Competência de outra ocupação');if(!matches(value.competitorId,refs.competitors))errors.push('Competidor inexistente');if(!matches(value.competencyId,refs.competencies))errors.push('Competência inexistente');if(!dateStr(value.date))errors.push('Data inválida');if(![1,2,3,4].includes(Number(value.level)))errors.push('Nível técnico deve ser de 1 a 4');if(value.activityId&&!matches(value.activityId,refs.activities))errors.push('Atividade inexistente')}
 if(resource==='activities'){
 req('title');req('type');if(!dateStr(value.date))errors.push('Data inválida');
 if(value.startTime&& !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime))errors.push('Hora de início inválida');
 if(value.endTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.endTime))errors.push('Hora de término inválida');
 if(value.startTime&&value.endTime&&value.endTime<=value.startTime)errors.push('Término precisa ser após o início');
 if(value.competitorId&&!matches(value.competitorId,refs.competitors))errors.push('Competidor inexistente');
 if(value.examId&&!matches(value.examId,refs.exams))errors.push('Prova inexistente');
 if(value.occupationId&&!matches(value.occupationId,refs.occupations))errors.push('Ocupação da atividade inválida');
 const actExam=refs.exams.find(x=>x.id===value.examId),actPerson=refs.competitors.find(x=>x.id===value.competitorId);
 if(actExam&&actPerson&&actExam.occupationId!==actPerson.occupationId)errors.push('Prova e competidor de ocupações diferentes na atividade');
 for(const ref of [actExam,actPerson])if(value.occupationId&&ref&&ref.occupationId!==value.occupationId)errors.push('Atividade associada a outra ocupação');
 if(value.targetPercentage!=null&&(!finite(value.targetPercentage)||value.targetPercentage<0||value.targetPercentage>100))errors.push('Meta deve ser de 0 a 100%');
 if(dateStr(value.date)){const today=new Date();const limit=new Date(today.getFullYear(),today.getMonth()+4,0); if(value.date>`${limit.getFullYear()}-${String(limit.getMonth()+1).padStart(2,'0')}-${String(limit.getDate()).padStart(2,'0')}`)errors.push('Planejamento permitido apenas no mês atual e próximos três meses')}
 }
 return errors;
}
module.exports={dateStr,round,examAspects,examValidation,computeExecution,validatePayload,executionChangeLocked};
