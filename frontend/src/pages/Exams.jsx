import React, {useEffect, useMemo, useState} from 'react';
import {ArrowLeft, Plus, Pencil, Copy, Trash2, Link2, Eye, Save, ChevronDown, Check, Layers3, ListChecks, FileSpreadsheet, GripVertical, X, MousePointer2, SlidersHorizontal, RotateCcw} from 'lucide-react';
import {Button, Field, Badge, PageTitle, Empty, SearchBar, LineEditor} from '../components/UI.jsx';
import {uid, clone, points, lookup, aspectList} from '../lib/api.js';
import CisImportWizard from '../components/CisImportWizard.jsx';
import CisInlineLoader from '../components/CisInlineLoader.jsx';
import {aspectKey, updateAspectRelationships, updateAspectRelationshipsBatch, dropTargets, selectSourceRelations, dragSourceRelations} from '../lib/aspectRelationships.js';
import {catalogOptions,filterExamCatalog,activeExamFilterCount} from '../lib/examCatalogFilters.js';
import {examRemovalBlockers,examRemovalWarning} from '../lib/examRemoval.js';

const arr = value => Array.isArray(value) ? value : [];
const toggle = (items, id, checked) => checked ? [...new Set([...items, id])] : items.filter(x => x !== id);
// A versão anterior distinguia competências principais e secundárias.
// Todas são agora associações equivalentes; a migração ocorre ao editar a prova.
const aspectCompetencyIds = aspect => [...new Set([
  ...arr(aspect.competencyIds),
  ...arr(aspect.competencyLinks).map(link => link.competencyId)
].filter(Boolean))];
function normalizeExam(exam) {
  const normalized=clone(exam);
  normalized.subcriteria=arr(normalized.subcriteria).map(sub=>({...sub,aspects:arr(sub.aspects).map(aspect=>{
    const {competencyLinks, ...other}=aspect;
    return {...other,competencyIds:aspectCompetencyIds(aspect)};
  })}));
  return normalized;
}
function Expandable({children, className='', initiallyOpen=false}) {
  const [open,setOpen]=useState(initiallyOpen);
  return <details className={className} open={open} onToggle={e=>setOpen(e.currentTarget.open)}>{children}</details>;
}
const nameList = (ids, records) => arr(ids).map(id => records.find(r => r.id===id)?.name || `Não encontrado (${id})`);
const typeName = (exam, db) => db.examTypes.find(t => t.key === exam.typeKey)?.name || 'Não informado';
const countryName = exam => exam.referenceCountry?.trim() || 'País não informado';
const scoreSum = aspects => arr(aspects).reduce((sum, a) => sum + Number(a.maxScore || 0), 0);
const TABS = [
  {id:'details', label:'Detalhes da prova'},
  {id:'technical', label:'Fatores técnicos'},
  {id:'cis', label:'CIS mapeado'},
  {id:'analysis', label:'Análise técnica'}
];

function newExam(db) {
  return {
    id:uid(), title:'', module:'', description:'', referenceCountry:'',
    editionId:db.editions[0]?.id || '', typeKey:db.examTypes[0]?.key || '',
    occupationId:db.occupations[0]?.id || '', maxScore:0,
    technicalDetails:'', technicalChallenges:[], areaIds:[], competencyIds:[],
    documentUrl:'', subcriteria:[], sourceExamId:null, version:1, _new:true
  };
}

function TabNavigation({tab,setTab,exam}) {
  return <nav className="exam-tabs" aria-label="Seções da prova">
    {TABS.map(t=><button key={t.id} type="button" className={tab===t.id?'active':''} onClick={()=>setTab(t.id)} aria-current={tab===t.id?'page':undefined}>
      {t.label}{t.id==='cis' && <small>{aspectList(exam).length}</small>}
    </button>)}
  </nav>;
}

// O input nativo continua presente para suporte a teclado, leitores de tela e formulários.
// Somente a apresentação visual é transformada em um cartão selecionável.
function MultiCheck({items, selected=[], onToggle, empty}) {
  return <div className="multi-list">{items.map(item=>{
    const checked=selected.includes(item.id);
    return <label className={`check-row check-card${checked?' is-selected':''}`} key={item.id}>
      <input className="check-card-input" type="checkbox" checked={checked} onChange={e=>onToggle(item.id,e.target.checked)}/>
      <span className="check-card-name">{item.name}</span>
      <span className="check-card-indicator" aria-hidden="true">{checked&&<Check size={13} strokeWidth={3}/>}</span>
    </label>;
  })}{!items.length&&<small className="exam-mapping-empty">{empty||'Nenhum item disponível.'}</small>}</div>;
}

// Grupos independentes: nenhuma seleção cria rótulos <label> aninhados.
function MappingGroup({title,subtitle,items,selected=[],onToggle,empty,kind='areas'}) {
  const isAreas=kind==='areas';
  const Icon=isAreas?Layers3:ListChecks;
  return <fieldset className={`exam-mapping-group exam-mapping-group--${kind}`}>
    <legend><Icon size={15} aria-hidden="true"/> {title}</legend>
    <div className="exam-mapping-group-meta">
      <span>{subtitle}</span>
      <span className="exam-mapping-counter">{selected.length} de {items.length} selecionada{selected.length===1?'':'s'}</span>
    </div>
    <MultiCheck items={items} selected={selected} onToggle={onToggle} empty={empty}/>
  </fieldset>;
}

function RelationsView({aspect, db}) {
  const regions=nameList(aspect.areaIds,db.occupationAreas);
  const skills=nameList(aspectCompetencyIds(aspect),db.competencies);
  return <div className="exam-relation-grid">
    <div className="exam-relation-block exam-relation-block--areas">
      <div className="exam-relation-heading"><Layers3 size={14} aria-hidden="true"/><strong>Áreas da ocupação</strong></div>
      <div className="tags">{regions.map((name,i)=><Badge key={i} tone="blue">{name}</Badge>)}{!regions.length&&<span className="muted">Sem área vinculada</span>}</div>
    </div>
    <div className="exam-relation-block exam-relation-block--competencies">
      <div className="exam-relation-heading"><ListChecks size={14} aria-hidden="true"/><strong>Competências relacionadas</strong></div>
      <div className="tags">{skills.map((name,i)=><Badge key={i}>{name}</Badge>)}{!skills.length&&<span className="muted">Sem competência vinculada</span>}</div>
    </div>
  </div>;
}

