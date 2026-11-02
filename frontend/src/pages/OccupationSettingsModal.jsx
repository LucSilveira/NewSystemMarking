import React,{useState} from 'react';
import {Plus,Pencil,Trash2,Save,X} from 'lucide-react';
import {Modal,Button} from '../components/UI.jsx';
import {uid} from '../lib/api.js';

/** Administração de modalidades; os demais cadastros pertencem à ocupação. */
export default function OccupationSettingsModal({db,onClose,onSave,onDelete}){
  const [record,setRecord]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const rows=[...db.occupations].sort((a,b)=>Number(a.code)-Number(b.code));
  const change=(key,value)=>setRecord(prev=>({...prev,[key]:value}));
  const edit=value=>{setRecord({...value});setError('')};
  const save=async e=>{
    e.preventDefault();if(!record)return;
    setBusy(true);setError('');
    try{const payload={...record};delete payload._new;await onSave('occupations',payload);setRecord(null)}
    catch(err){setError(err.message||'Falha ao salvar ocupação')}
    finally{setBusy(false)}
  };
  return <Modal wide title="Ocupações" subtitle="Modalidades da escola" onClose={onClose}>
    <div className="school-settings-toolbar"><span>{rows.length} modalidade{rows.length===1?'':'s'}</span><Button onClick={()=>edit({_new:true,id:uid(),code:'',name:'',description:''})}><Plus size={15}/> Nova ocupação</Button></div>
    <div className={`school-settings-grid ${record?'has-editor':'is-list-only'}`}>
      <div className="school-settings-list">
        {rows.map(item=><div className={`school-settings-entry ${record?.id===item.id?'is-selected':''}`} key={item.id}>
          <span>#{String(item.code).padStart(2,'0')} · {item.name}</span>
          <button type="button" title="Editar" aria-label={`Editar ${item.name}`} onClick={()=>edit(item)}><Pencil size={15}/></button>
          <button type="button" className="school-settings-remove" title="Excluir" aria-label={`Excluir ${item.name}`} onClick={()=>onDelete('occupations',item.id)}><Trash2 size={15}/></button>
        </div>)}
        {!rows.length&&<p className="school-settings-hint">Nenhuma ocupação cadastrada.</p>}
      </div>
      {record&&<div className="school-settings-editor"><form onSubmit={save}>
        <div className="school-settings-editor-heading"><strong>{record._new?'Nova ocupação':'Editar ocupação'}</strong><button type="button" title="Fechar edição" onClick={()=>setRecord(null)}><X size={16}/></button></div>
        <label className="school-settings-field">Código<input required value={record.code||''} onChange={e=>change('code',e.target.value)}/></label>
        <label className="school-settings-field">Nome<input required value={record.name||''} onChange={e=>change('name',e.target.value)}/></label>
        <label className="school-settings-field">Descrição<textarea rows={3} value={record.description||''} onChange={e=>change('description',e.target.value)}/></label>
        {error&&<p role="alert" className="school-settings-error">{error}</p>}
        <div className="school-settings-actions"><Button variant="ghost" onClick={()=>setRecord(null)}>Cancelar</Button><Button type="submit" disabled={busy}><Save size={15}/>{busy?'Salvando...':'Salvar'}</Button></div>
      </form></div>}
    </div>
  </Modal>;
}
