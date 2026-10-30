import {parseCisRows} from './cisParser.js';

const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const number=v=>{
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  if(typeof v==='string'&&/^\s*\d+(?:[.,]\d+)?\s*$/.test(v))return Number(v.trim().replace(',','.'));
  return null;
};
const round=v=>Math.round((v+Number.EPSILON)*1e6)/1e6;
export const moduleCode=exam=>String(exam?.module||'').toUpperCase().trim();
export function moduleFromCis(parsed,exam){return parsed.modules.find(m=>m.module===moduleCode(exam))||null;}
export function xlsxScoreRows(rows){return parseCisRows(rows);}

/** A posição da célula isoladamente não identifica um aspecto.
 * Concilia método, descrição e subcritério antes de usar a nota em L.
 * Fonte (sourceRow) só é atalho se a identidade textual também coincidir.
 */
export function previewCisScores(rows,parsedModule,exam){
  const extracted=[];const warnings=[];const used=new Set();
  const candidates=[];
  for(const sub of parsedModule.subcriteria)for(const a of sub.aspects){
    candidates.push({subCode:normalize(sub.code),description:normalize(a.description),method:a.method,row:a.sourceRow,source:a});
  }
  const expected=(exam.subcriteria||[]).flatMap(sub=>(sub.aspects||[]).map(a=>({sub,a})));
  for(const {sub,a} of expected){
    const key=`${normalize(sub.code)}|${normalize(a.description)}|${a.method}`;
    const possibilities=candidates.filter(c=>`${c.subCode}|${c.description}|${c.method}`===key&&!used.has(c.row));
    const candidate=possibilities.find(c=>c.row===a.cisSourceRow)||possibilities[0];
    if(!candidate){warnings.push(`Aspecto não localizado no XLSX: ${sub.code} · ${a.description}`);continue;}
    used.add(candidate.row);
    const raw=rows[candidate.row-1]?.[11];
    if(raw==null||String(raw).trim()==='')continue;
    const score=number(raw);
    if(score===null){warnings.push(`Linha ${candidate.row} (L): valor de nota inválido (${String(raw).slice(0,30)}).`);continue;}
    if(score<-1e-8||score>Number(a.maxScore)+1e-8){warnings.push(`Linha ${candidate.row} (L): ${score} fora do intervalo 0–${a.maxScore}.`);continue;}
    extracted.push({id:a.id,score:round(score),source:'xlsx',...(a.method==='M'?{achieved:score>0}:{})});
  }
  const missing=expected.length-extracted.length;
  const total=round(extracted.reduce((sum,x)=>sum+x.score,0));
  const structureMax=round(expected.reduce((sum,{a})=>sum+Number(a.maxScore||0),0));
  if(Math.abs(Number(exam.maxScore)-structureMax)>0.000001)warnings.push('A soma dos aspectos CIS não corresponde à pontuação máxima cadastrada.');
  return {module:parsedModule.module,scores:extracted,matched:extracted.length,totalAspects:expected.length,missing,total,structureMax,warnings};
}

export async function readCisScoreFile(file){
  if(!file||!/\.xlsx$/i.test(file.name))throw new Error('Selecione um arquivo XLSX.');
  if(file.size>10*1024*1024)throw new Error('O XLSX excede 10 MB.');
  const {readSheet}=await import('read-excel-file/browser');
  const rows=await readSheet(file);
  return {rows,parsed:parseCisRows(rows),fileName:file.name};
}

export function mergeImportedScores(current,imported,{replace=false}={}){
  const values=new Map((current||[]).map(v=>[v.id,v]));
  let added=0,replaced=0,skipped=0;
  for(const s of imported){
    if(values.has(s.id)){
      if(replace){values.set(s.id,s);replaced++;}else skipped++;
    }else{values.set(s.id,s);added++;}
  }
  return {scores:[...values.values()],added,replaced,skipped};
}
