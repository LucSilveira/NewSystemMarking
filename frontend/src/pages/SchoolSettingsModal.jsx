import React,{useEffect,useState} from 'react';
import {Plus,Pencil,Trash2,Save,X} from 'lucide-react';
import {Modal,Button} from '../components/UI.jsx';
import {uid} from '../lib/api.js';

export const SCHOOL_SECTIONS={
  occupations:'Ocupações',
  editions:'Edições',
  evaluators:'Avaliadores',
  competitors:'Competidores',
};
const PHASES=['Seletiva estadual','Estadual','Nacional','WorldSkills Américas','EuroSkills','AsiaSkills','WorldSkills','GlobalSkills','Individuais'];

const initial=(kind,db)=>{
  const base={_new:true,id:uid()};
  if(kind==='editions')return {...base,name:'',phase:'WorldSkills',year:new Date().getFullYear(),occupationId:db.occupations[0]?.id||''};
  if(kind==='evaluators')return {...base,name:'',occupationIds:[],active:true};
  if(kind==='competitors')return {...base,name:'',occupationId:db.occupations[0]?.id||'',photo:'',notes:'',active:true};
  return {...base,code:'',name:'',description:''};
};
const summary=(kind,v,db)=>{
  if(kind==='occupations') return `#${v.code||'—'} · ${v.name}`;
  if(kind==='editions')return `${v.name} · ${v.year||'—'}`;
  const ids=kind==='evaluators'?v.occupationIds||[]:[v.occupationId];
  const occupationNames=ids.map(id=>db.occupations.find(o=>o.id===id)).filter(Boolean).map(o=>`#${o.code}`).join(', ');
  return `${v.name}${occupationNames?' · '+occupationNames:''}`;
};

export default function SchoolSettingsModal({kind,db,onClose,onSave,onDelete}){
  const [record,setRecord]=useState(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setRecord(null);setError('')},[kind]);
  const items=[...(db[kind]||[])].sort((a,b)=>String(a.name||a.code).localeCompare(String(b.name||b.code),'pt-BR'));
  const set=(key,value)=>setRecord(v=>({...v,[key]:value}));
  const edit=(value)=>{setRecord({...value});setError('')};
  const submit=async(e)=>{
    e.preventDefault();
    if(!record)return;
    setSaving(true);setError('');
    try {const data={...record};delete data._new;await onSave(kind,data);setRecord(null)}
    catch(err){setError(err.message||'Erro ao salvar registro')}
    finally{setSaving(false)}
  };
  const discard=async(id)=>{const ok=await onDelete(kind,id);if(ok&&record?.id===id)setRecord(null)};
  const chooseOccupation=(id,checked)=>set('occupationIds',checked?[...new Set([...(record.occupationIds||[]),id])]:(record.occupationIds||[]).filter(x=>x!==id));
  return <Modal wide title={SCHOOL_SECTIONS[kind]} subtitle="Cadastros da escola" onClose={onClose}>
    <div className="school-settings-toolbar">
      <span>{items.length} registro{items.length===1?'':'s'}</span>
      <Button onClick={()=>edit(initial(kind,db))}><Plus size={15}/> Novo registro</Button>
    </div>
    <div className={`school-settings-grid ${record?'has-editor':'is-list-only'}`}>
      <div className="school-settings-list">
        {items.map(item=><div className={`school-settings-entry ${record?.id===item.id?'is-selected':''}`} key={item.id}>
          <span>{summary(kind,item,db)}</span>
          <button type="button" title="Editar" aria-label={`Editar ${item.name}`} onClick={()=>edit(item)}><Pencil size={15}/></button>
          <button type="button" className="school-settings-remove" title="Excluir" aria-label={`Excluir ${item.name}`} onClick={()=>discard(item.id)}><Trash2 size={15}/></button>
        </div>)}
        {!items.length&&<p className="school-settings-hint">Nenhum cadastro nesta categoria.</p>}
      </div>
      {record&&<div className="school-settings-editor">
        <form onSubmit={submit}>
          <div className="school-settings-editor-heading"><strong>{record._new?'Novo registro':'Editar registro'}</strong><button type="button" onClick={()=>setRecord(null)} title="Cancelar edição"><X size={16}/></button></div>
          {kind==='occupations'&&<>
            <label className="school-settings-field">Código<input required value={record.code||''} onChange={e=>set('code',e.target.value)}/></label>
            <label className="school-settings-field">Nome<input required value={record.name||''} onChange={e=>set('name',e.target.value)}/></label>
            <label className="school-settings-field">Descrição<textarea rows={2} value={record.description||''} onChange={e=>set('description',e.target.value)}/></label>
          </>}
          {kind==='editions'&&<>
            <label className="school-settings-field">Edição<input required value={record.name||''} onChange={e=>set('name',e.target.value)}/></label>
            <label className="school-settings-field">Ano<input required type="number" min="2000" value={record.year??''} onChange={e=>set('year',Number(e.target.value))}/></label>
            <label className="school-settings-field">Fase<select value={record.phase||'WorldSkills'} onChange={e=>set('phase',e.target.value)}>{PHASES.map(v=><option key={v}>{v}</option>)}</select></label>
            <label className="school-settings-field">Ocupação<select required value={record.occupationId||''} onChange={e=>set('occupationId',e.target.value)}><option value="">Selecione</option>{db.occupations.map(o=><option key={o.id} value={o.id}>#{o.code} · {o.name}</option>)}</select></label>
          </>}
          {kind==='evaluators'&&<>
            <label className="school-settings-field">Nome<input required value={record.name||''} onChange={e=>set('name',e.target.value)}/></label>
            <fieldset className="school-settings-occupations"><legend>Ocupações vinculadas</legend>{db.occupations.map(o=><label key={o.id}><input type="checkbox" checked={(record.occupationIds||[]).includes(o.id)} onChange={e=>chooseOccupation(o.id,e.target.checked)}/> #{o.code} · {o.name}</label>)}</fieldset>
          </>}
          {kind==='competitors'&&<>
            <label className="school-settings-field">Nome<input required value={record.name||''} onChange={e=>set('name',e.target.value)}/></label>
            <label className="school-settings-field">Ocupação<select required value={record.occupationId||''} onChange={e=>set('occupationId',e.target.value)}><option value="">Selecione</option>{db.occupations.map(o=><option key={o.id} value={o.id}>#{o.code} · {o.name}</option>)}</select></label>
            <label className="school-settings-field">URL da foto<input type="url" placeholder="https://..." value={record.photo?.startsWith('data:')?'':record.photo||''} onChange={e=>set('photo',e.target.value)}/></label>
            {record.photo&&<img className="school-settings-photo" alt="Prévia da foto" src={record.photo}/>}
            <label className="school-settings-field">Observações<textarea rows={2} value={record.notes||''} onChange={e=>set('notes',e.target.value)}/></label>
          </>}
          {error&&<p role="alert" className="school-settings-error">{error}</p>}
          <div className="school-settings-actions"><Button variant="ghost" onClick={()=>setRecord(null)}>Cancelar</Button><Button type="submit" disabled={saving}><Save size={15}/>{saving?'Salvando...':'Salvar'}</Button></div>
        </form>
      </div>}
    </div>
  </Modal>;
}