function ExamView({exam,db,onBack,onEdit,onAdapt,onDelete}) {
  const [tab,setTab]=useState('details');
  const aspects=aspectList(exam);
  const mapped=aspects.filter(a=>arr(a.areaIds).length||aspectCompetencyIds(a).length).length;
  const total=scoreSum(aspects);
  return <>
    <div className="exam-view-top">
      <Button variant="ghost" onClick={onBack}><ArrowLeft size={16}/> Voltar às provas</Button>
      <div className="inline-actions">
        <Button variant="subtle" onClick={onAdapt}><Copy size={15}/> Criar adaptação</Button>
        <Button onClick={onEdit}><Pencil size={15}/> Editar prova</Button>
        <Button variant="danger-ghost" onClick={onDelete}><Trash2 size={15}/> Excluir prova</Button>
      </div>
    </div>
    <section className="panel exam-workspace">
      <header className="exam-workspace-head">
        <div className="tags"><Badge tone="blue">{exam.module||'Sem módulo'}</Badge><Badge>{typeName(exam,db)}</Badge>{exam.sourceExamId&&<Badge tone="amber">Adaptada</Badge>}</div>
        <h1>{exam.title}</h1>
        <p>{lookup(db.editions,exam.editionId)} · {countryName(exam)}</p>
        <p className="exam-view-description">{exam.description||'Descrição não cadastrada.'}</p>
      </header>
      <TabNavigation tab={tab} setTab={setTab} exam={exam}/>
      {tab==='details'&&<div className="exam-section">
        <div className="exam-metric-grid">
          <div><small>Módulo</small><strong>{exam.module||'—'}</strong></div>
          <div><small>Pontuação máxima</small><strong>{points(exam.maxScore)} pts</strong></div>
          <div><small>Edição de referência</small><strong>{lookup(db.editions,exam.editionId)}</strong></div>
          <div><small>País de referência</small><strong>{countryName(exam)}</strong></div>
        </div>
        <div className="exam-information"><h3>Descrição</h3><p>{exam.description||'Não cadastrada.'}</p></div>
        <div className="exam-information"><h3>Tipo de prova</h3><p>{typeName(exam,db)}</p></div>
        {exam.sourceExamId&&<div className="exam-information"><h3>Prova original</h3><p>{lookup(db.exams,exam.sourceExamId,'title')}</p></div>}
        <div className="exam-information"><h3>Documento de referência</h3>
          {exam.documentUrl?<a className="doc-link" href={exam.documentUrl} rel="noopener noreferrer" target="_blank"><Link2 size={15}/> Abrir documento da prova</a>:<p>Link não cadastrado.</p>}
        </div>
      </div>}
      {tab==='technical'&&<div className="exam-section">
        <div className="exam-information"><h3>Desafios técnicos</h3>{arr(exam.technicalChallenges).length?<ul className="exam-challenges">{arr(exam.technicalChallenges).map((t,i)=><li key={i}>{t}</li>)}</ul>:<p>Nenhum desafio cadastrado.</p>}</div>
        <div className="exam-information"><h3>Detalhes técnicos</h3><p className="exam-preserve-lines">{exam.technicalDetails||'Não cadastrados.'}</p></div>
        <div className="exam-information"><h3>Áreas da ocupação trabalhadas</h3><div className="tags">{nameList(exam.areaIds,db.occupationAreas).map((n,i)=><Badge key={i} tone="blue">{n}</Badge>)}{!arr(exam.areaIds).length&&<span className="muted">Nenhuma área relacionada.</span>}</div></div>
        <div className="exam-information"><h3>Competências técnicas relacionadas</h3><div className="tags">{nameList(exam.competencyIds,db.competencies).map((n,i)=><Badge key={i}>{n}</Badge>)}{!arr(exam.competencyIds).length&&<span className="muted">Nenhuma competência relacionada.</span>}</div></div>
      </div>}
      {tab==='cis'&&<div className="exam-section">
        <div className="exam-section-summary"><div><h3>Estrutura CIS</h3><p>Consulte os subcritérios e expanda somente o que precisar.</p></div><div className="mapping-stats"><span>{arr(exam.subcriteria).length} subcritérios</span><span>{aspects.length} aspectos</span><span>{points(total)} pts</span></div></div>
        {!arr(exam.subcriteria).length&&<Empty title="CIS ainda não cadastrado" subtitle="Entre no modo de edição para adicionar subcritérios e aspectos."/>}
        {arr(exam.subcriteria).map(s=><details className="exam-accordion" key={s.id}><summary><span><strong>{s.code} · {s.title||'Subcritério sem título'}</strong><small className="exam-subcriterion-meta"><span>{arr(s.aspects).length} aspectos</span><span>{points(scoreSum(s.aspects))} pts</span></small></span><ChevronDown size={18} className="accordion-chevron" aria-hidden="true"/></summary>
          <div className="exam-accordion-body">{arr(s.aspects).map((a,i)=><div key={a.id} className="exam-aspect-line"><div><strong>{i+1}. {a.description||'Aspecto sem descrição'}</strong><div className="exam-aspect-subline"><span className={`cis-method-badge ${a.method==='J'?'is-judgement':'is-measurement'}`}>{a.method==='J'?'J · Judgement':'M · Measurement'}</span><small>WSOS {a.wsosSection||'—'}</small></div>{a.considerations&&<p>{a.considerations}</p>}{a.method==='J'&&Object.values(a.judgement||{}).some(Boolean)&&<div className="exam-judgement">{[0,1,2,3].map(k=><small key={k}><b>{k}:</b> {a.judgement?.[k]||'—'}</small>)}</div>}</div><b>{points(a.maxScore)}</b></div>)}</div>
        </details>)}
        {!!aspects.length&&Math.abs(total-Number(exam.maxScore))>0.00001&&<p className="note warning">Os aspectos somam {points(total)} pontos, mas a prova possui {points(exam.maxScore)} pontos. Confira o cadastro.</p>}
      </div>}
      {tab==='analysis'&&<div className="exam-section">
        <div className="exam-section-summary"><div><h3>Correlações técnicas dos aspectos</h3><p>WSOS oficial preservado; áreas e competências são classificações independentes.</p></div><div className="mapping-stats"><span>{mapped}/{aspects.length} aspectos com relação</span></div></div>
        {!aspects.length&&<Empty title="Nenhum aspecto disponível" subtitle="Cadastre os aspectos na aba CIS para mapear suas relações."/>}
        <div className="exam-analysis-groups">
        {arr(exam.subcriteria).map(s=><Expandable className="exam-accordion exam-analysis-group" key={s.id} initiallyOpen><summary><span><strong>{s.code} · {s.title||'Subcritério'}</strong><small className="exam-subcriterion-meta"><span>{arr(s.aspects).length} aspectos</span><span>{points(scoreSum(s.aspects))} pts</span></small></span><ChevronDown size={18} className="accordion-chevron" aria-hidden="true"/></summary>
          <div className="exam-accordion-body">{arr(s.aspects).map(a=><div className="exam-analysis-record" key={a.id}>
            <div className="exam-analysis-record-title"><strong>{a.description||'Aspecto sem descrição'}</strong><Badge>WSOS {a.wsosSection||'—'}</Badge></div>
            <RelationsView aspect={a} db={db}/>
          </div>)}</div>
        </Expandable>)}
        </div>
      </div>}
    </section>
  </>;
}

