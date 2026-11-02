import SelectField from '../components/SelectField.jsx';
import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,BookOpen,Check,CheckCircle2,ChevronDown,ClipboardCheck,FileSpreadsheet,Info,Plus,Save,Search,ShieldAlert,Trash2,UploadCloud,CalendarDays,Layers3} from 'lucide-react';
import {Button,Field,PageTitle,Badge,Empty} from '../components/UI.jsx';
import {uid,today,lookup,points,percent,clone} from '../lib/api.js';
import {readCisScoreFile,moduleFromCis,previewCisScores,mergeImportedScores,validateCisScoreCoverage} from '../lib/cisScores.js';
import ExamCombobox from '../components/ExamCombobox.jsx';
import {examHasCis,examHasConsistentCis,editionLabel,typeLabel,executionGroups,executionExamHistories} from '../lib/executionCatalog.js';
import {occupationPath,executionPath} from '../lib/occupationRouting.js';

const round=n=>Math.round((n+Number.EPSILON)*1e6)/1e6;
const aspectRows=exam=>(exam?.subcriteria||[]).flatMap(s=>(s.aspects||[]).map(a=>({...a,subCode:s.code,subTitle:s.title})));
const earned=(score,row)=>score?.votes?.length===3 ? round(Number(row.maxScore)*score.votes.reduce((n,v)=>n+v,0)/9) : Number(score?.score??0);
const explainStatus=x=>x.status==='finalized'?'Finalizada':x.complete?'Completa, não finalizada':'Rascunho';
const createDraft=db=>({id:uid(),competitorId:db.competitors[0]?.id||'',examId:'',activityId:null,date:today(),mode:'aspects',status:'draft',scores:[],notes:''});

function FilePicker({fileName,onFile,busy=false}){
 return <label className="execution-file-picker"><FileSpreadsheet size={18}/><span>{fileName||'Selecionar XLSX corrigido (coluna L)'}</span><input aria-label="Selecionar CIS corrigido" type="file" accept=".xlsx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)onFile(f)}}/></label>;
}
function ScoreImport({exam,form,onApply}){
 const [file,setFile]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[replace,setReplace]=useState(false);
 const preview=useMemo(()=>file&&exam?(()=>{const mod=moduleFromCis(file.parsed,exam);return mod?previewCisScores(file.rows,mod,exam):null})():null,[file,exam]);
 async function chooseFile(f){setLoading(true);setError('');try{setFile(await readCisScoreFile(f))}catch(e){setError(e.message);setFile(null)}finally{setLoading(false)}}
 const replaced=preview?mergeImportedScores(form.scores,preview.scores,{replace}):null;
 const coverage=validateCisScoreCoverage(preview);
 return <details className="execution-import-panel"><summary><span><UploadCloud size={18}/> Importar notas de um CIS XLSX</span><ChevronDown size={18}/></summary><div className="execution-import-inner">
   <p>Usa as notas concedidas na <strong>coluna L</strong>. O sistema confere módulo, subcritério, descrição e método. A importação exige nota em todos os aspectos: célula vazia não é zero.</p>
   <FilePicker fileName={file?.fileName} onFile={chooseFile} busy={loading}/>
   {loading&&<p className="execution-tip">Lendo a planilha...</p>}{error&&<p className="execution-alert" role="alert">{error}</p>}
   {file&&!preview&&<p className="execution-alert" role="alert">{coverage.message}</p>}
   {preview&&<><div className="execution-import-stats"><span><strong>{preview.matched}</strong> notas reconhecidas</span><span><strong>{preview.missing}</strong> sem nota</span><span><strong>{points(preview.total)}</strong> pontos marcados</span></div>
    {!coverage.canImport&&<div className="execution-alert" role="alert"><ShieldAlert size={16}/><span>{coverage.message}</span></div>}
    {!!preview.warnings.length&&<div className="execution-alert">{preview.warnings.slice(0,8).map((w,i)=><p key={i}>{w}</p>)}{preview.warnings.length>8&&<p>Mais {preview.warnings.length-8} avisos...</p>}</div>}
    {!!preview.scores.length&&<details className="execution-import-detail"><summary>Conferir as {preview.scores.length} notas identificadas <ChevronDown size={15}/></summary><div className="execution-import-detail-list">{preview.scores.map(s=>{const row=aspectRows(exam).find(a=>a.id===s.id);return <div key={s.id}><span>{row?.subCode} · {row?.description}</span><strong>{points(s.score)} / {points(row?.maxScore)}</strong></div>})}</div></details>}
    <label className="execution-inline-check"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/> Substituir as notas que já estão preenchidas</label>
    <div className="execution-import-actions"><span>{replaced.added} novas · {replaced.replaced} substituídas · {replaced.skipped} mantidas</span><Button disabled={!coverage.canImport} onClick={()=>{onApply(replaced.scores);setFile(null)}}>Aplicar ao rascunho</Button></div>
   </>}
 </div></details>;
}

