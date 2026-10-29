/**
 * Parser da folha "CIS Marking Scheme Import".
 * Recebe as linhas já lidas do XLSX (read-excel-file), preservando índices A=0, ..., L=11.
 * Não acessa servidor nem armazena o arquivo de origem.
 */
const cell = (row, column) => row?.[column] ?? null;
const asText = value => value == null ? '' : String(value).trim();
const normal = value => asText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[·•]/g,' ').replace(/\s+/g,' ').toLowerCase().trim();
const asNumber = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() && /^-?\d+(?:[,.]\d+)?$/.test(value.trim())) {
    const v=Number(value.trim().replace(',','.'));
    return Number.isFinite(v) ? v : null;
  }
  return null;
};
const sumPoints = aspects => Math.round(aspects.reduce((t,a)=>t+(a.maxScore||0),0)*1000000)/1000000;
const IS_SUBCRITERION_HEADER = /^(?:sub\s*criterion\s*id|id)$/;
const BLOCK_LABEL = /^(?:criterion|criterio)\s+([a-i])$/;

export function parseCisRows(rows) {
  if (!Array.isArray(rows)) throw new Error('A planilha não contém linhas válidas.');
  const titles = new Map();
  for (const row of rows) {
    const letter=asText(cell(row,0)).toUpperCase();
    if (/^[A-I]$/.test(letter) && asText(cell(row,1))) {
      titles.set(letter,{title:asText(cell(row,1)),listedMaxScore:asNumber(cell(row,10))});
    }
  }

  const modules=[];
  const issues=[];
  let current=null, sub=null, lastAspect=null, seenHeaders=0;
  function finish() {
    if (!current) return;
    current.subcriteria=current.subcriteria.filter(s=>s.aspects.length);
    current.aspectCount=current.subcriteria.reduce((n,s)=>n+s.aspects.length,0);
    current.measurementCount=current.subcriteria.reduce((n,s)=>n+s.aspects.filter(a=>a.method==='M').length,0);
    current.judgementCount=current.aspectCount-current.measurementCount;
    current.totalScore=sumPoints(current.subcriteria.flatMap(s=>s.aspects));
    if (current.aspectCount) {
      if (current.expectedScore!==null && Math.abs(current.expectedScore-current.totalScore)>0.000001) {
        current.warnings.push(`A soma dos aspectos (${current.totalScore}) não corresponde à pontuação prevista (${current.expectedScore}).`);
      }
      for (const s of current.subcriteria) for (const a of s.aspects) {
        if (!a.description) current.warnings.push(`Linha ${a.sourceRow}: aspecto sem descrição.`);
        if (a.maxScore===null) current.warnings.push(`Linha ${a.sourceRow}: pontuação máxima ausente ou inválida.`);
        if (!a.wsosSection) current.warnings.push(`Linha ${a.sourceRow}: WSOS ausente.`);
        if (a.method==='J' && Object.values(a.judgement).some(v=>!v)) current.warnings.push(`Linha ${a.sourceRow}: julgamento incompleto (níveis 0–3).`);
      }
      modules.push(current);
    }
    current=null;sub=null;lastAspect=null;
  }

  rows.forEach((row,index)=>{
    const line=index+1;
    const columnA=normal(cell(row,0));
    const columnL=normal(cell(row,11));
    const block=columnL.match(BLOCK_LABEL);
    if (block && IS_SUBCRITERION_HEADER.test(columnA)) {
      finish();seenHeaders++;
      const criterion=block[1].toUpperCase(), meta=titles.get(criterion);
      current={criterion,module:`M${criterion}`,title:meta?.title||`Critério ${criterion}`,
        expectedScore:meta?.listedMaxScore??null,headerRow:line,subcriteria:[],warnings:[]};
      return;
    }
    if (!current) return;

    const rawCode=asText(cell(row,0)).toUpperCase();
    if (new RegExp(`^${current.criterion}\\d+$`).test(rawCode)) {
      sub={code:rawCode,title:asText(cell(row,1)),dayOfMarking:asText(cell(row,2)),sourceRow:line,aspects:[]};
      current.subcriteria.push(sub);lastAspect=null;return;
    }

    const method=asText(cell(row,3)).toUpperCase();
    if (method==='M'||method==='J') {
      if (!sub) {current.warnings.push(`Linha ${line}: aspecto ${method} sem subcritério.`);return;}
      const maxScore=asNumber(cell(row,10));
      const wsosRaw=asNumber(cell(row,8)) ?? asText(cell(row,8));
      const aspect={sourceRow:line,description:asText(cell(row,4)),method,
        considerations:asText(cell(row,6)),measurementRequirement:method==='M'?cell(row,7):null,
        wsosSection:wsosRaw==null?'':String(wsosRaw),maxScore,
        judgement:method==='J'?{'0':'','1':'','2':'','3':''}:null};
      sub.aspects.push(aspect);
      lastAspect=aspect;
      return;
    }

    const level=asNumber(cell(row,5)), descriptor=asText(cell(row,6));
    if (method==='' && level!==null && Number.isInteger(level) && level>=0 && level<=3 && descriptor) {
      if (lastAspect?.method==='J') {
        if (lastAspect.judgement[level]) current.warnings.push(`Linha ${line}: descritor ${level} repetido.`);
        lastAspect.judgement[level]=descriptor;
      } else {
        current.warnings.push(`Linha ${line}: descritor de Judgement sem aspecto J anterior.`);
      }
    }
  });
  finish();
  if (!seenHeaders) throw new Error('Nenhum bloco CIS encontrado. Esperado: coluna A com "Sub Criterion ID" e coluna L com "Criterion A" etc.');
  if (!modules.length) throw new Error('Foram encontrados cabeçalhos, mas nenhum módulo com aspectos M/J válidos.');
  return {modules,issues,headerCount:seenHeaders};
}