function ExamEditor({source,db,onClose,onSave}) {
  const [form,setForm]=useState(()=>({...normalizeExam(source),areaIds:arr(source.areaIds),competencyIds:arr(source.competencyIds)}));
  const [tab,setTab]=useState('details');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [filterUnmapped,setFilterUnmapped]=useState(false);
  const [searchAspect,setSearchAspect]=useState('');
  const [selectedTargets,setSelectedTargets]=useState([]);
  const [pickedRelation,setPickedRelation]=useState(null);
  const [sourceSelection,setSourceSelection]=useState({kind:null,ids:[]});
  const [sourceAnchor,setSourceAnchor]=useState({kind:null,id:null});
  const [dragRelation,setDragRelation]=useState(null);
  const [hoverTarget,setHoverTarget]=useState(null);
  const [mapMessage,setMapMessage]=useState('');
  const [areaSearch,setAreaSearch]=useState('');
  const [competencySearch,setCompetencySearch]=useState('');
  const set=(field,value)=>setForm(f=>({...f,[field]:value}));
  const allAreas=db.occupationAreas.filter(a=>a.occupationId===form.occupationId);
  const allComps=db.competencies.filter(c=>!c.occupationId||c.occupationId===form.occupationId);
  const areas=allAreas.filter(a=>arr(form.areaIds).includes(a.id));
  const competencies=allComps.filter(c=>arr(form.competencyIds).includes(c.id));
  const wsos=db.wsos.filter(w=>!w.occupationId||w.occupationId===form.occupationId);
  const allAspects=aspectList(form);
  const n=allAspects.length;
  const total=scoreSum(allAspects);
  const linked=allAspects.filter(a=>arr(a.areaIds).length||aspectCompetencyIds(a).length).length;
  const updateSub=(i,edit)=>setForm(f=>({...f,subcriteria:arr(f.subcriteria).map((s,k)=>k===i?{...s,...edit}:s)}));
  const updateAspect=(i,j,edit)=>setForm(f=>({...f,subcriteria:arr(f.subcriteria).map((s,k)=>k===i?{...s,aspects:arr(s.aspects).map((a,l)=>l===j?{...a,...edit}:a)}:s)}));
    const changeSelected=(field,id,checked)=>setForm(f=>{
    const selection=toggle(arr(f[field]),id,checked);
    const subcriteria=checked?f.subcriteria:arr(f.subcriteria).map(s=>({...s,aspects:arr(s.aspects).map(a=>field==='areaIds'?{...a,areaIds:arr(a.areaIds).filter(x=>x!==id)}:{...a,competencyIds:aspectCompetencyIds(a).filter(x=>x!==id)})}));
    return {...f,[field]:selection,subcriteria};
  });
  const addSub=()=>set('subcriteria',[...arr(form.subcriteria),{id:uid(),code:`${form.module?.replace(/^M/,'')||'A'}${arr(form.subcriteria).length+1}`,title:'',aspects:[]}]);
  const addAspect=i=>updateSub(i,{aspects:[...arr(form.subcriteria[i].aspects),{id:uid(),description:'',method:'M',maxScore:0,wsosSection:'',considerations:'',judgement:{0:'',1:'',2:'',3:''},areaIds:[],competencyIds:[]}]});
  const targetKeys=arr(form.subcriteria).flatMap(sub=>arr(sub.aspects).map(a=>aspectKey(sub.id,a.id)));
  const targetsSelected=selectedTargets.filter(key=>targetKeys.includes(key));
  const selectTarget=(key,checked)=>setSelectedTargets(previous=>checked?[...new Set([...previous,key])]:previous.filter(k=>k!==key));
  const applyRelation=(relation,targetKey)=>{
    if(!relation||!['area','competency'].includes(relation.kind))return;
    const available=(relation.kind==='area'?areas:competencies);
    const validIds=new Set(available.map(item=>item.id));
    const ids=[...new Set(arr(relation.ids).length?relation.ids:relation.id?[relation.id]:[])].filter(id=>validIds.has(id));
    if(!ids.length)return;
    const keys=dropTargets(targetKey,targetsSelected);
    setForm(previous=>({...previous,subcriteria:updateAspectRelationshipsBatch(previous.subcriteria,keys,{kind:relation.kind,ids})}));
    setMapMessage(`${ids.length} ${relation.kind==='area'?'área':'competência'}${ids.length===1?'':'s'} vinculada${ids.length===1?'':'s'} a ${keys.length} aspecto${keys.length===1?'':'s'}. Salve a prova para persistir.`);
    setPickedRelation(null);
    setHoverTarget(null);
  };
  const removeRelation=(key,kind,id)=>{
    setForm(previous=>({...previous,subcriteria:updateAspectRelationships(previous.subcriteria,[key],{kind,id,operation:'remove'})}));
    setMapMessage('Vínculo removido. Salve a prova para persistir.');
  };
  const chooseSource=(kind,id,orderedIds,mode)=>{
    const next=selectSourceRelations(sourceSelection,{
      kind,id,mode,orderedIds,anchorId:sourceAnchor.kind===kind?sourceAnchor.id:null
    });
    setSourceSelection(next);
    if(mode!=='range')setSourceAnchor({kind,id});
    setPickedRelation(next.ids.length?next:null);
    setMapMessage(next.ids.length
      ? `${next.ids.length} item(ns) de ${kind==='area'?'Áreas':'Competências'} selecionado(s). Arraste para os aspectos ou clique em um destino.`
      : 'Seleção de origem limpa.');
  };
  const startDrag=(event,kind,id)=>{
    const bundle=dragSourceRelations(sourceSelection,kind,id);
    event.dataTransfer.setData('text/plain',JSON.stringify({...bundle,source:'stm-technical-mapping'}));
    event.dataTransfer.effectAllowed='copy';
    setDragRelation(bundle);
    setSourceSelection(bundle);
    setPickedRelation(null);
    setMapMessage(`Arrastando ${bundle.ids.length} ${bundle.kind==='area'?'área(s)':'competência(s)'}.`);
  };
  const handleDrop=(event,key)=>{
    event.preventDefault();
    let relation=dragRelation;
    try{
      const payload=JSON.parse(event.dataTransfer.getData('text/plain'));
      if(payload.source==='stm-technical-mapping')relation=payload;
    }catch{}
    if(relation)applyRelation(relation,key);
    setDragRelation(null);setHoverTarget(null);
  };
  const isDirty=JSON.stringify(form)!==JSON.stringify({...normalizeExam(source),areaIds:arr(source.areaIds),competencyIds:arr(source.competencyIds)});
  const leave=()=>{if(isDirty&&!window.confirm('Descartar as alterações não salvas nesta prova?'))return;onClose()};
  async function submit(e){
    e.preventDefault();setMessage('');
    if(!form.title.trim()){setTab('details');setMessage('Informe o título da prova antes de salvar.');return}
    setBusy(true);
    try{
      const clean={...form,maxScore:Number(form.maxScore),technicalChallenges:arr(form.technicalChallenges).map(x=>x.trim()).filter(Boolean)};
      delete clean._new;
      await onSave(clean);
    }catch(err){setMessage(err?.message||'Não foi possível salvar a prova. Confira os campos.')}
    finally{setBusy(false)}
  }
  return <>
    <section className="panel exam-workspace">
      <header className="exam-workspace-head editor-head"><div className="eyebrow">{source._new?'NOVA PROVA':'EDIÇÃO DA PROVA'}</div><h1>{form.title||'Nova prova'}</h1><p>Organize os dados por assunto. Não é necessário preencher todas as abas para navegar entre elas.</p></header>
      <TabNavigation tab={tab} setTab={setTab} exam={form}/>
      <form onSubmit={submit} noValidate>
        {tab==='details'&&<div className="exam-section exam-detail-fields">
          <Field label="Título da prova"><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Ex.: Mobile Conference"/></Field>
          <Field label="Módulo"><input value={form.module||''} onChange={e=>set('module',e.target.value)} placeholder="Ex.: MB"/></Field>
          <Field label="Pontuação máxima"><input type="number" min="0" step="any" value={form.maxScore} onChange={e=>set('maxScore',e.target.value)}/></Field>
          <Field label="Edição de referência"><select value={form.editionId||''} onChange={e=>set('editionId',e.target.value)}><option value="">Sem edição</option>{db.editions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="País de referência"><input value={form.referenceCountry||''} onChange={e=>set('referenceCountry',e.target.value)} placeholder="Ex.: China"/></Field>
          <Field label="Tipo de prova"><select value={form.typeKey} onChange={e=>set('typeKey',e.target.value)}>{db.examTypes.map(t=><option key={t.id} value={t.key}>{t.name}</option>)}</select></Field>
          <div className="exam-detail-full"><Field label="Descrição"><textarea rows={3} value={form.description||''} onChange={e=>set('description',e.target.value)} placeholder="Descrição geral da prova"/></Field></div>
          <div className="exam-detail-full"><Field label="Documento da prova (link de referência)"><input type="url" value={form.documentUrl||''} onChange={e=>set('documentUrl',e.target.value)} placeholder="https://..."/><small className="exam-field-warning">Nesta versão sem login, não grave links confidenciais.</small></Field></div>
          <div className="exam-detail-full"><Field label="Prova original (se adaptada)"><select value={form.sourceExamId||''} onChange={e=>set('sourceExamId',e.target.value||null)}><option value="">Sem prova de origem</option>{db.exams.filter(e=>e.id!==form.id).map(e=><option key={e.id} value={e.id}>{e.module} · {e.title}</option>)}</select></Field></div>
        </div>}
        {tab==='technical'&&<div className="exam-section form-grid exam-fields exam-technical-fields">
          <LineEditor label="Desafios técnicos (um por linha)" value={arr(form.technicalChallenges)} onChange={v=>set('technicalChallenges',v)}/>
          <Field label="Detalhes técnicos"><textarea rows={4} value={form.technicalDetails||''} onChange={e=>set('technicalDetails',e.target.value)}/></Field>
          <div className="mapping-intro"><strong>Escopo técnico da prova</strong><p>Escolha as áreas e as competências trabalhadas. O relacionamento com cada aspecto será definido na aba Análise técnica.</p></div>
          <MappingGroup kind="areas" title="Áreas da ocupação" subtitle="Áreas abordadas nesta prova" items={allAreas} selected={arr(form.areaIds)} onToggle={(id,checked)=>changeSelected('areaIds',id,checked)} empty="Cadastre áreas nos Cadastros de apoio."/>
          <MappingGroup kind="competencies" title="Competências técnicas relacionadas" subtitle="Competências desenvolvidas pela prova" items={allComps} selected={arr(form.competencyIds)} onToggle={(id,checked)=>changeSelected('competencyIds',id,checked)} empty="Cadastre competências na página Competências."/>
        </div>}
        {tab==='cis'&&<div className="exam-section exam-cis-editor">
          <CisInlineLoader exam={form} hasExecutions={db.executions.some(e=>e.examId===form.id)} onApply={(subcriteria,module,syncScore)=>setForm(f=>({...f,subcriteria,...(syncScore?{maxScore:module.totalScore}:{})}))}/>
          <div className="exam-section-summary"><div><h3>Subcritérios e aspectos CIS</h3><p>{n} aspectos · {points(total)} / {points(form.maxScore)} pontos</p></div><Button variant="subtle" onClick={addSub}><Plus size={15}/> Novo subcritério</Button></div>
          {!arr(form.subcriteria).length&&<Empty title="Ainda sem CIS" subtitle="Adicione subcritérios para cadastrar aspectos ou prepare a estrutura para uma futura importação."/>}
          {arr(form.subcriteria).map((s,i)=><Expandable className="exam-accordion edit-accordion" key={s.id} initiallyOpen><summary><span><strong>{s.code} · {s.title||'Subcritério sem título'}</strong><small className="exam-subcriterion-meta"><span>{arr(s.aspects).length} aspectos</span><span>{points(scoreSum(s.aspects))} pts</span></small></span><ChevronDown size={18} className="accordion-chevron" aria-hidden="true"/></summary>
            <div className="exam-accordion-body">
              <div className="inline-form"><input className="code-input" aria-label="Código do subcritério" value={s.code||''} onChange={e=>updateSub(i,{code:e.target.value})}/><input aria-label="Título do subcritério" value={s.title||''} onChange={e=>updateSub(i,{title:e.target.value})}/><button type="button" className="icon-button danger" title="Excluir subcritério" onClick={()=>{if(window.confirm('Remover subcritério e seus aspectos?'))set('subcriteria',arr(form.subcriteria).filter((_,k)=>k!==i))}}><Trash2 size={16}/></button></div>
              {arr(s.aspects).map((a,j)=><Expandable className="exam-aspect-edit" key={a.id} initiallyOpen><summary>
                <div className="exam-aspect-summary-content">
                  <strong className="exam-aspect-title">{j+1}. {a.description||'Novo aspecto'}</strong>
                  <div className="exam-aspect-subline"><span className={`cis-method-badge ${a.method==='J'?'is-judgement':'is-measurement'}`}>{a.method==='J'?'J · Judgement':'M · Measurement'}</span><small>WSOS {a.wsosSection||'—'}</small><small>{points(a.maxScore)} pts</small></div>
                </div>
                <ChevronDown size={17} className="accordion-chevron" aria-hidden="true"/>
              </summary><div className="exam-aspect-fields">
                <Field label="Descrição"><textarea rows={2} value={a.description||''} onChange={e=>updateAspect(i,j,{description:e.target.value})}/></Field>
                <div className="grid-three"><Field label="Método"><select value={a.method||'M'} onChange={e=>updateAspect(i,j,{method:e.target.value})}><option value="M">Measurement</option><option value="J">Judgement</option></select></Field><Field label="Pontuação máxima"><input type="number" min="0" step="any" value={a.maxScore} onChange={e=>updateAspect(i,j,{maxScore:Number(e.target.value)})}/></Field><Field label="WSOS"><select value={a.wsosSection||''} onChange={e=>updateAspect(i,j,{wsosSection:e.target.value})}><option value="">Não classificado</option>{wsos.map(w=><option key={w.id} value={w.code}>{w.code} · {w.name}</option>)}</select></Field></div>
                <Field label="Considerações de correção"><textarea rows={2} value={a.considerations||''} onChange={e=>updateAspect(i,j,{considerations:e.target.value})}/></Field>
                {a.method==='J'&&<div className="judge-grid">{[0,1,2,3].map(level=><Field key={level} label={`Julgamento ${level}`}><input value={a.judgement?.[level]||''} onChange={e=>updateAspect(i,j,{judgement:{...a.judgement,[level]:e.target.value}})}/></Field>)}</div>}
                <div className="right"><Button variant="danger-ghost" onClick={()=>{if(window.confirm('Remover este aspecto?'))updateSub(i,{aspects:arr(s.aspects).filter((_,k)=>k!==j)})}}>Remover aspecto</Button></div>
              </div></Expandable>)}
              <div className="right"><Button variant="subtle" onClick={()=>addAspect(i)}><Plus size={15}/> Adicionar aspecto</Button></div>
            </div>
          </Expandable>)}
          {!!n&&Math.abs(total-Number(form.maxScore))>0.00001&&<p className="note warning">Soma dos aspectos ({points(total)}) diferente da pontuação máxima da prova ({points(form.maxScore)}).</p>}
        </div>}
        {tab==='analysis'&&<div className="exam-section exam-analysis-editor">
          <div className="exam-section-summary"><div><h3>Análise técnica e correlação</h3><p>Selecione várias áreas ou competências com Shift ou + e arraste o conjunto. Você também pode marcar vários aspectos à esquerda para vincular todos de uma vez.</p></div><div className="mapping-stats"><span>{linked}/{n} relacionados</span></div></div>
          {!n&&<Empty title="Nenhum aspecto para relacionar" subtitle="Cadastre os aspectos na aba CIS antes de iniciar esta análise."/>}
          {!!n&&<div className="technical-mapper">
            <div className="technical-mapper-targets">
              <div className="technical-mapper-toolbar">
                <input type="search" aria-label="Buscar aspectos CIS" value={searchAspect} onChange={e=>{setSearchAspect(e.target.value);setSelectedTargets([])}} placeholder="Buscar aspecto por descrição ou código..."/>
                <label className="technical-mapper-filter"><input type="checkbox" checked={filterUnmapped} onChange={e=>{setFilterUnmapped(e.target.checked);setSelectedTargets([])}}/> Apenas sem mapeamento</label>
                {targetsSelected.length>0&&<button type="button" className="technical-mapper-clear" onClick={()=>setSelectedTargets([])}>Limpar seleção ({targetsSelected.length})</button>}
              </div>
              <p className="technical-mapper-hint"><MousePointer2 size={14}/> Marque vários aspectos para aplicar o conjunto de relações, ou solte diretamente em um único aspecto.</p>
              <div className="technical-mapper-groups">
              {arr(form.subcriteria).map((sub,i)=>{
                const visible=arr(sub.aspects).map((a,j)=>({a,j,key:aspectKey(sub.id,a.id)})).filter(({a})=>(!filterUnmapped||(arr(a.areaIds).length===0&&aspectCompetencyIds(a).length===0))&&`${sub.code} ${sub.title} ${a.description}`.toLowerCase().includes(searchAspect.toLowerCase()));
                if(!visible.length)return null;
                const groupKeys=visible.map(item=>item.key);
                const allSelected=groupKeys.every(key=>targetsSelected.includes(key));
                return <section className="technical-mapper-subcriterion" key={sub.id} aria-label={`${sub.code} ${sub.title||'Subcritério'}`}>
                  <div className="technical-mapper-subhead"><div><strong>{sub.code} · {sub.title||'Subcritério'}</strong><small>{visible.length} aspectos · {points(scoreSum(sub.aspects))} pts</small></div><label className="technical-mapper-select-all"><input type="checkbox" checked={allSelected} onChange={e=>setSelectedTargets(previous=>e.target.checked?[...new Set([...previous,...groupKeys])]:previous.filter(key=>!groupKeys.includes(key)))}/> Selecionar exibidos</label></div>
                  <div className="technical-mapper-aspects">{visible.map(({a,j,key})=>{
                    const selected=targetsSelected.includes(key);
                    const isOver=hoverTarget===key;
                    const areaIds=arr(a.areaIds);
                    const competencyIds=aspectCompetencyIds(a);
                    return <div key={key} className={`technical-mapper-aspect${selected?' is-selected':''}${isOver?' is-over':''}${pickedRelation?' is-pickable':''}`}
                      onDragOver={e=>{if(dragRelation){e.preventDefault();e.dataTransfer.dropEffect='copy';setHoverTarget(key);}}}
                      onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHoverTarget(current=>current===key?null:current)}}
                      onDrop={e=>handleDrop(e,key)}>
                      <div className="technical-mapper-aspect-top">
                        <label className="technical-mapper-aspect-selector"><input type="checkbox" checked={selected} aria-label={`Selecionar aspecto ${j+1} de ${sub.code}`} onChange={e=>selectTarget(key,e.target.checked)}/></label>
                        <button type="button" className="technical-mapper-aspect-action" onClick={()=>{if(pickedRelation)applyRelation(pickedRelation,key);else selectTarget(key,!selected)}} title={pickedRelation?'Vincular item escolhido':'Selecionar aspecto'}>
                          <strong>{j+1}. {a.description||'Aspecto sem descrição'}</strong>
                          <span><span className={`cis-method-badge ${a.method==='J'?'is-judgement':'is-measurement'}`}>{a.method==='J'?'J':'M'}</span> WSOS {a.wsosSection||'—'} · {points(a.maxScore)} pts</span>
                        </button>
                      </div>
                      <div className="technical-mapper-linked">
                        <div className="technical-mapper-linked-group is-area">
                          <div className="technical-mapper-linked-head"><Layers3 size={13} aria-hidden="true"/><strong>Áreas da ocupação</strong><span>{areaIds.length}</span></div>
                          <div className="technical-mapper-linked-items">
                            {areaIds.map(id=><button key={`area-${id}`} type="button" className="technical-mapper-chip is-area" title="Remover vínculo da área" aria-label={`Remover área ${areas.find(item=>item.id===id)?.name||id}`} onClick={()=>removeRelation(key,'area',id)}>{areas.find(item=>item.id===id)?.name||db.occupationAreas.find(item=>item.id===id)?.name||id}<X size={12}/></button>)}
                            {!areaIds.length&&<small>Arraste uma área para este aspecto</small>}
                          </div>
                        </div>
                        <div className="technical-mapper-linked-group is-competency">
                          <div className="technical-mapper-linked-head"><ListChecks size={13} aria-hidden="true"/><strong>Competências relacionadas</strong><span>{competencyIds.length}</span></div>
                          <div className="technical-mapper-linked-items">
                            {competencyIds.map(id=><button key={`comp-${id}`} type="button" className="technical-mapper-chip" title="Remover vínculo da competência" aria-label={`Remover competência ${competencies.find(item=>item.id===id)?.name||id}`} onClick={()=>removeRelation(key,'competency',id)}>{competencies.find(item=>item.id===id)?.name||db.competencies.find(item=>item.id===id)?.name||id}<X size={12}/></button>)}
                            {!competencyIds.length&&<small>Arraste uma competência para este aspecto</small>}
                          </div>
                        </div>
                      </div>
                    </div>;
                  })}</div>
                </section>;
              })}
              </div>
            </div>
            <aside className="technical-mapper-palette" aria-label="Itens disponíveis para relacionar">
              <div className="technical-mapper-palette-head"><strong>Biblioteca de relações</strong><small>Use <b>Shift+clique</b> para selecionar um intervalo ou <b>+</b> para marcar vários itens do mesmo grupo. Arraste-os juntos para um ou mais aspectos.</small></div>
              {[{kind:'area',title:'Áreas da ocupação',icon:Layers3,items:areas,search:areaSearch,setSearch:setAreaSearch,empty:'Selecione áreas na aba Fatores técnicos.'},{kind:'competency',title:'Competências relacionadas',icon:ListChecks,items:competencies,search:competencySearch,setSearch:setCompetencySearch,empty:'Selecione competências na aba Fatores técnicos.'}].map(group=>{
                const Icon=group.icon;
                return <section className="technical-mapper-palette-group" key={group.kind}>
                  <div className="technical-mapper-palette-title"><Icon size={16}/><strong>{group.title}</strong><span>{group.items.length}</span></div>
                  <input type="search" aria-label={`Buscar ${group.title.toLowerCase()}`} placeholder="Filtrar itens..." value={group.search} onChange={e=>group.setSearch(e.target.value)}/>
                  <div className="technical-mapper-palette-list">
                    {group.items.filter(item=>item.name.toLowerCase().includes(group.search.toLowerCase())).map((item,idx,visibleItems)=>{
                      const active=sourceSelection.kind===group.kind&&sourceSelection.ids.includes(item.id);
                      return <div key={item.id} className={`technical-mapper-source${active?' is-active':''}`}>
                        <button type="button" className="technical-mapper-source-main" draggable
                          title="Clique para escolher, Shift+clique para selecionar intervalo, ou arraste os selecionados"
                          aria-pressed={active}
                          onClick={e=>chooseSource(group.kind,item.id,visibleItems.map(entry=>entry.id),e.shiftKey?'range':'single')}
                          onDragStart={e=>startDrag(e,group.kind,item.id)}
                          onDragEnd={()=>{setDragRelation(null);setHoverTarget(null)}}>
                          <GripVertical size={15} className="technical-mapper-grip"/><span>{item.name}</span>
                        </button>
                        <button type="button" className="technical-mapper-source-plus"
                          title={active?'Retirar da seleção':'Adicionar à seleção múltipla'}
                          aria-label={`${active?'Retirar':'Adicionar'} ${item.name} ${active?'da':'à'} seleção de ${group.title.toLowerCase()}`}
                          aria-pressed={active}
                          onClick={()=>chooseSource(group.kind,item.id,visibleItems.map(entry=>entry.id),'toggle')}>
                          {active?<Check size={14} strokeWidth={2.6}/>:<Plus size={14} strokeWidth={2.6}/>}</button>
                      </div>;
                    })}
                    {!group.items.length&&<small className="muted">{group.empty}</small>}
                  </div>
                  {sourceSelection.kind===group.kind&&sourceSelection.ids.length>0&&<div className="technical-mapper-source-selection">
                    <strong>{sourceSelection.ids.length} selecionado{sourceSelection.ids.length===1?'':'s'}</strong>
                    <button type="button" onClick={()=>{setSourceSelection({kind:null,ids:[]});setPickedRelation(null)}}>Limpar</button>
                  </div>}
                </section>;
              })}
              {pickedRelation&&<button type="button" className="technical-mapper-clear-pick" onClick={()=>setPickedRelation(null)}>Cancelar escolha</button>}
              <p className="technical-mapper-status" role="status">{mapMessage||'O WSOS e a nota original dos aspectos não são alterados.'}</p>
            </aside>
          </div>}
        </div>}
        {!!message&&<p className="exam-save-error" role="alert">{message}</p>}
        <footer className="exam-savebar"><span>{isDirty?'Alterações ainda não salvas':'Sem alterações pendentes'}</span><div className="inline-actions"><Button variant="ghost" onClick={leave}>Cancelar</Button><Button type="submit" disabled={busy}><Save size={16}/>{busy?'Salvando...':'Salvar prova'}</Button></div></footer>
      </form>
    </section>
  </>;
}