function MeasurementRow({row,score,onChange}){
 const fullScore=Number(row.maxScore||0);
 const currentScore=score?.score!=null?Number(score.score):'';
 const checked=score!=null&&Math.abs(Number(score.score||0)-fullScore)<0.000001;
 return <div className="execution-score-controls">
   <label className="execution-checkbox"><input type="checkbox" checked={checked} onChange={e=>{
    if(e.target.checked)onChange({id:row.id,score:fullScore,achieved:true,source:'manual'});
    else onChange({id:row.id,score:0,achieved:false,source:'manual'});
   }}/><span>Pontuação máxima</span></label>
   <label className="execution-number">Pontos concedidos <input type="number" inputMode="decimal" step="any" min="0" max={row.maxScore} placeholder="0" value={currentScore} onChange={e=>{
    if(e.target.value===''){onChange({id:row.id,score:0,achieved:false,source:'manual'});return;}
    const value=Number(e.target.value);if(Number.isFinite(value))onChange({id:row.id,score:value,achieved:value>=fullScore,source:'manual'});
   }}/><span>/ {points(row.maxScore)}</span></label>
 </div>;
}
function JudgementRow({row,score,onChange}){
 const [votes,setVotes]=useState(()=>score?.votes?.map(String)||['','','']);
 const [forceVotes,setForceVotes]=useState(false);
 useEffect(()=>{setVotes(score?.votes?.map(String)||['','','']);setForceVotes(false)},[row.id,score?.votes?.join(','),score?.score]);
 function voteAt(i,value){const next=votes.map((v,j)=>i===j?value:v);setVotes(next);
  if(next.every(v=>v!==''))onChange({id:row.id,votes:next.map(Number),source:'manual'});
  else if(score?.votes)onChange(null);
 }
 const range= votes.every(v=>v!=='')?Math.max(...votes.map(Number))-Math.min(...votes.map(Number)):0;
 const imported=score&&!score.votes&&score.judgementLevel==null&&!forceVotes;
 return <div className="execution-judgement">
  {imported&&<div className="execution-imported-score"><div className="execution-imported-score-row"><span>{score.source==='xlsx'?'Nota importada do CIS':'Nota direta (sem votos registrados)'}</span><input type="number" aria-label="Nota importada" min="0" max={row.maxScore} step="any" value={score.score} onChange={e=>{if(e.target.value==='')onChange({id:row.id,score:0,source:'manual'});else onChange({id:row.id,score:Number(e.target.value),source:'manual'})}}/><span>/ {points(row.maxScore)}</span><button className="execution-vote-switch" onClick={()=>{setForceVotes(true);onChange(null);}}>Registrar 3 votos</button></div><span className="execution-tip">Edite apenas a nota final ou troque para o modo com três votos.</span></div>}
  {!imported&&<><div className="execution-votes">{[0,1,2].map(i=><label key={i}>Avaliador {i+1}<SelectField aria-label={`Voto do avaliador ${i+1}`} value={votes[i]} onChange={e=>voteAt(i,e.target.value)}><option value="">—</option>{[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</SelectField></label>)}</div>
   {range>1&&<div className="execution-vote-warning"><ShieldAlert size={14}/> Divergência maior que 1 ponto entre avaliadores; revise os votos.</div>}
   <span className="execution-tip">A pontuação é proporcional à média dos três votos (0–3). Votos incompletos não são contabilizados.</span></>}
 </div>;
}
function ScoreAspect({row,index,score,onChange}){
 const current=score!=null;
 return <article className={`execution-aspect ${current?'is-scored':''}`}>
   <div className="execution-aspect-intro"><span className={`cis-method-badge ${row.method==='J'?'is-judgement':'is-measurement'}`}>{row.method}</span><div><strong>{row.subCode}.{index+1} · {row.description}</strong>{row.considerations&&<small>{row.considerations}</small>}</div><span className="execution-aspect-points">{current?points(earned(score,row)):'—'} / {points(row.maxScore)}</span></div>
   {row.method==='J'?<JudgementRow row={row} score={score} onChange={onChange}/>:<MeasurementRow row={row} score={score} onChange={onChange}/>}
 </article>;
}

function ExecutionWorkspace({db,source,onSave,onBack}){
 const isFinal=source.status==='finalized';
 const [form,setForm]=useState(()=>clone(source));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[onlyPending,setOnlyPending]=useState(false);
 const selectedExam=db.exams.find(e=>e.id===form.examId);
 const exam=form.examSnapshot||selectedExam;
 const groups=exam?.subcriteria||[];
 const aspects=useMemo(()=>aspectRows(exam),[exam]);
 const byId=useMemo(()=>new Map((form.scores||[]).map(s=>[s.id,s])),[form.scores]);
 const complete=aspects.length>0&&aspects.every(a=>byId.has(a.id))&&Math.abs(aspects.reduce((n,a)=>n+Number(a.maxScore||0),0)-Number(exam?.maxScore||0))<0.000001;
 const earnedTotal=round(aspects.reduce((n,a)=>n+(byId.has(a.id)?earned(byId.get(a.id),a):0),0));
 const marked=aspects.filter(a=>byId.has(a.id)).length;
 function edit(patch){setDirty(true);setError('');setForm(p=>({...p,...patch}));}
 function setScore(id,entry){edit({scores:entry==null?form.scores.filter(s=>s.id!==id):[...form.scores.filter(s=>s.id!==id),entry]});}
 useEffect(()=>{const beforeUnload=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload)},[dirty]);
 async function save(status){
  setError('');
  if(isFinal&&status==='draft'&&!window.confirm('Reabrir a correção finalizada para permitir novos lançamentos?'))return;if(!form.competitorId||!form.examId){setError('Selecione o competidor e a prova.');return;}
  if(!examHasConsistentCis(exam)){setError('Esta prova não possui um CIS de correção válido. Cadastre os aspectos e confira a pontuação antes de criar uma execução.');return;}
  if(status==='finalized'&&!complete){setError('Avalie todos os aspectos antes de finalizar. Se a soma máxima dos aspectos divergir da prova, corrija o cadastro.');return;}
  setBusy(true);try{const payload={...form,status,mode:'aspects'};delete payload._new;await onSave(payload);setDirty(false);onBack()}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 function leave(){if(dirty&&!window.confirm('Existem alterações ainda não salvas. Sair sem salvar?'))return;onBack()}
 const legacy=form.mode!=='aspects'&&!source._new;
 return <div className="execution-workspace">
  <div className="execution-workspace-top"><Button variant="ghost" disabled={busy} onClick={leave}><ArrowLeft size={16}/> Execuções</Button><div className="execution-workspace-meta"><Badge tone={form.status==='finalized'?'green':'amber'}>{form.status==='finalized'?'Finalizada':'Rascunho'}</Badge>{form.examSnapshot&&<small>Prova v{form.examVersion||1} · critérios preservados</small>}</div></div>
  <div className="execution-workspace-header"><div><span className="eyebrow">CORREÇÃO CIS</span><h1>{source._new?'Registrar execução':'Correção da execução'}</h1><p>Marque os aspectos, salve o rascunho e finalize quando a correção estiver completa.</p></div></div>
  <section className="execution-identity panel"><div className="execution-identity-grid"><Field label="Competidor"><SelectField required disabled={busy||isFinal||!source._new} value={form.competitorId} onChange={e=>edit({competitorId:e.target.value})}><option value="">Selecione...</option>{db.competitors.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</SelectField></Field>
   <Field label="Prova"><ExamCombobox exams={db.exams} editions={db.editions} disabled={busy||isFinal||!source._new} value={form.examId} onChange={value=>edit({examId:value,scores:[]})}/></Field>
   <Field label="Data"><input type="date" value={form.date} disabled={busy||isFinal} onChange={e=>edit({date:e.target.value})}/></Field>
   <Field label="Atividade relacionada (opcional)"><SelectField value={form.activityId||''} disabled={busy||isFinal} onChange={e=>edit({activityId:e.target.value||null})}><option value="">Sem vínculo</option>{db.activities.map(a=><option key={a.id} value={a.id}>{a.date} · {a.title}</option>)}</SelectField></Field></div>
   <Field label="Observações gerais"><textarea rows="2" value={form.notes||''} disabled={busy||isFinal} placeholder="Dificuldades ou decisões tomadas durante a correção" onChange={e=>edit({notes:e.target.value})}/></Field>
  </section>
  {legacy&&<div className="execution-alert">Este é um registro legado ({form.mode}). Suas notas foram preservadas e não podem ser convertidas automaticamente para aspectos CIS. Registre uma nova execução para utilizar a correção detalhada.</div>}
  {isFinal&&<div className="execution-finalized-info"><CheckCircle2 size={18}/> Correção finalizada e protegida contra edição. Para corrigir lançamentos, utilize Reabrir correção.</div>}
  {!legacy&&exam&&!examHasConsistentCis(exam)&&<div className="execution-alert execution-missing-cis" role="alert"><ShieldAlert size={18}/><div><strong>Esta prova ainda não está preparada para correção.</strong><p>{examHasCis(exam)?'A soma dos aspectos não corresponde à pontuação máxima, ou algum aspecto está inválido. Confira os critérios CIS no cadastro da prova.':'Não existem aspectos Measurement/Judgement cadastrados. Importe ou preencha a estrutura CIS da prova antes de iniciar uma execução.'}</p></div></div>}
  {!legacy&&exam&&examHasConsistentCis(exam)&&<>
   <div className="execution-summary panel"><div><strong>{marked} de {aspects.length}</strong><small>Aspectos avaliados</small></div><div><strong>{points(earnedTotal)} / {points(exam.maxScore)}</strong><small>Pontuação lançada</small></div><div><strong>{aspects.length?Math.round(marked/aspects.length*100):0}%</strong><small>Conclusão</small></div><div className="execution-progress"><div style={{width:`${aspects.length?marked/aspects.length*100:0}%`}}/></div></div>
   {!isFinal&&<ScoreImport exam={exam} form={form} onApply={scores=>edit({scores})}/>}
   <div className="execution-aspects-header"><div><h2>Correção por aspecto</h2><p>Measurement: checkbox para nota máxima ou valor parcial. Judgement: três votos ou nota importada.</p></div><label className="execution-inline-check"><input type="checkbox" checked={onlyPending} onChange={e=>setOnlyPending(e.target.checked)}/> Apenas pendentes</label></div>
   {groups.map((sub,idx)=>{
    const visible=(sub.aspects||[]).filter(a=>!onlyPending||!byId.has(a.id));
    if(!visible.length&&onlyPending)return null;
    const scored=(sub.aspects||[]).filter(a=>byId.has(a.id)).length;
    return <details className="execution-subcriterion" key={sub.id||idx} open={undefined}>
      <summary><span className="execution-sub-label"><strong>{sub.code} · {sub.title||'Subcritério'}</strong><small>{scored}/{sub.aspects.length} aspectos · {points(sub.aspects.reduce((n,a)=>n+Number(a.maxScore||0),0))} pts</small></span><ChevronDown size={18}/></summary>
      <fieldset className="execution-subcriterion-body" disabled={isFinal}>{visible.map(a=><ScoreAspect key={a.id} row={a} index={(sub.aspects||[]).findIndex(x=>x.id===a.id)} score={byId.get(a.id)} onChange={v=>setScore(a.id,v)}/>)}</fieldset>
    </details>;
   })}
   {!aspects.length&&<div className="execution-alert">Esta prova ainda não tem aspectos CIS. Cadastre ou importe a estrutura da prova antes de corrigir.</div>}
  </>}
  {error&&<div className="execution-alert" role="alert">{error}</div>}
  <div className="execution-savebar"><span>{dirty?'Há alterações ainda não salvas.':form.status==='finalized'?'Correção finalizada.':'Correção em rascunho.'}</span><div><Button variant="ghost" onClick={leave} disabled={busy}>Cancelar</Button>{!legacy&&(isFinal?<Button variant="subtle" disabled={busy} onClick={()=>save('draft')}><Save size={16}/> Reabrir correção</Button>:<><Button variant="subtle" disabled={busy||!examHasConsistentCis(exam)} onClick={()=>save('draft')}><Save size={16}/> Salvar rascunho</Button><Button disabled={busy||!complete||!examHasConsistentCis(exam)} onClick={()=>save('finalized')}><CheckCircle2 size={16}/> Finalizar correção</Button></>)}</div></div>
 </div>;
}

function ExecutionBatch({db,onSave,onBack}){
 const [file,setFile]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [choices,setChoices]=useState({});
 const [competitorId,setCompetitorId]=useState(db.competitors[0]?.id||''),[date,setDate]=useState(today());
 const [finalizeComplete,setFinalizeComplete]=useState(false);
 const [created,setCreated]=useState([]);
 async function loadFile(f){setBusy(true);setError('');try{
   const parsed=await readCisScoreFile(f);setFile(parsed);setCreated([]);
   setChoices(Object.fromEntries(parsed.parsed.modules.map(m=>{
     const candidates=db.exams.filter(e=>String(e.module||'').toUpperCase()===m.module);
     return [m.module,{selected:candidates.length===1,examId:candidates.length===1?candidates[0].id:''}];
   })));
  }catch(e){setError(e.message);setFile(null)}finally{setBusy(false)}}
 const modules=file?.parsed.modules||[];
 const plans=modules.map(m=>{
  const choice=choices[m.module]||{},exam=db.exams.find(e=>e.id===choice.examId);
  const preview=exam?previewCisScores(file.rows,m,exam):null;
  const duplicate=exam&&db.executions.some(e=>e.examId===exam.id&&e.competitorId===competitorId&&e.date===date);
  const coverage=validateCisScoreCoverage(preview);
  const valid=!!choice.selected&&!!exam&&examHasConsistentCis(exam)&&coverage.canImport&&!duplicate;
  return {m,choice,exam,preview,duplicate,coverage,valid};
 });
 const ready=plans.filter(p=>p.valid&&!created.includes(p.m.module));
 async function save(){if(!competitorId||!date){setError('Selecione competidor e data.');return;}if(!ready.length){setError('Nenhuma prova válida selecionada.');return;}setBusy(true);setError('');const done=[...created];
  try{for(const p of ready){const complete=p.preview.missing===0&&Math.abs(p.preview.structureMax-Number(p.exam.maxScore))<0.000001;
   await onSave({id:uid(),competitorId,examId:p.exam.id,date,activityId:null,mode:'aspects',scores:p.preview.scores,notes:`Importado de ${file.fileName}`,status:finalizeComplete&&complete?'finalized':'draft'});
   done.push(p.m.module);setCreated([...done]);
  }onBack();}catch(e){setError(`${e.message}. ${done.length} módulo(s) cadastrados. Já concluídos não serão enviados novamente.`)}finally{setBusy(false)}
 }
 return <div className="execution-workspace"><div className="execution-workspace-top"><Button variant="ghost" onClick={onBack}><ArrowLeft size={16}/> Execuções</Button></div>
  <div className="execution-workspace-header"><div><span className="eyebrow">IMPORTAÇÃO EM LOTE</span><h1>Registrar execuções pelo CIS</h1><p>Um único XLSX pode registrar a correção de vários módulos para o mesmo competidor, sem alterar as provas cadastradas.</p></div></div>
  <section className="panel execution-batch-setup"><div className="execution-identity-grid"><Field label="Competidor"><SelectField value={competitorId} onChange={e=>setCompetitorId(e.target.value)}><option value="">Selecione...</option>{db.competitors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</SelectField></Field><Field label="Data"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field></div><FilePicker fileName={file?.fileName} onFile={loadFile} busy={busy}/></section>
  {file&&<section className="panel execution-batch-list"><h2>Vincular módulos às provas cadastradas</h2><p>Somente módulos com todas as notas na coluna L e um CIS compatível podem ser importados. Correções existentes para a mesma prova e data não serão sobrescritas.</p>
   {plans.map(p=><div className="execution-batch-row" key={p.m.module}><label className="execution-inline-check"><input type="checkbox" checked={!!p.choice.selected&&!created.includes(p.m.module)} disabled={created.includes(p.m.module)} onChange={e=>setChoices(v=>({...v,[p.m.module]:{...v[p.m.module],selected:e.target.checked}}))}/><strong>{p.m.module}</strong></label>
     <div className="execution-batch-title"><strong>{p.m.title}</strong><small>{p.m.aspectCount} aspectos · {points(p.m.totalScore)} pts</small></div>
     <SelectField aria-label={`Prova para ${p.m.module}`} value={p.choice.examId||''} onChange={e=>setChoices(v=>({...v,[p.m.module]:{...v[p.m.module],examId:e.target.value,selected:!!e.target.value}}))}><option value="">Escolher prova...</option>{db.exams.filter(e=>String(e.module||'').toUpperCase()===p.m.module).map(e=><option key={e.id} value={e.id}>{e.title} — {editionLabel(e,db.editions)}{!examHasConsistentCis(e)?' · SEM CIS':''}</option>)}</SelectField>
     <small className={p.duplicate||!p.coverage.canImport?'execution-batch-error':''}>{created.includes(p.m.module)?'Criada':p.duplicate?'Já existe execução nesta data':!p.exam?'Sem prova vinculada':!examHasConsistentCis(p.exam)?'Prova sem CIS válido':p.coverage.canImport?'Correção completa':p.coverage.message}</small>
     {!!p.preview?.warnings?.length&&<div className="execution-batch-warning">{p.preview.warnings.slice(0,3).join(' · ')}</div>}
   </div>)}
   <label className="execution-inline-check"><input type="checkbox" checked={finalizeComplete} onChange={e=>setFinalizeComplete(e.target.checked)}/> Finalizar automaticamente as execuções importadas (todas exigem correção completa)</label>
   {error&&<div className="execution-alert" role="alert">{error}</div>}
   <div className="execution-batch-footer"><span>{ready.length} nova(s) execução(ões) pronta(s)</span><Button disabled={busy||!ready.length} onClick={save}><Save size={16}/> Registrar execuções</Button></div>
  </section>}
  {!file&&error&&<div className="execution-alert" role="alert">{error}</div>}
 </div>;
}
function ExamHistoryCard({history,db,onOpen,onDelete}){
 const {exam,latest,executions,count}=history;
 return <article className="execution-exam-history-card">
   <div className="execution-exam-history-head">
    <span className="execution-record-module">{exam.module||'—'}</span>
    <div className="execution-exam-history-identification"><strong>{exam.title||'Prova não encontrada'}</strong><span>{count} {count===1?'execução cadastrada':'execuções cadastradas'} · Última em {latest.date}</span></div>
    <Badge tone={latest.status==='finalized'?'green':'amber'}>{explainStatus(latest)}</Badge>
   </div>
   <div className="execution-exam-latest">
    <div><span className="execution-exam-latest-label">ÚLTIMA EXECUÇÃO</span><strong>{lookup(db.competitors,latest.competitorId)}</strong><small>{latest.date} · {latest.overallScore!=null?`${points(latest.overallScore)} / ${points(latest.maxScore)} pts · ${percent(latest.percentage)}`:'Em correção'}</small></div>
    <Button variant="subtle" onClick={()=>onOpen(latest.id)}>Abrir mais recente</Button>
   </div>
   {count>1&&<details className="execution-exam-history-details">
    <summary><span>Ver histórico completo <b>{count}</b></span><ChevronDown size={16}/></summary>
    <div className="execution-exam-history-list">{executions.map((entry,index)=><div className="execution-exam-history-row" key={entry.id}>
     <div className="execution-exam-history-index"><CalendarDays size={16}/><div><strong>{entry.date}{index===0?' · Mais recente':''}</strong><small>{lookup(db.competitors,entry.competitorId)}</small></div></div>
     <div className="execution-exam-history-result"><Badge tone={entry.status==='finalized'?'green':'amber'}>{explainStatus(entry)}</Badge><span>{entry.overallScore!=null?`${points(entry.overallScore)} / ${points(entry.maxScore)} pts`:'Sem nota'}</span></div>
     <div className="execution-record-actions"><Button variant="subtle" onClick={()=>onOpen(entry.id)}>Visualizar</Button><Button variant="danger-ghost" onClick={()=>onDelete(entry.id)} aria-label={`Excluir execução de ${entry.date}`}><Trash2 size={15}/></Button></div>
    </div>)}</div>
   </details>}
   {count===1&&<div className="execution-exam-single-actions"><Button variant="danger-ghost" onClick={()=>onDelete(latest.id)}><Trash2 size={14}/> Excluir execução</Button></div>}
 </article>;
}
export default function Executions({db,saveRecord,deleteRecord,view=null,executionId=null,onNavigate,occupationCode:code}){
 const [competitor,setCompetitor]=useState('all'),[exam,setExam]=useState('all');
 const [groupBy,setGroupBy]=useState('edition');
 const path=occupationPath(code,'executions');
 const go=target=>onNavigate?onNavigate(target):null;
 const rows=[...db.executions].filter(x=>(competitor==='all'||x.competitorId===competitor)&&(exam==='all'||x.examId===exam)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const grouped=executionGroups(rows,db.exams,db.editions,db.examTypes,groupBy);
 const recent=rows.slice(0,5);
 if(view==='new')return <ExecutionWorkspace key="new" db={db} source={{...createDraft(db),_new:true}} onSave={data=>saveRecord('executions',data)} onBack={()=>go(path)}/>;
 if(view==='edit'){
  const existing=db.executions.find(e=>e.id===executionId);
  if(!existing)return <div className="execution-workspace"><Empty title="Execução não encontrada"/><Button onClick={()=>go(path)}>Voltar à lista</Button></div>;
  return <ExecutionWorkspace key={existing.id} db={db} source={existing} onSave={data=>saveRecord('executions',data)} onBack={()=>go(path)}/>;
 }
 if(view==='batch')return <ExecutionBatch db={db} onSave={data=>saveRecord('executions',data)} onBack={()=>go(path)}/>;
 return <><PageTitle eyebrow="AVALIAÇÕES" title="Execuções" desc="Resultados de provas, correções CIS e histórico de aplicações." actions={<><Button variant="subtle" onClick={()=>go(executionPath(code,'importar'))}><FileSpreadsheet size={16}/> Importar CIS corrigido</Button><Button onClick={()=>go(executionPath(code,'nova'))}><Plus size={16}/> Nova execução</Button></>}/>
  {!!recent.length&&<section className="execution-recent-section"><div className="execution-section-heading"><div><h2>Últimas execuções</h2><p>Retome rapidamente as correções mais recentes.</p></div></div><div className="execution-recent-grid">{recent.map(x=>{const e=db.exams.find(v=>v.id===x.examId)||x.examSnapshot||{};return <button key={x.id} type="button" className="execution-recent-card" onClick={()=>go(executionPath(code,x.id))}><span className="execution-record-module">{e.module||'—'}</span><strong>{e.title||'Prova'}</strong><small>{lookup(db.competitors,x.competitorId)}</small><span className="execution-recent-bottom">{x.date}<Badge tone={x.status==='finalized'?'green':'amber'}>{explainStatus(x)}</Badge></span></button>})}</div></section>}
  <section className="execution-catalog-controls panel"><div className="execution-catalog-filters"><Field label="Competidor"><SelectField aria-label="Filtrar competidor" value={competitor} onChange={e=>setCompetitor(e.target.value)}><option value="all">Todos os competidores</option>{db.competitors.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</SelectField></Field><Field label="Prova"><ExamCombobox allowAll exams={db.exams} editions={db.editions} value={exam} onChange={setExam} placeholder="Todas as provas · buscar..."/></Field></div><div className="execution-group-toggle"><span>Agrupar por</span><button className={groupBy==='edition'?'active':''} onClick={()=>setGroupBy('edition')}>Edição</button><button className={groupBy==='type'?'active':''} onClick={()=>setGroupBy('type')}>Tipo de prova</button><small>{rows.length} execução(ões)</small></div></section>
  {grouped.length?grouped.map((group,index)=><details className="execution-group-accordion" key={`${groupBy}:${group.label}`} defaultOpen={index===0}>
   <summary><span><Layers3 size={17}/><strong>{group.label}</strong><small>{executionExamHistories(group.items,db.exams).length} provas · {group.items.length} execuções</small></span><ChevronDown size={17}/></summary>
   <div className="execution-group-body">{executionExamHistories(group.items,db.exams).map(history=><ExamHistoryCard key={history.examId} history={history} db={db} onOpen={id=>go(executionPath(code,id))} onDelete={id=>deleteRecord('executions',id)}/>)}</div>
  </details>):<section className="panel"><Empty title="Nenhuma execução encontrada" subtitle="Crie uma nova execução ou ajuste os filtros para localizar uma correção."/></section>}
 </>;
}
