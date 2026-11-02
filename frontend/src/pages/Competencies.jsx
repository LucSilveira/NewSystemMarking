import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,BookOpen,CalendarDays,ChevronRight,ClipboardCheck,Layers3,Plus,Pencil,Target,Trash2,TrendingUp,Users} from 'lucide-react';
import SelectField from '../components/SelectField.jsx';
import {Button,Field,Modal,PageTitle,Badge,Empty,Footer} from '../components/UI.jsx';
import {uid,today,lookup,points,percent,request} from '../lib/api.js';
import {COMPETENCY_CATEGORIES,competencyCategory,getCompetencyAssessments,dateBR} from '../lib/competencyAnalysis.js';

const LEVELS=['','Inicial','Em desenvolvimento','Autônomo','Avançado'];
const safePercent=value=>value==null?'—':percent(value);

function CompetencyEditor({source,db,onClose,onSave}){
 const [value,setValue]=useState({...source,category:source.category||'technical',areaIds:Array.isArray(source.areaIds)?source.areaIds:[]});
 const [busy,setBusy]=useState(false);
 const set=(key,v)=>setValue(p=>({...p,[key]:v}));
 const areas=db.occupationAreas.filter(a=>a.occupationId===value.occupationId);
 const wsos=db.wsos.filter(w=>!w.occupationId||w.occupationId===value.occupationId);
 async function submit(e){e.preventDefault();setBusy(true);try{const v={...value};delete v._new;await onSave(v);onClose()}catch{}finally{setBusy(false)}}
 return <Modal title={source._new?'Nova competência ou habilidade':'Editar competência ou habilidade'} subtitle="A classificação organiza a biblioteca; o mapeamento com provas é independente." onClose={onClose}>
  <form onSubmit={submit}><div className="form-grid">
   <Field label="Nome"><input required value={value.name||''} onChange={e=>set('name',e.target.value)} placeholder="Ex.: APIs REST, interpretação de texto, inglês"/></Field>
   <Field label="Classificação"><SelectField value={value.category} onChange={e=>set('category',e.target.value)}>{COMPETENCY_CATEGORIES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</SelectField></Field>
   <Field label="Ocupação"><SelectField value={value.occupationId||''} onChange={e=>setValue(p=>({...p,occupationId:e.target.value,areaIds:[],wsosId:null}))}><option value="">Selecione</option>{db.occupations.map(o=><option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}</SelectField></Field>
   {value.category==='technical'&&<>
    <Field label="Áreas da ocupação (opcional)" hint="A área organiza o catálogo; a pontuação depende dos aspectos CIS mapeados."><div className="multi-list">{areas.map(a=><label className="check-row" key={a.id}><input type="checkbox" checked={value.areaIds.includes(a.id)} onChange={e=>set('areaIds',e.target.checked?[...value.areaIds,a.id]:value.areaIds.filter(id=>id!==a.id))}/>{a.name}</label>)}</div></Field>
    <Field label="WSOS de referência (opcional)"><SelectField value={value.wsosId||''} onChange={e=>set('wsosId',e.target.value||null)}><option value="">Sem associação fixa</option>{wsos.map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</SelectField></Field>
   </>}
   <Field label="Descrição / o que observar"><textarea rows="3" value={value.description||''} onChange={e=>set('description',e.target.value)} placeholder="Explique como identificar o domínio desta habilidade."/></Field>
  </div><Footer cancel={onClose} busy={busy}/></form>
 </Modal>;
}

function AssessmentEditor({source,db,onClose,onSave}){
 const [value,setValue]=useState(source),[busy,setBusy]=useState(false);
 const set=(k,v)=>setValue(p=>({...p,[k]:v}));
 async function submit(e){e.preventDefault();setBusy(true);try{const clean={...value,level:Number(value.level)};delete clean._new;await onSave(clean);onClose()}catch{}finally{setBusy(false)}}
 return <Modal title={source._new?'Registrar avaliação do professor':'Editar avaliação do professor'} subtitle="O domínio observado é registrado de forma independente das notas CIS." onClose={onClose}>
  <form onSubmit={submit}><div className="form-grid">
   <Field label="Competidor"><SelectField value={value.competitorId||''} onChange={e=>set('competitorId',e.target.value)} required><option value="">Selecione...</option>{db.competitors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</SelectField></Field>
   <Field label="Competência ou habilidade"><SelectField value={value.competencyId||''} onChange={e=>set('competencyId',e.target.value)} required><option value="">Selecione...</option>{db.competencies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</SelectField></Field>
   <div className="grid-two">
    <Field label="Data"><input type="date" value={value.date||''} onChange={e=>set('date',e.target.value)} required/></Field>
    <Field label="Domínio observado"><SelectField value={value.level} onChange={e=>set('level',Number(e.target.value))}>{[1,2,3,4].map(n=><option value={n} key={n}>{n} · {LEVELS[n]}</option>)}</SelectField></Field>
   </div>
   <Field label="Observações e evidências"><textarea rows="4" value={value.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="O que foi observado? Ex.: leu o briefing em inglês sem apoio e explicou os requisitos corretamente."/></Field>
  </div><Footer cancel={onClose} busy={busy}/></form>
 </Modal>;
}

function Metric({label,value,extra}){
 return <div className="competency-metric"><span>{label}</span><strong>{value}</strong>{extra&&<small>{extra}</small>}</div>;
}

function CompetencyCard({competency,stats,latest,onOpen}){
 const kind=competencyCategory(competency.category);
 return <button type="button" className="competency-card" onClick={onOpen} aria-label={`Abrir detalhes de ${competency.name}`}>
  <div className="competency-card-top"><span className={`competency-category is-${kind.value}`}>{kind.label}</span><ChevronRight size={17}/></div>
  <strong className="competency-card-title">{competency.name}</strong>
  <p className="competency-card-description">{competency.description||kind.description}</p>
  <div className="competency-card-metrics">
   <div><span>Resultado CIS</span><b>{safePercent(stats?.percentage)}</b></div>
   <div><span>Avaliação do professor</span><b>{latest?`${latest.level}/4`:'—'}</b></div>
  </div>
  <div className="competency-card-foot"><span>{stats?.executionCount?`${stats.executionCount} execuções com evidências`:'Sem evidências CIS'}</span><span>Detalhes <ChevronRight size={14}/></span></div>
 </button>;
}

function CompetencyDetail({competency,db,competitorId,cisStats,onBack,onEdit,onDelete,onAssess,onEditAssessment,onDeleteAssessment}){
 const competitor=db.competitors.find(x=>String(x.id)===String(competitorId));
 const cis=cisStats||null;
 const assessments=useMemo(()=>competitor?getCompetencyAssessments(competency.id,competitor.id,db.technicalAssessments):[],[competency.id,competitor,db.technicalAssessments]);
 const kind=competencyCategory(competency.category);
 return <div className="competency-detail">
  <div className="competency-detail-navigation"><Button variant="ghost" onClick={onBack}><ArrowLeft size={16}/> Todas as competências</Button><div className="inline-actions"><Button variant="subtle" onClick={onEdit}><Pencil size={15}/> Editar</Button><Button variant="danger-ghost" onClick={onDelete}><Trash2 size={15}/> Excluir</Button></div></div>
  <div className="competency-detail-heading"><div><span className={`competency-category is-${kind.value}`}>{kind.label}</span><h1>{competency.name}</h1><p>{competency.description||kind.description}</p>{(competency.areaIds||[]).length>0&&<div className="competency-detail-areas">{competency.areaIds.map(id=><span key={id}>{lookup(db.occupationAreas,id)}</span>)}</div>}</div><Button disabled={!competitor} onClick={onAssess}><Target size={16}/> Avaliar domínio</Button></div>
  {!competitor?<div className="competency-select-warning">Selecione um competidor no filtro para consultar resultados e avaliações de domínio.</div>:<>
   <div className="competency-detail-summary"><Metric label="Aproveitamento CIS" value={safePercent(cis?.percentage)} extra={cis?.possible?`${points(cis.earned)} / ${points(cis.possible)} pontos`:'Sem aspectos CIS pontuados'}/><Metric label="Domínio observado" value={assessments.length?`${assessments[0].level}/4`:'—'} extra={assessments.length?`${LEVELS[assessments[0].level]} · ${dateBR(assessments[0].date)}`:'Sem avaliação registrada'}/><Metric label="Execuções com evidências" value={cis?.executionCount||'0'} extra={`${cis?.aspectGrades||0} avaliações de aspectos vinculados`}/></div>
   <div className="competency-detail-grid">
    <section className="panel competency-detail-panel"><header className="panel-heading"><div><h2><BookOpen size={18}/> Resultado derivado do CIS</h2><p>Pontos conquistados nos aspectos vinculados — apenas correções finalizadas.</p></div></header>
     {cis?.history.length?<>
      <div className="competency-cis-overview"><strong>{safePercent(cis.percentage)}</strong><div className="competency-progress"><span style={{width:`${Math.min(100,Math.max(0,cis.percentage||0))}%`}}/></div><small>{points(cis.earned)} de {points(cis.possible)} pontos considerados em {cis.executionCount} execução(ões)</small></div>
      <div className="competency-detail-records">{cis.history.map(item=><div className="competency-detail-record" key={item.executionId}><span className="competency-detail-date"><CalendarDays size={15}/>{dateBR(item.date)}</span><div><strong>{item.module&&`${item.module} · `}{item.examTitle}</strong><small>{item.aspectCount} aspectos avaliados vinculados</small></div><b>{points(item.earned)} / {points(item.possible)} <small>({safePercent(item.percentage)})</small></b></div>)}</div>
     </>:<Empty title="Sem resultados CIS associados" subtitle="A competência aparecerá aqui quando um aspecto vinculado tiver nota em uma execução finalizada."/>}
    </section>
    <section className="panel competency-detail-panel"><header className="panel-heading"><div><h2><ClipboardCheck size={18}/> Avaliação do professor</h2><p>Acompanhamento independente, sem converter níveis em pontos da prova.</p></div></header>
     {assessments.length?<div className="competency-detail-records">{assessments.map(a=><div className="competency-assessment" key={a.id}><div className="competency-assessment-top"><span className="competency-detail-date"><CalendarDays size={15}/>{dateBR(a.date)}</span><Badge tone="blue">{a.level}/4 · {LEVELS[a.level]}</Badge></div>{a.notes&&<p>{a.notes}</p>}<div className="inline-actions"><Button variant="subtle" onClick={()=>onEditAssessment(a)}>Editar</Button><Button variant="danger-ghost" onClick={()=>onDeleteAssessment(a.id)}>Excluir</Button></div></div>)}</div>:<Empty title="Nenhuma avaliação registrada" subtitle="Registre observações sobre autonomia, comunicação, leitura e outras habilidades."/>}
    </section>
   </div>
  </>}
  <p className="competency-method-note"><Layers3 size={15}/> O resultado CIS e o nível atribuído pelo professor representam dimensões diferentes. O sistema não calcula uma média entre eles nem estima notas de habilidades sem critérios vinculados.</p>
 </div>;
}

export default function Competencies({db,saveRecord,deleteRecord}){
 const [editing,setEditing]=useState(null),[assessing,setAssessing]=useState(null);
 const [competitorId,setCompetitorId]=useState(db.competitors.length===1?db.competitors[0].id:'');
 const [category,setCategory]=useState('all'),[selectedId,setSelectedId]=useState(null);
 const selectedCompetency=db.competencies.find(x=>x.id===selectedId);
 const [report,setReport]=useState(null),[reportError,setReportError]=useState('');
 useEffect(()=>{
  let active=true;setReport(null);setReportError('');
  if(competitorId)request(`/reports/competencies/${encodeURIComponent(competitorId)}`)
   .then(data=>{if(active)setReport(data)})
   .catch(error=>{if(active)setReportError(error.message)});
  return()=>{active=false};
 },[competitorId,db.executions,db.exams,db.competencies,db.technicalAssessments]);
 const reportReady=report?.competitorId===competitorId;
 const reportsById=useMemo(()=>new Map((reportReady?report.results:[]).map(r=>[r.competencyId,r])),[report,reportReady]);
 const metrics=useMemo(()=>new Map(db.competencies.map(c=>[c.id,reportsById.get(c.id)?.cis||null])),[db.competencies,reportsById]);
 const latest=useMemo(()=>new Map(db.competencies.map(c=>[c.id,reportsById.get(c.id)?.latestAssessment||null])),[db.competencies,reportsById]);
 const visible=db.competencies.filter(c=>category==='all'||competencyCategory(c.category).value===category);
 const newAssessment=(competencyId=selectedId)=>setAssessing({_new:true,id:uid(),competitorId:competitorId||db.competitors[0]?.id||'',competencyId:competencyId||db.competencies[0]?.id||'',date:today(),level:2,notes:''});
 const newCompetency=()=>setEditing({_new:true,id:uid(),name:'',description:'',occupationId:db.occupations[0]?.id||'',areaIds:[],wsosId:null,category:'technical'});
 return <>
  {!selectedCompetency?<>
   <PageTitle eyebrow="DESENVOLVIMENTO DO COMPETIDOR" title="Competências e habilidades" desc="Acompanhe os resultados das provas e as observações do avaliador sem misturar suas pontuações." actions={<><Button variant="subtle" disabled={!db.competencies.length||!db.competitors.length} onClick={()=>newAssessment(null)}><Target size={16}/> Avaliar domínio</Button><Button onClick={newCompetency}><Plus size={16}/> Nova competência</Button></>}/>
   <div className="competency-toolbar"><Field label="Competidor"><SelectField value={competitorId} onChange={e=>setCompetitorId(e.target.value)}><option value="">Selecione um competidor</option>{db.competitors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</SelectField></Field></div>
   {reportError&&<div className="banner error" role="alert">Não foi possível carregar o relatório de competências: {reportError}</div>}
   <div className="competency-filters"><button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>Todas <small>{db.competencies.length}</small></button>{COMPETENCY_CATEGORIES.map(kind=>{const count=db.competencies.filter(c=>competencyCategory(c.category).value===kind.value).length;return count?<button key={kind.value} className={category===kind.value?'active':''} onClick={()=>setCategory(kind.value)}>{kind.label} <small>{count}</small></button>:null})}</div>
   <div className="competency-cards">{visible.map(c=><CompetencyCard key={c.id} competency={c} stats={metrics.get(c.id)} latest={latest.get(c.id)} onOpen={()=>setSelectedId(c.id)}/>)}</div>
   {!visible.length&&<Empty title="Nenhuma competência nessa categoria" subtitle="Adicione uma competência técnica ou uma habilidade acompanhada pelo avaliador."/>}
  </>:<>
   <div className="competency-toolbar"><Field label="Competidor"><SelectField value={competitorId} onChange={e=>setCompetitorId(e.target.value)}><option value="">Selecione um competidor</option>{db.competitors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</SelectField></Field></div>
   {reportError&&<div className="banner error" role="alert">Relatório indisponível: {reportError}</div>}
   <CompetencyDetail competency={selectedCompetency} db={db} competitorId={competitorId} cisStats={metrics.get(selectedCompetency.id)} onBack={()=>setSelectedId(null)} onEdit={()=>setEditing(selectedCompetency)} onDelete={async()=>{if(await deleteRecord('competencies',selectedCompetency.id))setSelectedId(null)}} onAssess={()=>newAssessment(selectedCompetency.id)} onEditAssessment={setAssessing} onDeleteAssessment={id=>deleteRecord('technicalAssessments',id)}/>
  </>}
  {editing&&<CompetencyEditor key={editing.id} source={editing} db={db} onClose={()=>setEditing(null)} onSave={v=>saveRecord('competencies',v)}/>} 
  {assessing&&<AssessmentEditor key={assessing.id} source={assessing} db={db} onClose={()=>setAssessing(null)} onSave={v=>saveRecord('technicalAssessments',v)}/>} 
 </>;
}