// As opções recorrentes usam cartões com marcação, mantendo os selects
// somente para edição e país. Tipos e módulos são de seleção única;
// áreas permitem múltiplas relações em conjunto.
function CatalogPills({label,subtitle,items,value,onChange,multiple=false,allLabel='Todas',kind='types'}) {
  const selected=multiple?arr(value):[value];
  const noneSelected=multiple?!selected.length:!value||value==='all';
  const count=multiple?selected.length:(noneSelected?0:1);
  const Icon=kind==='areas'?Layers3:kind==='module'?FileSpreadsheet:ListChecks;
  const toggleValue=(id,active)=>onChange(multiple?(active?selected.filter(x=>x!==id):[...selected,id]):(active?'all':id));
  return <fieldset className={`exam-catalog-filter-group exam-catalog-filter-group--${kind}`}>
    <legend><Icon size={15} aria-hidden="true"/> {label}</legend>
    <div className="exam-catalog-filter-head">
      <span>{subtitle}</span>
      <span className="exam-catalog-filter-count">{count} de {items.length} {kind==='areas'?(count===1?'selecionada':'selecionadas'):(count===1?'selecionado':'selecionados')}</span>
    </div>
    <div className="exam-catalog-filter-pills" role="group" aria-label={`Opções de ${label.toLowerCase()}`}>
      <button type="button" className={`exam-catalog-pill${noneSelected?' is-active':''}`} aria-pressed={noneSelected}
        onClick={()=>onChange(multiple?[]:'all')}>
        <span>{allLabel}</span><span className="exam-catalog-pill-check" aria-hidden="true">{noneSelected&&<Check size={13} strokeWidth={3}/>}</span>
      </button>
      {items.map(item=>{
        const active=selected.includes(item.id);
        return <button type="button" className={`exam-catalog-pill${active?' is-active':''}`} key={item.id}
          aria-pressed={active} onClick={()=>toggleValue(item.id,active)}>
          <span>{item.label}</span><span className="exam-catalog-pill-check" aria-hidden="true">{active&&<Check size={13} strokeWidth={3}/>}</span>
        </button>;
      })}
    </div>
  </fieldset>;
}

