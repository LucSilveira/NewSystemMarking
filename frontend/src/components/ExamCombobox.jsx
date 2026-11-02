import React,{useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,ChevronDown,Search,Check} from 'lucide-react';
import {editionLabel,examSearchGroups,examHasCis} from '../lib/executionCatalog.js';

/** Pesquisa por módulo, nome ou edição; agrupa pelo histórico da prova. */
export default function ExamCombobox({exams=[],editions=[],value='',onChange,disabled=false,placeholder='Buscar por prova, módulo ou edição',allowAll=false}){
 const root=useRef(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const selected=exams.find(e=>e.id===value);
 const groups=useMemo(()=>examSearchGroups(exams,editions,query),[exams,editions,query]);
 const first=groups[0]?.items[0];
 const choose=id=>{onChange(id);setQuery('');setOpen(false)};
 useEffect(()=>{const onPointer=e=>{if(!root.current?.contains(e.target))setOpen(false)};document.addEventListener('pointerdown',onPointer);return()=>document.removeEventListener('pointerdown',onPointer)},[]);
 return <div className={`stm-exam-combo ${disabled?'is-disabled':''}`} ref={root}>
  <div className={`stm-exam-combo-input ${open?'is-open':''}`}>
   <Search size={16} aria-hidden="true"/>
   <input type="text" role="combobox" aria-label="Buscar prova" aria-autocomplete="list" aria-expanded={open} autoComplete="off" disabled={disabled}
    placeholder={selected&&!open?`${selected.module||''} · ${selected.title} — ${editionLabel(selected,editions)}`:placeholder}
    value={open?query:''}
    onFocus={()=>{setQuery('');setOpen(true)}}
    onChange={e=>{setQuery(e.target.value);setOpen(true)}}
    onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);e.currentTarget.blur()} if(e.key==='Enter'&&open){e.preventDefault();if(first)choose(first.id);else if(allowAll)choose('all')}}}/>
   <button type="button" tabIndex={-1} disabled={disabled} aria-label={open?'Fechar opções':'Listar provas'} onClick={()=>{setQuery('');setOpen(v=>!v)}}><ChevronDown size={17}/></button>
  </div>
  {!open&&selected&&<span className="stm-exam-combo-selected">{selected.module} · {selected.title} <small>{editionLabel(selected,editions)}</small></span>}
  {open&&<div className="stm-exam-combo-list" role="listbox" aria-label="Provas por edição">
    {allowAll&&<button role="option" type="button" aria-selected={value==='all'} className="stm-exam-combo-option" onClick={()=>choose('all')}><BookOpen size={14}/> Todas as provas {value==='all'&&<Check size={14}/>}</button>}
    {groups.map(group=><div key={group.edition} className="stm-exam-combo-group"><div className="stm-exam-combo-group-title">{group.edition}</div>{group.items.map(exam=><button type="button" role="option" aria-selected={value===exam.id} key={exam.id} className="stm-exam-combo-option" onClick={()=>choose(exam.id)}><BookOpen size={15}/><span><strong>{exam.module||'—'} · {exam.title}</strong><small>{examHasCis(exam)?'CIS disponível':'Sem CIS de correção'}</small></span>{value===exam.id&&<Check size={15}/>}</button>)}</div>)}
    {!groups.length&&<div className="stm-exam-combo-empty">Nenhuma prova encontrada.</div>}
  </div>}
 </div>;
}
