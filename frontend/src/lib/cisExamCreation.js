/** Planejamento de criação de provas a partir de um módulo CIS.
 * A chave de unicidade solicitada é título + ocupação, não apenas módulo.
 */
export const CREATE_NEW_EXAM='__create__';

export const normalizedTitle=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');

export function findTitleClashes(exams,occupationId,title){
  const key=normalizedTitle(title);
  return (exams||[]).filter(e=>e.occupationId===occupationId&&normalizedTitle(e.title)===key);
}

export function recommendedType(module,examTypes){
  const candidates={MA:'speed-test',MB:'frontend',MC:'backend',MD:'frontend',ME:'backend',MF:'design-implementation',MG:'team-challenge'};
  const types=examTypes||[];
  const desired=candidates[String(module||'').toUpperCase()];
  if(desired&&types.some(t=>t.key===desired))return desired;
  return types.length===1?types[0].key:'';
}

export function suggestCisMappings(modules,db){
  const occupationId=db.occupations[0]?.id;
  return Object.fromEntries(modules.map(m=>{
    const clashes=findTitleClashes(db.exams,occupationId,m.title);
    const exact=clashes.find(e=>String(e.module||'').toUpperCase()===m.module)||clashes[0];
    return [m.module,{
      mode:clashes.length?'existing':'create',
      examId:clashes.length===1?exact?.id||'':'',
      enabled:clashes.length===1 && !(exact?.subcriteria||[]).some(s=>(s.aspects||[]).length),
      replace:false,updateScore:false,
      typeKey:recommendedType(m.module,db.examTypes),
      editionId:''
    }];
  }));
}

export function createExamFromCis(module,{occupationId,typeKey,editionId='',id,date,subcriteria}){
  if(!occupationId)throw new Error('Ocupação da prova não está definida.');
  if(!typeKey)throw new Error('Selecione um tipo de prova antes de criar o cadastro.');
  if(!normalizedTitle(module.title))throw new Error('O CIS não informa um título válido.');
  return {
    id,title:module.title.trim(),module:module.module,
    occupationId,typeKey,editionId,maxScore:module.totalScore,
    description:'',referenceCountry:'',technicalDetails:'',technicalChallenges:[],
    areaIds:[],competencyIds:[],documentUrl:'',subcriteria,
    sourceExamId:null,version:1,cisImportedAt:date,
  };
}

export function missingWsosSections(module,wsos){
  const used=new Set(module.subcriteria.flatMap(s=>s.aspects.map(a=>String(a.wsosSection||'').trim())).filter(Boolean));
  const known=new Set((wsos||[]).map(w=>String(w.code).trim()));
  return [...used].filter(x=>!known.has(x));
}
