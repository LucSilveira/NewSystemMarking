import {findTitleClashes,normalizedTitle,recommendedType} from './cisExamCreation.js';

/** O lote apenas cria cadastros. Provas existentes só são alteradas pela importação individual. */
export function suggestBatchRegistrations(modules,db){
  const occupationId=db.occupations?.[0]?.id;
  const repeats=new Map();
  for(const item of modules){
    const key=normalizedTitle(item.title);
    repeats.set(key,(repeats.get(key)||0)+1);
  }
  return Object.fromEntries(modules.map(module=>{
    const title=repeats.get(normalizedTitle(module.title))>1
      ? `${module.module} — ${String(module.title||'').trim()}`:String(module.title||'').trim();
    const existing=findTitleClashes(db.exams,occupationId,title).length>0;
    return [module.module,{
      title,typeKey:recommendedType(module.module,db.examTypes),
      editionId:'',referenceCountry:'',enabled:!existing
    }];
  }));
}

export function batchTitleConflicts(modules,mapping,exams,occupationId){
  const conflict={};
  const selected=modules.filter(m=>mapping[m.module]?.enabled);
  const groups=new Map();
  for(const module of selected){
    const key=normalizedTitle(mapping[module.module]?.title);
    if(!key){conflict[module.module]='Informe o título desta prova.';continue;}
    if(findTitleClashes(exams,occupationId,mapping[module.module].title).length){
      conflict[module.module]='Já existe prova com este título nesta ocupação. Use a importação individual para atualizá-la.';
    }
    const matching=groups.get(key)||[];
    matching.push(module.module);
    groups.set(key,matching);
  }
  for(const group of groups.values())if(group.length>1){
    for(const code of group) conflict[code]=`Título repetido em ${group.join(' e ')}. Diferencie o título antes de cadastrar.`;
  }
  return conflict;
}

export function batchCreatedExam(module,choice,shared,options){
  const editionId=choice.editionId||shared.editionId||'';
  const referenceCountry=String(choice.referenceCountry||shared.referenceCountry||'').trim();
  return {
    ...options.createExamFromCis({...module,title:String(choice.title||'').trim()}, {
      occupationId:options.occupationId,typeKey:choice.typeKey,editionId,
      id:options.id,date:options.date,subcriteria:options.importSubcriteria(module)
    }),
    referenceCountry
  };
}
