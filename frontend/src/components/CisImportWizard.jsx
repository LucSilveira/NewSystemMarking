import React,{useMemo,useState} from 'react';
import {ArrowLeft,FileSpreadsheet,AlertTriangle,CheckCircle2,Save,ChevronDown,Plus,Info} from 'lucide-react';
import CisFileDropzone from './CisFileDropzone.jsx';
import {Button,Empty} from './UI.jsx';
import {points,uid} from '../lib/api.js';
import {createExamFromCis,findTitleClashes,missingWsosSections} from '../lib/cisExamCreation.js';
import {suggestBatchRegistrations,batchTitleConflicts,batchCreatedExam} from '../lib/cisBatchRegistration.js';
import {readCisXlsx} from '../lib/cisXlsx.js';
import {importSubcriteria} from '../lib/cisParser.js';

const meta=module=>`${module.subcriteria.length} subcritérios · ${module.aspectCount} aspectos (${module.measurementCount} M / ${module.judgementCount} J) · ${points(module.totalScore)} pts`;

/** Cadastro em lote: nunca substitui estruturas de provas existentes. */
export default function CisImportWizard({db,onBack,onSave,onComplete}){
  const [result,setResult]=useState(null);
  const [fileName,setFileName]=useState('');
  const [mapping,setMapping]=useState({});
  const [editionId,setEditionId]=useState('');
  const [referenceCountry,setReferenceCountry]=useState('');
  const [error,setError]=useState('');
  const [reading,setReading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [created,setCreated]=useState([]);
  const [done,setDone]=useState([]);
  const modules=result?.modules||[];
  const occupationId=db.occupations[0]?.id;
  const selected=useMemo(()=>modules.filter(m=>mapping[m.module]?.enabled&&!done.includes(m.module)),[modules,mapping,done]);
  const conflicts=useMemo(()=>batchTitleConflicts(modules,mapping,db.exams,occupationId),[modules,mapping,db.exams,occupationId]);
  const updateChoice=(module,patch)=>setMapping(prev=>({...prev,[module]:{...prev[module],...patch}}));
  const foundExisting=modules.filter(m=>findTitleClashes(db.exams,occupationId,mapping[m.module]?.title||m.title).length>0);
  const totalEligible=modules.filter(m=>!findTitleClashes(db.exams,occupationId,mapping[m.module]?.title||m.title).length).length;

  async function chooseFile(file){
    if(!file)return;
    setReading(true);setResult(null);setMapping({});setCreated([]);setDone([]);setError('');setFileName(file.name);
    try{
      const parsed=await readCisXlsx(file);
      setResult(parsed);
      setMapping(suggestBatchRegistrations(parsed.modules,db));
    }catch(err){setError(err?.message||'Não foi possível interpretar o CIS.');}
    finally{setReading(false);}
  }

  function validate(module){
    const choice=mapping[module.module]||{};
    if(conflicts[module.module])return conflicts[module.module];
    if(module.warnings.length)return 'O CIS contém avisos neste módulo. Revise o arquivo antes de cadastrar.';
    if(module.subcriteria.some(s=>s.aspects.some(a=>a.maxScore==null||!a.description)))return 'Há aspectos incompletos no módulo.';
    const missing=missingWsosSections(module,db.wsos);
    if(missing.length)return `Cadastre as seções WSOS ${missing.join(', ')} nas Configurações da modalidade.`;
    if(!occupationId)return 'Ocupação ativa não encontrada.';
    if(!db.examTypes.some(t=>t.key===choice.typeKey))return 'Selecione um tipo de prova válido.';
    const chosenEdition=choice.editionId||editionId;
    if(chosenEdition&&!db.editions.some(e=>e.id===chosenEdition))return 'Edição inexistente para esta ocupação.';
    return '';
  }

  async function save(){
    setError('');
    if(!selected.length){setError('Selecione ao menos um módulo novo para cadastrar.');return;}
    for(const module of selected){const issue=validate(module);if(issue){setError(`${module.module}: ${issue}`);return;}}
    setSaving(true);
    const completedIds=[...created],completedModules=[...done];
    try{
      for(const module of selected){
        const choice=mapping[module.module];
        // A API também impede títulos duplicados; nunca reutilizamos um cadastro existente.
        if(findTitleClashes(db.exams,occupationId,choice.title).length)throw new Error(`${module.module}: a prova já existe na ocupação.`);
        const exam=batchCreatedExam(module,choice,{editionId,referenceCountry},{
          occupationId,id:uid(),date:new Date().toISOString(),createExamFromCis,importSubcriteria
        });
        await onSave(exam);
        completedIds.push(exam.id);
        completedModules.push(module.module);
        setCreated([...completedIds]);setDone([...completedModules]);
      }
      onComplete?.(completedIds);
    }catch(err){
      setError(`Cadastro interrompido: ${err?.message||'Erro inesperado'}. ${completedIds.length} prova(s) criada(s). Corrija o problema e tente novamente; as concluídas não serão cadastradas de novo.`);
    }finally{setSaving(false);}
  }

  return <div className="cis-import-workspace">
    <div className="cis-import-header"><Button variant="ghost" disabled={saving} onClick={onBack}><ArrowLeft size={16}/> Voltar às provas</Button></div>
    <section className="panel cis-import-panel cis-batch-workspace">
      <div className="cis-import-title"><FileSpreadsheet size={24}/><div><h1>Cadastrar provas pelo CIS</h1><p>Um arquivo XLSX pode cadastrar várias provas, cada uma com seus subcritérios, aspectos e pontuação.</p></div></div>
      <div className="cis-import-upload">
        <CisFileDropzone fileName={fileName} disabled={reading||saving} onFile={chooseFile} onInvalid={setError}/>
        <small>Provas já cadastradas não serão modificadas. Para atualizar o CIS de uma prova, abra sua edição e use a importação individual.</small>
      </div>
      {reading&&<p className="muted">Lendo e identificando os módulos do arquivo...</p>}
      {error&&<p className="note warning" role="alert">{error}</p>}
      {result&&<>
        <div className="cis-import-overview cis-batch-overview">
          <div><strong>{modules.length}</strong><span>Módulos encontrados</span></div>
          <div><strong>{totalEligible}</strong><span>Títulos disponíveis</span></div>
          <div><strong>{foundExisting.length}</strong><span>Provas já cadastradas</span></div>
          <div><strong>{selected.length}</strong><span>Novas provas selecionadas</span></div>
        </div>
        <fieldset className="cis-batch-shared">
          <legend>Informações compartilhadas</legend>
          <div className="cis-batch-shared-fields">
            <label className="cis-import-select-label">Edição de referência
              <select value={editionId} disabled={saving} onChange={e=>setEditionId(e.target.value)}><option value="">Definir mais tarde</option>{db.editions.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </label>
            <label className="cis-import-select-label">País de referência
              <input value={referenceCountry} disabled={saving} onChange={e=>setReferenceCountry(e.target.value)} placeholder="Ex.: China (opcional)"/>
            </label>
          </div>
          <small>Esses dados serão usados nas provas novas, a menos que você os substitua em um módulo. Tudo poderá ser editado depois.</small>
        </fieldset>
        <div className="cis-batch-section-head"><div><h2>Mapeamento das novas provas</h2><p>Confira o título e o tipo de cada módulo antes de cadastrar.</p></div><span>{selected.length} selecionada(s)</span></div>
        <div className="cis-import-module-grid">
          {modules.map(module=>{
            const choice=mapping[module.module]||{};
            const finished=done.includes(module.module);
            const duplicate=findTitleClashes(db.exams,occupationId,choice.title||module.title).length>0;
            const issue=choice.enabled&&!finished?validate(module):'';
            return <article key={module.module} className={`cis-import-module cis-batch-module${choice.enabled?' is-enabled':''}${finished?' is-complete':''}`}>
              <div className="cis-import-module-head">
                <label className="cis-import-choose"><input type="checkbox" checked={!!choice.enabled||finished} disabled={saving||finished||duplicate} onChange={e=>updateChoice(module.module,{enabled:e.target.checked})}/><span className="cis-import-code">{module.module}</span><strong>{module.title}</strong></label>
                {finished?<span className="cis-batch-status is-done"><CheckCircle2 size={14}/> Cadastrada</span>:duplicate?<span className="cis-batch-status is-existing"><Info size={14}/> Já existe</span>:null}
              </div>
              <div className="cis-import-module-stats">{meta(module)}</div>
              <div className="cis-batch-module-fields">
                <label className="cis-import-select-label cis-batch-title">Título da nova prova
                  <input disabled={saving||finished} value={choice.title||''} onChange={e=>updateChoice(module.module,{title:e.target.value})} placeholder="Dê um nome identificável à prova"/>
                </label>
                <label className="cis-import-select-label">Tipo de prova
                  <select disabled={saving||finished} value={choice.typeKey||''} onChange={e=>updateChoice(module.module,{typeKey:e.target.value})}>
                    <option value="">Escolher tipo...</option>{db.examTypes.map(t=><option key={t.id||t.key} value={t.key}>{t.name}</option>)}
                  </select>
                </label>
                <label className="cis-import-select-label">Edição (opcional)
                  <select disabled={saving||finished} value={choice.editionId||''} onChange={e=>updateChoice(module.module,{editionId:e.target.value})}>
                    <option value="">{editionId?'Usar a edição compartilhada':'Definir mais tarde'}</option>{db.editions.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </label>
                <label className="cis-import-select-label">País (opcional)
                  <input disabled={saving||finished} value={choice.referenceCountry||''} onChange={e=>updateChoice(module.module,{referenceCountry:e.target.value})} placeholder={referenceCountry||'Usar padrão ou preencher depois'}/>
                </label>
              </div>
              {duplicate&&!finished&&<p className="cis-import-existing-title"><Info size={15}/> Esse título já existe nesta ocupação. O módulo será ignorado. Para cadastrar outra prova, informe um título diferente.</p>}
              {issue&&<p className="cis-import-validation" role="status">{issue}</p>}
              {module.warnings.map((warning,i)=><p className="cis-import-warning" key={i}><AlertTriangle size={14}/>{warning}</p>)}
              <details className="cis-import-preview"><summary>Conferir subcritérios <ChevronDown size={14}/></summary>
                {module.subcriteria.map(sub=><details key={sub.code} className="cis-import-sub"><summary><b>{sub.code} — {sub.title}</b><span>{sub.aspects.length} aspectos · {points(sub.aspects.reduce((a,v)=>a+v.maxScore,0))} pts</span></summary><ul>{sub.aspects.map(a=><li key={a.sourceRow}><span>{a.method} · WSOS {a.wsosSection} · {points(a.maxScore)} pts</span>{a.description}</li>)}</ul></details>)}
              </details>
            </article>;
          })}
        </div>
        <div className="cis-import-savebar"><span>{done.length>0?`${done.length} prova(s) cadastrada(s). `:''}{selected.length} nova(s) selecionada(s)</span>
          <div className="inline-actions"><Button variant="ghost" disabled={saving} onClick={onBack}>Cancelar</Button><Button disabled={saving||!selected.length} onClick={save}><Save size={16}/>{saving?'Cadastrando...':`Cadastrar ${selected.length} prova${selected.length===1?'':'s'}`}</Button></div>
        </div>
        <p className="cis-import-legal">Os registros criados poderão ser complementados no catálogo. Nenhum CIS já cadastrado será substituído nesta operação.</p>
      </>}
      {!result&&!reading&&<Empty title="Selecione um CIS para começar" subtitle="Os módulos reconhecidos serão transformados em cadastros individuais de provas."/>}
    </section>
  </div>;
}
