import React, {useMemo,useState} from 'react';
import {ArrowLeft,FileSpreadsheet,AlertTriangle,CheckCircle2,Save,ChevronDown} from 'lucide-react';
import CisFileDropzone from './CisFileDropzone.jsx';
import {Button,Badge,Empty} from './UI.jsx';
import {points} from '../lib/api.js';
import {readCisXlsx} from '../lib/cisXlsx.js';
import {importSubcriteria,preserveAspectRelations} from '../lib/cisParser.js';

const relatedModule = (exam, module) => {
  const c=String(exam.module||'').trim().toUpperCase();
  return c===module || c===module.slice(1);
};
const countAspects=exam=>(exam?.subcriteria||[]).reduce((n,s)=>n+(s.aspects||[]).length,0);
const hasExecution=(db,id)=>(db.executions||[]).some(e=>e.examId===id);
const matchSuggestions=(modules,db)=>Object.fromEntries(modules.map(m=>{
  const same=(db.exams||[]).filter(e=>relatedModule(e,m.module));
  const exact=same.filter(e=>String(e.title||'').trim().toLowerCase()===m.title.toLowerCase());
  const candidate=exact.length===1?exact[0]:same.length===1?same[0]:null;
  return [m.module,{examId:candidate?.id||'',enabled:!!candidate && !countAspects(candidate),replace:false,updateScore:false}];
}));
const meta=module=> `${module.subcriteria.length} subcritérios · ${module.aspectCount} aspectos (${module.measurementCount} M / ${module.judgementCount} J) · ${points(module.totalScore)} pts`;