export function importSubcriteria(module, generateId=()=>crypto.randomUUID()) {
  return module.subcriteria.map(sub=>({
    id:generateId(),code:sub.code,title:sub.title,dayOfMarking:sub.dayOfMarking,
    cisSourceRow:sub.sourceRow,
    aspects:sub.aspects.map(a=>({
      id:generateId(),description:a.description,method:a.method,maxScore:a.maxScore,
      wsosSection:a.wsosSection,considerations:a.considerations,
      ...(a.method==='J'?{judgement:{...a.judgement}}:{}),
      ...(a.method==='M'&&a.measurementRequirement!==null?{measurementRequirement:a.measurementRequirement}:{}),
      cisSourceRow:a.sourceRow,areaIds:[],competencyIds:[]
    }))
  }));
}

/** Reimportações conservam mapeamentos técnicos e IDs dos aspectos correspondentes. */
export function preserveAspectRelations(existing, imported) {
  const oldSubs=existing?.subcriteria||[];
  const asKey=a=>normal(a.description)+'|'+asText(a.method).toUpperCase();
  return imported.map(sub=>{
    const old=oldSubs.find(s=>asText(s.code).toUpperCase()===sub.code.toUpperCase());
    if (!old)return sub;
    const available=new Map();
    for (const aspect of old.aspects||[]) {
      const key=asKey(aspect), group=available.get(key)||[];
      group.push(aspect);available.set(key,group);
    }
    return {...sub,id:old.id,aspects:sub.aspects.map(a=>{
      const matches=available.get(asKey(a))||[],prev=matches.shift();
      if (!prev)return a;
      return {...a,id:prev.id,areaIds:Array.isArray(prev.areaIds)?prev.areaIds:[],
        competencyIds:[...new Set([...(prev.competencyIds||[]),...(prev.competencyLinks||[]).map(x=>x.competencyId)].filter(Boolean))]};
    })};
  });
}
