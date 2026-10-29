// Lógica pura: a página só escolhe quais filtros ficam ativos.
// Um aspecto CIS pode receber áreas via Análise Técnica mesmo quando não
// estão explicitamente presentes no campo areaIds da prova.
const arr = value => Array.isArray(value) ? value : [];
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();

export function examAreaIds(exam) {
  const related = arr(exam?.subcriteria).flatMap(sub =>
    arr(sub?.aspects).flatMap(aspect => arr(aspect?.areaIds))
  );
  return [...new Set([...arr(exam?.areaIds), ...related].filter(Boolean))];
}

export function catalogOptions(exams, examTypes = [], occupationAreas = []) {
  const availableExams=arr(exams);
  const usedTypeKeys=new Set(availableExams.map(exam => exam.typeKey).filter(Boolean));
  const typeKeys=new Set(arr(examTypes).map(type => type.key));
  const types=[...arr(examTypes).filter(type => type.key)];
  for (const key of usedTypeKeys) if (!typeKeys.has(key)) types.push({key,name:key});

  const usedAreaIds=new Set(availableExams.flatMap(examAreaIds));
  const knownAreaIds=new Set(arr(occupationAreas).map(area => area.id));
  const areas=[...arr(occupationAreas).filter(area => area.id)];
  for (const id of usedAreaIds) if (!knownAreaIds.has(id)) areas.push({id,name:'Área não cadastrada'});

  const modules=[...new Set(availableExams.map(e => String(e.module||'').trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,'pt-BR',{numeric:true}));
  const countries=[...new Set(availableExams.map(e => String(e.referenceCountry||'').trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,'pt-BR'));
  return {types,areas,modules,countries};
}

export function filterExamCatalog(exams, filters = {}, refs = {}) {
  const search=normalize(filters.search);
  const areaIds=arr(filters.areaIds);
  const typeKey=filters.typeKey||'all';
  const module=filters.module||'all';
  const editionId=filters.editionId||'all';
  const country=filters.country||'all';
  const origin=filters.origin||'all';
  const typeNames=new Map(arr(refs.examTypes).map(type => [type.key,type.name]));
  const editionNames=new Map(arr(refs.editions).map(edition => [edition.id,edition.name]));
  const areaNames=new Map(arr(refs.occupationAreas).map(area => [area.id,area.name]));

  return arr(exams).filter(exam => {
    if (typeKey!=='all' && exam.typeKey!==typeKey) return false;
    if (areaIds.length && !areaIds.some(id => examAreaIds(exam).includes(id))) return false;
    if (module!=='all' && exam.module!==module) return false;
    if (editionId!=='all' && exam.editionId!==editionId) return false;
    if (country!=='all' && normalize(exam.referenceCountry)!==normalize(country)) return false;
    if (origin==='original' && exam.sourceExamId) return false;
    if (origin==='adapted' && !exam.sourceExamId) return false;
    if (!search) return true;
    const searchable=[
      exam.title,exam.module,exam.description,exam.referenceCountry,
      typeNames.get(exam.typeKey)||exam.typeKey,editionNames.get(exam.editionId)||'',
      ...examAreaIds(exam).map(id=>areaNames.get(id)||'')
    ].map(normalize).join(' ');
    return searchable.includes(search);
  });
}

export function activeExamFilterCount(filters = {}) {
  return Number(Boolean(String(filters.search||'').trim()))
    +Number(Boolean(filters.typeKey && filters.typeKey!=='all'))
    +arr(filters.areaIds).length
    +Number(Boolean(filters.module && filters.module!=='all'))
    +Number(Boolean(filters.editionId && filters.editionId!=='all'))
    +Number(Boolean(filters.country && filters.country!=='all'))
    +Number(Boolean(filters.origin && filters.origin!=='all'));
}