export default function Exams({db,saveRecord,deleteRecord}) {
  const [filter,setFilter]=useState('');
  const [typeFilter,setTypeFilter]=useState('all');
  const [areaFilters,setAreaFilters]=useState([]);
  const [moduleFilter,setModuleFilter]=useState('all');
  const [editionFilter,setEditionFilter]=useState('all');
  const [countryFilter,setCountryFilter]=useState('all');
  // Apenas um grupo avançado aberto por vez: reduz o espaço ocupado pelos filtros.
  const [openFilterGroup,setOpenFilterGroup]=useState(null);
  const [screen,setScreen]=useState('list');
  const [selectedId,setSelectedId]=useState(null);
  const [draft,setDraft]=useState(null);
  const [recentIds,setRecentIds]=useState([]);
  const [onlyRecent,setOnlyRecent]=useState(false);
  const occupationId=db.occupations[0]?.id;
  // Evita manter filtros de outra ocupação ao trocar de modalidade pela home.
  useEffect(()=>{
    setFilter('');setTypeFilter('all');setAreaFilters([]);setModuleFilter('all');
    setEditionFilter('all');setCountryFilter('all');
    setOpenFilterGroup(null);setScreen('list');setSelectedId(null);setDraft(null);
    setRecentIds([]);setOnlyRecent(false);
  },[occupationId]);
  const options=useMemo(()=>catalogOptions(db.exams,db.examTypes,db.occupationAreas),[db.exams,db.examTypes,db.occupationAreas]);
  const filters={search:filter,typeKey:typeFilter,areaIds:areaFilters,module:moduleFilter,editionId:editionFilter,country:countryFilter};
  const activeCount=activeExamFilterCount(filters);
  const filterGroups=[
    {key:'types',title:'Tipos de prova',Icon:ListChecks,count:typeFilter!=='all'?1:0,available:true},
    {key:'areas',title:'Áreas da ocupação',Icon:Layers3,count:areaFilters.length,available:options.areas.length>0},
    {key:'module',title:'Módulos',Icon:FileSpreadsheet,count:moduleFilter!=='all'?1:0,available:options.modules.length>0},
  ];
  const filtered=useMemo(()=>{
    const matches=filterExamCatalog(db.exams,filters,db);
    const visible=onlyRecent?matches.filter(exam=>recentIds.includes(exam.id)):matches;
    return [...visible].sort((a,b)=>{
      const ai=recentIds.indexOf(a.id),bi=recentIds.indexOf(b.id);
      if(ai<0&&bi<0)return 0;
      if(ai<0)return 1;if(bi<0)return -1;
      return ai-bi;
    });
  },[db.exams,db.examTypes,db.editions,db.occupationAreas,filter,typeFilter,areaFilters,moduleFilter,editionFilter,countryFilter,recentIds,onlyRecent]);
  const clearFilters=()=>{setFilter('');setTypeFilter('all');setAreaFilters([]);setModuleFilter('all');setEditionFilter('all');setCountryFilter('all');setOnlyRecent(false);};
  const showCreated=ids=>{
    setRecentIds([...new Set(ids)]);setOnlyRecent(true);
    setFilter('');setTypeFilter('all');setAreaFilters([]);setModuleFilter('all');setEditionFilter('all');setCountryFilter('all');
    setScreen('list');setSelectedId(null);setDraft(null);setOpenFilterGroup(null);
  };
  const selected=db.exams.find(e=>e.id===selectedId);
  const open=(exam,edit=false)=>{setSelectedId(exam.id);setDraft(null);setScreen(edit?'edit':'view')};
  const createNew=()=>{const item=newExam(db);setSelectedId(item.id);setDraft(item);setScreen('edit')};
  const adapt=async exam=>{
    const copy=clone(exam);copy.id=uid();copy.title=`${exam.title} — Adaptada`;copy.sourceExamId=exam.id;copy.version=1;delete copy.createdAt;delete copy.updatedAt;
    try{await saveRecord('exams',copy);open(copy)}catch{}
  };
  const deleteExam=async exam=>{
    const blockers=examRemovalBlockers(exam.id,db);
    if(blockers.length){
      window.alert(`A prova \"${exam.title}\" não pode ser excluída porque possui vínculos: ${examRemovalWarning(blockers)}. Remova os vínculos antes de excluir.`);
      return false;
    }
    if(!window.confirm(`Excluir definitivamente a prova \"${exam.title}\"?\n\nO CIS, os aspectos e os relacionamentos técnicos desta prova também serão excluídos. Esta ação não pode ser desfeita.`))return false;
    const deleted=await deleteRecord('exams',exam.id,{skipConfirm:true});
    if(deleted){
      setScreen('list');setSelectedId(null);setDraft(null);
      const remaining=recentIds.filter(id=>id!==exam.id);
      setRecentIds(remaining);if(!remaining.length)setOnlyRecent(false);
    }
    return deleted;
  };
  if(screen==='import') return <CisImportWizard db={db} onBack={()=>setScreen('list')} onSave={exam=>saveRecord('exams',exam)} onComplete={showCreated}/>;
  if(screen==='edit'&&(draft||selected)){
    const source=draft||selected;
    return <ExamEditor key={source.id} source={source} db={db} onClose={()=>{setDraft(null);setScreen(draft?'list':'view')}} onSave={async exam=>{await saveRecord('exams',exam);if(draft){showCreated([exam.id]);}else{setDraft(null);setSelectedId(exam.id);setScreen('view');}}}/>;
  }
  if(screen==='view'&&selected) return <ExamView key={selected.id} exam={selected} db={db} onBack={()=>setScreen('list')} onEdit={()=>setScreen('edit')} onAdapt={()=>adapt(selected)} onDelete={()=>deleteExam(selected)}/>;
  return <>
    <PageTitle eyebrow="CATÁLOGO DE PROVAS" title="Provas" desc="Encontre uma prova, consulte seu conteúdo e abra uma página dedicada para editar seus critérios e relações." actions={<div className="inline-actions"><Button variant="subtle" onClick={()=>setScreen('import')}><FileSpreadsheet size={16}/> Cadastrar pelo CIS</Button><Button onClick={createNew}><Plus size={16}/> Nova prova</Button></div>}/>
    {recentIds.length>0&&<div className="exam-catalog-created" role="status"><span><Check size={17}/> {recentIds.length} prova{recentIds.length===1?'':'s'} cadastrada{recentIds.length===1?'':'s'} recentemente. {onlyRecent?'Exibindo somente esses cadastros.':'Elas aparecem primeiro no catálogo.'}</span><Button variant="subtle" onClick={()=>setOnlyRecent(value=>!value)}>{onlyRecent?'Ver todas as provas':'Ver apenas as novas'}</Button></div>}
    <section className="exam-catalog-filters" aria-label="Filtros do catálogo de provas">
      <div className="exam-catalog-toolbar">
        <div className="exam-catalog-primary-fields">
          <label className="exam-catalog-search"><span>Buscar prova</span><SearchBar value={filter} onChange={setFilter} placeholder="Pesquisar provas, módulos ou áreas..."/></label>
          <label className="exam-catalog-input-field"><span>Edição</span><select value={editionFilter} onChange={e=>setEditionFilter(e.target.value)}><option value="all">Todas as edições</option>{db.editions.map(edition=><option value={edition.id} key={edition.id}>{edition.name}</option>)}</select></label>
          <label className="exam-catalog-input-field"><span>País de referência</span><select value={countryFilter} onChange={e=>setCountryFilter(e.target.value)}><option value="all">Todos os países</option>{options.countries.map(country=><option value={country} key={country}>{country}</option>)}</select></label>
        </div>
        <div className="exam-catalog-toolbar-actions">
          <span className="exam-catalog-result-count" role="status">{filtered.length} de {db.exams.length} provas{onlyRecent?' · cadastros recentes':''}</span>
          <div className="exam-catalog-group-toggles" role="group" aria-label="Filtros por categoria">
            {filterGroups.filter(group=>group.available).map(group=><button key={group.key} type="button"
              className={`exam-catalog-more${openFilterGroup===group.key?' is-open':''}`}
              aria-expanded={openFilterGroup===group.key} aria-controls={`exam-catalog-panel-${group.key}`}
              onClick={()=>setOpenFilterGroup(current=>current===group.key?null:group.key)}>
              <group.Icon size={15} aria-hidden="true"/> {group.title}
              {group.count>0&&<span className="exam-catalog-more-counter" aria-label={`${group.count} selecionado${group.count>1?'s':''}`}>{group.count}</span>}
              <ChevronDown size={15} aria-hidden="true"/>
            </button>)}
          </div>
          {activeCount>0&&<button type="button" className="exam-catalog-reset" onClick={clearFilters}><RotateCcw size={13}/> Limpar filtros <span>{activeCount}</span></button>}
        </div>
      </div>
      <div className="exam-catalog-collapsible" id="exam-catalog-panel-types" hidden={openFilterGroup!=='types'}>
        <CatalogPills label="Tipo de prova" subtitle="Categorias disponíveis nesta ocupação" items={options.types.map(t=>({id:t.key,label:t.name}))} value={typeFilter} onChange={setTypeFilter} allLabel="Todos" kind="types"/>
      </div>
      <div className="exam-catalog-collapsible" id="exam-catalog-panel-areas" hidden={openFilterGroup!=='areas'}>
        <CatalogPills label="Áreas da ocupação" subtitle="Áreas abordadas nas provas" items={options.areas.map(a=>({id:a.id,label:a.name}))} multiple value={areaFilters} onChange={setAreaFilters} allLabel="Todas" kind="areas"/>
      </div>
      <div className="exam-catalog-collapsible" id="exam-catalog-panel-module" hidden={openFilterGroup!=='module'}>
        <CatalogPills label="Módulos" subtitle="Módulo de aplicação da prova" items={options.modules.map(m=>({id:m,label:m}))} value={moduleFilter} onChange={setModuleFilter} allLabel="Todos" kind="module"/>
      </div>
    </section>
    <div className="exam-card-grid">
      {filtered.map(exam=><article className="exam-card" key={exam.id}>
        <div className="exam-card-top"><div className="tags"><Badge tone="blue">{exam.module||'Sem módulo'}</Badge><Badge>{typeName(exam,db)}</Badge>{recentIds.includes(exam.id)&&<Badge tone="green">Novo cadastro</Badge>}</div><strong>{points(exam.maxScore)} pts</strong></div>
        <h2>{exam.title}</h2><p className="exam-card-description">{exam.description||'Descrição ainda não cadastrada.'}</p>
        <div className="exam-card-meta"><span><strong>Edição</strong>{lookup(db.editions,exam.editionId)}</span><span><strong>País</strong>{countryName(exam)}</span></div>
        <div className="exam-card-bottom"><Button variant="subtle" onClick={()=>open(exam)}><Eye size={15}/> Visualizar</Button><Button variant="ghost" onClick={()=>open(exam,true)}><Pencil size={15}/> Editar</Button><Button variant="danger-ghost" className="exam-card-delete" title={`Excluir prova: ${exam.title}`} aria-label={`Excluir prova: ${exam.title}`} onClick={()=>deleteExam(exam)}><Trash2 size={15}/></Button></div>
      </article>)}
      {!filtered.length&&<div className="panel exam-empty-card"><Empty title="Nenhuma prova encontrada" subtitle="Ajuste os filtros ou cadastre uma nova prova."/></div>}
    </div>
  </>;
}
