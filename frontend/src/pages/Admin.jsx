import React,{useEffect,useState} from 'react';
import {BookOpen,CalendarDays,ClipboardCheck,GraduationCap,Settings2,Users,UserRound,Plus,Pencil,ShieldCheck,ArrowRight,KeyRound,LogOut} from 'lucide-react';
import {PageTitle,Button,Modal,Field,Footer} from '../components/UI.jsx';
import SchoolSettingsModal,{SCHOOL_SECTIONS} from './SchoolSettingsModal.jsx';
import {request} from '../lib/api.js';
function UserEditor({source,db,onClose,onSaved}){
 const [data,setData]=useState(source||{name:'',username:'',email:'',password:'',role:'evaluator',active:true,occupationIds:[]});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const set=(k,v)=>setData(p=>({...p,[k]:v}));
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const payload={...data};if(!payload.password)delete payload.password;await request(source?`/admin/users/${source.id}`:'/admin/users',{method:source?'PUT':'POST',body:payload});onSaved()}catch(err){setError(err.message)}finally{setBusy(false)}};
 return <Modal title={source?'Editar usuário':'Novo usuário'} onClose={onClose}><form onSubmit={submit} className="stm-user-form">
  <Field label="Nome"><input required value={data.name} onChange={e=>set('name',e.target.value)}/></Field>
  <Field label="Nome de usuário"><input required autoComplete="off" value={data.username} onChange={e=>set('username',e.target.value)}/></Field>
  <Field label="E-mail institucional (opcional)"><input type="email" autoComplete="email" value={data.email||''} onChange={e=>set('email',e.target.value)}/></Field>
  <Field label={source?'Nova senha (opcional)':'Senha temporária (mínimo 8 caracteres)'}><input minLength={8} required={!source} type="password" autoComplete="new-password" value={data.password||''} onChange={e=>set('password',e.target.value)}/></Field>
  <Field label="Perfil"><select value={data.role} onChange={e=>set('role',e.target.value)}><option value="evaluator">Avaliador</option><option value="admin">Administrador</option></select></Field>
  <label className="stm-user-active"><input type="checkbox" checked={data.active!==false} onChange={e=>set('active',e.target.checked)}/> Conta ativa</label>
  {data.role==='evaluator'&&<fieldset className="stm-user-occupations"><legend>Ocupações permitidas</legend>{db.occupations.map(o=><label key={o.id}><input type="checkbox" checked={data.occupationIds?.includes(o.id)||false} onChange={e=>set('occupationIds',e.target.checked?[...new Set([...(data.occupationIds||[]),o.id])]:(data.occupationIds||[]).filter(x=>x!==o.id))}/> #{String(o.code).padStart(2,'0')} · {o.name}</label>)}</fieldset>}
  {error&&<div role="alert" className="stm-login-error">{error}</div>}<Footer cancel={onClose} busy={busy}/>
 </form></Modal>;
}
export default function Admin({db,onOccupation,onSaveRecord,onDeleteRecord,currentUser,onLogout}){
 const [settings,setSettings]=useState(null),[users,setUsers]=useState([]),[editing,setEditing]=useState(undefined),[error,setError]=useState('');
 const load=()=>request('/admin/users').then(setUsers).catch(e=>setError(e.message));
 useEffect(()=>{load()},[]);
 const rows=[...db.occupations].sort((a,b)=>Number(a.code)-Number(b.code));
 const metrics=[{t:'Ocupações',v:db.occupations.length,icon:Settings2},{t:'Competidores',v:db.competitors.length,icon:Users},{t:'Provas cadastradas',v:db.exams.length,icon:BookOpen},{t:'Execuções',v:db.executions.length,icon:ClipboardCheck}];
 return <div className="stm-admin-shell"><header className="stm-admin-header"><div className="stm-admin-brand"><span>STM</span><strong>Skill Training Manager</strong></div><div className="stm-admin-account"><span><ShieldCheck size={15}/> {currentUser.name}</span><button type="button" onClick={onLogout}><LogOut size={15}/> Sair</button></div></header>
 <main className="stm-admin-content"><div className="stm-admin-hero"><div className="eyebrow">ADMINISTRAÇÃO DA ESCOLA</div><h1>Treinamento e desempenho</h1><p>Acompanhamento consolidado das ocupações, provas e participantes.</p></div>
 <div className="stat-grid">{metrics.map(m=><div className="stat-card" key={m.t}><m.icon size={21}/><strong>{m.v}</strong><span>{m.t}</span></div>)}</div>
 <div className="stm-admin-sections"><section className="panel"><header className="panel-heading"><div><h2>Ocupações e treinamentos</h2><p>Selecione uma ocupação para gerenciar provas, execuções e relatórios.</p></div></header>
 <div className="stm-admin-occupations">{rows.map(o=>{const comps=db.competitors.filter(c=>c.occupationId===o.id);const exams=db.exams.filter(e=>e.occupationId===o.id);return <button type="button" key={o.id} onClick={()=>onOccupation(o)}><span className="stm-admin-code">#{String(o.code).padStart(2,'0')}</span><span className="stm-admin-occ-name"><strong>{o.name}</strong><small>{comps.length} participante{comps.length===1?'':'s'} · {exams.length} prova{exams.length===1?'':'s'}</small></span><ArrowRight size={17}/></button>})}</div></section>
 <div className="stm-admin-side"><section className="panel"><header className="panel-heading"><div><h2>Configurações gerais</h2><p>Cadastros restritos à administração.</p></div></header><div className="stm-admin-settings">{Object.entries(SCHOOL_SECTIONS).map(([key,label])=><button key={key} onClick={()=>setSettings(key)}><Settings2 size={16}/>{label}<ArrowRight size={15}/></button>)}</div></section>
 <section className="panel"><header className="panel-heading"><div><h2>Acessos dos professores</h2><p>Contas e permissões por ocupação.</p></div><Button onClick={()=>setEditing(null)}><Plus size={15}/> Novo</Button></header>
 <div className="stm-admin-users">{users.map(u=><button type="button" key={u.id} onClick={()=>setEditing(u)}><span><strong>{u.name}</strong><small>@{u.username}{u.email?` · ${u.email}`:''} · {u.role==='admin'?'Administrador':`Avaliador · ${u.occupationIds.length} ocupação(ões)`} {u.active?'':'· Desativado'}</small></span><Pencil size={15}/></button>)}</div>{error&&<p className="error-text">{error}</p>}</section></div></div></main>
 {settings&&<SchoolSettingsModal kind={settings} db={db} onSave={onSaveRecord} onDelete={onDeleteRecord} onClose={()=>setSettings(null)}/>}
 {editing!==undefined&&<UserEditor source={editing} db={db} onClose={()=>setEditing(undefined)} onSaved={()=>{if(editing?.id===currentUser.id){onLogout();return}setEditing(undefined);load()}}/>}
 </div>;
}