export default function CisImportWizard({db,onBack,onSave}) {
  const [result,setResult]=useState(null);
  const [mapping,setMapping]=useState({});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [importing,setImporting]=useState(false);
  const [done,setDone]=useState([]);
  const [fileName,setFileName]=useState('');
  const modules=result?.modules||[];
  const selected=useMemo(()=>modules.filter(m=>mapping[m.module]?.enabled),[modules,mapping]);
  const upd=(letter,changes)=>setMapping(prev=>({...prev,[letter]:{...prev[letter],...changes}}));

  async function chooseFile(file) {
    if(!file)return;
    setBusy(true);setError('');setResult(null);setDone([]);setFileName(file.name);
    try {const parsed=await readCisXlsx(file);setResult(parsed);setMapping(matchSuggestions(parsed.modules,db));}
    catch(e){setError(e?.message||'Erro ao ler o CIS.');}
    finally{setBusy(false);}
  }

  function validation(module) {
    const choice=mapping[module.module]||{};
    const target=db.exams.find(e=>e.id===choice.examId);
    if(!target)return 'Selecione uma prova existente.';
    if(hasExecution(db,target.id))return 'Esta prova já possui execuções. A estrutura CIS não pode ser trocada nesta versão.';
    if(countAspects(target)&&!choice.replace)return 'A prova já possui CIS. Autorize a substituição ou desmarque este módulo.';
    if(Math.abs(Number(target.maxScore)-module.totalScore)>0.000001&&!choice.updateScore)return 'A pontuação do CIS é diferente da prova. Autorize a atualização da pontuação.';
    if(module.warnings.length)return 'O módulo contém avisos; revise o arquivo antes de importar.';
    if(module.subcriteria.some(s=>s.aspects.some(a=>a.maxScore===null||!a.description)))return 'Há aspectos incompletos.';
    return '';
  }

  async function save() {
    setError('');
    if(!selected.length){setError('Selecione ao menos um módulo para importar.');return;}
    const reused=new Set();
    for(const module of selected) {
      const id=mapping[module.module]?.examId;
      if(reused.has(id)){setError('Dois módulos não podem ser vinculados à mesma prova.');return;}
      reused.add(id);
      const issue=validation(module);
      if(issue){setError(`${module.module}: ${issue}`);return;}
    }
    if(selected.some(m=>mapping[m.module].replace)&&!window.confirm('A substituição atualizará os aspectos do CIS nas provas selecionadas. Vínculos técnicos serão mantidos somente quando o aspecto correspondente for identificado. Deseja continuar?'))return;
    setImporting(true);
    const succeeded=[];
    try {
      for(const module of selected) {
        const exam=db.exams.find(e=>e.id===mapping[module.module].examId);
        let subcriteria=importSubcriteria(module);
        if(countAspects(exam)) subcriteria=preserveAspectRelations(exam,subcriteria);
        const changes={...exam,subcriteria,cisImportedAt:new Date().toISOString(),
          ...(mapping[module.module].updateScore?{maxScore:module.totalScore}:{})};
        await onSave(changes);
        succeeded.push(module.module);
        setDone([...succeeded]);
      }
    }catch(e){setError(`Importação parcial: ${e?.message||'Erro inesperado'}. Módulos concluídos: ${succeeded.join(', ')||'nenhum'}.`)}
    finally{setImporting(false);}
  }

  const complete=done.length>0 && done.length===selected.length;
  return <div className="cis-import-workspace">
    <div className="cis-import-header">
      <Button variant="ghost" onClick={onBack}><ArrowLeft size={16}/> Voltar às provas</Button>
    </div>
    <section className="panel cis-import-panel">
      <div className="cis-import-title"><FileSpreadsheet size={24}/><div><h1>Importar CIS</h1><p>Reconhecimento de módulos, subcritérios, aspectos Measurement/Judgement e WSOS.</p></div></div>
      <div className="cis-import-upload">
        <CisFileDropzone fileName={fileName} disabled={busy||importing} onFile={chooseFile} onInvalid={setError}/>
        <small>O XLSX é processado no navegador. Somente os dados estruturados selecionados serão gravados no JSON Server.</small>
      </div>
      {busy&&<p className="muted">Lendo e reconhecendo as seções do CIS...</p>}
      {error&&<p className="note warning" role="alert">{error}</p>}
      {result&&<>
        <div className="cis-import-overview">
          <div><strong>{modules.length}</strong><span>Módulos encontrados</span></div>
          <div><strong>{modules.reduce((a,m)=>a+m.subcriteria.length,0)}</strong><span>Subcritérios</span></div>
          <div><strong>{modules.reduce((a,m)=>a+m.aspectCount,0)}</strong><span>Aspectos</span></div>
          <div><strong>{points(modules.reduce((a,m)=>a+m.totalScore,0))}</strong><span>Pontos no CIS</span></div>
        </div>
        <div className="cis-import-module-grid">
          {modules.map(module=>{
            const choice=mapping[module.module]||{},target=db.exams.find(e=>e.id===choice.examId);
            const current=countAspects(target),blocked=target&&hasExecution(db,target.id);
            const pointMismatch=target&&Math.abs(Number(target.maxScore)-module.totalScore)>0.000001;
            return <article className={`cis-import-module${choice.enabled?' is-enabled':''}`} key={module.module}>
              <div className="cis-import-module-head"><label className="cis-import-choose"><input type="checkbox" checked={!!choice.enabled} disabled={importing||complete} onChange={e=>upd(module.module,{enabled:e.target.checked})}/><span className="cis-import-code">{module.module}</span><strong>{module.title}</strong></label>{done.includes(module.module)&&<CheckCircle2 size={19} color="#1d9b69"/>}</div>
              <div className="cis-import-module-stats">{meta(module)}</div>
              <label className="cis-import-select-label">Vincular à prova existente
                <select value={choice.examId||''} disabled={importing||complete} onChange={e=>upd(module.module,{examId:e.target.value,replace:false,updateScore:false})}>
                  <option value="">Selecione uma prova...</option>
                  {(db.exams||[]).map(e=><option key={e.id} value={e.id}>{e.module||'—'} · {e.title}</option>)}
                </select>
              </label>
              {current>0&&<label className="cis-import-option"><input type="checkbox" checked={!!choice.replace} disabled={blocked||importing||complete} onChange={e=>upd(module.module,{replace:e.target.checked})}/> Substituir CIS já existente ({current} aspectos)</label>}
              {pointMismatch&&<label className="cis-import-option"><input type="checkbox" checked={!!choice.updateScore} disabled={importing||complete} onChange={e=>upd(module.module,{updateScore:e.target.checked})}/> Atualizar pontuação da prova: {points(target.maxScore)} → {points(module.totalScore)}</label>}
              {blocked&&<p className="cis-import-warning"><AlertTriangle size={14}/> Prova com execuções: a importação está bloqueada.</p>}
              {module.warnings.map((w,i)=><p className="cis-import-warning" key={i}><AlertTriangle size={14}/>{w}</p>)}
              {choice.enabled&&validation(module)&&<small className="cis-import-validation">{validation(module)}</small>}
              <details className="cis-import-preview"><summary>Prévia dos subcritérios <ChevronDown size={14}/></summary>
                {module.subcriteria.map(sub=><details key={sub.code} className="cis-import-sub"><summary><b>{sub.code} — {sub.title}</b><span>{sub.aspects.length} aspectos · {points(sub.aspects.reduce((a,v)=>a+v.maxScore,0))} pts</span></summary>
                  <ul>{sub.aspects.map(a=><li key={a.sourceRow}><span>{a.method} · WSOS {a.wsosSection} · {points(a.maxScore)} pts</span>{a.description}</li>)}</ul>
                </details>)}
              </details>
            </article>;
          })}
        </div>
        <div className="cis-import-savebar">
          <span>{complete?`${done.length} módulos importados com sucesso.`:`${selected.length} módulos selecionados para importar`}</span>
          <div className="inline-actions"><Button variant="ghost" onClick={onBack}>{complete?'Voltar ao catálogo':'Cancelar'}</Button><Button onClick={save} disabled={importing||complete||selected.length===0}><Save size={16}/>{importing?'Gravando...':'Importar módulos selecionados'}</Button></div>
        </div>
        <p className="cis-import-legal">A importação substitui apenas a estrutura CIS e, quando autorizado, a pontuação máxima. Descrição, edição, país, desafios, áreas e competências já cadastrados na prova permanecem inalterados.</p>
      </>}
      {!result&&!busy&&<Empty title="Carregue um CIS para começar" subtitle="O sistema reconhecerá os blocos Criterion A–I e exibirá somente os módulos que contêm aspectos válidos."/>}
    </section>
  </div>;
}
