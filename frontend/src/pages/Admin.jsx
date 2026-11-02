import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ArrowRight,BookOpen,ClipboardCheck,GraduationCap,LogOut,Pencil,Plus,Settings2,ShieldCheck,UserRound,Users} from 'lucide-react';
import {Button,Field,Footer,Modal} from '../components/UI.jsx';
import SelectField from '../components/SelectField.jsx';
import {request,uid} from '../lib/api.js';
import OccupationSettingsModal from './OccupationSettingsModal.jsx';

const sortName=(a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR');

/** Um único formulário para contas de avaliadores e registros de competidores.
 * Competidor não recebe credenciais; seus resultados continuam ligados a competitors.id.
 */
function PersonEditor({editing,db,onClose,onSave,onDelete}){
  const source=editing?.source||null;
  const existing=!!source;
  const [kind,setKind]=useState(editing?.kind||'evaluator');
  const [value,setValue]=useState(()=>source?{...source,password:''}:{name:'',username:'',email:'',password:'',occupationIds:[],occupationId:db.occupations[0]?.id||'',photo:'',notes:'',active:true});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const set=(k,v)=>setValue(prev=>({...prev,[k]:v}));
  const isCompetitor=kind==='competitor';
  const isAdmin=kind==='admin';
  const onSubmit=async e=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      if(isCompetitor){
        const payload={id:source?.id||uid(),name:value.name,occupationId:value.occupationId,photo:value.photo||'',notes:value.notes||'',active:existing?value.active!==false:true};
        await onSave('competitor',payload,existing);
      }else{
        const payload={name:value.name,username:value.username,email:value.email||'',role:isAdmin?'admin':'evaluator',occupationIds:isAdmin?[]:value.occupationIds||[],active:existing?value.active!==false:true};
        if(value.password)payload.password=value.password;
        await onSave('account',existing?{...payload,id:source.id}:payload,existing);
      }
      onClose();
    }catch(err){setError(err.message||'Não foi possível salvar o usuário')}
    finally{setBusy(false)}
  };
  return <Modal title={existing?'Editar usuário':'Novo usuário'} subtitle="Cadastro da escola" onClose={onClose}>
    <form className="stm-user-form" onSubmit={onSubmit}>
      <div className="stm-user-fields">
      {!existing&&<Field label="Tipo de usuário"><SelectField value={kind} onChange={e=>setKind(e.target.value)}><option value="evaluator">Avaliador</option><option value="competitor">Competidor</option></SelectField></Field>}
      {existing&&<div className="stm-person-role"><span>Tipo de registro</span><strong>{isCompetitor?'Competidor':isAdmin?'Administrador':'Avaliador'}</strong></div>}
      <Field label="Nome completo"><input required value={value.name||''} onChange={e=>set('name',e.target.value)}/></Field>
      {!isCompetitor&&<>
        <Field label="Nome de usuário"><input required autoComplete="off" value={value.username||''} onChange={e=>set('username',e.target.value)} placeholder="nome.sobrenome"/></Field>
        <Field label="E-mail institucional"><input type="email" autoComplete="email" value={value.email||''} onChange={e=>set('email',e.target.value)}/></Field>
        <Field label={existing?'Nova senha (deixe vazio para manter)':'Senha inicial (mínimo 8 caracteres)'}><input type="password" minLength={8} required={!existing} autoComplete="new-password" value={value.password||''} onChange={e=>set('password',e.target.value)}/></Field>
        {!isAdmin&&<fieldset className="stm-user-occupations"><legend>Ocupações autorizadas</legend>{db.occupations.map(o=><label key={o.id}><input type="checkbox" checked={(value.occupationIds||[]).includes(o.id)} onChange={e=>set('occupationIds',e.target.checked?[...new Set([...(value.occupationIds||[]),o.id])]:(value.occupationIds||[]).filter(id=>id!==o.id))}/> #{String(o.code).padStart(2,'0')} · {o.name}</label>)}</fieldset>}
        {!isAdmin&&!value.occupationIds?.length&&<small className="stm-person-hint">Selecione pelo menos uma ocupação para o avaliador acessar.</small>}
      </>}
      {isCompetitor&&<>
        <Field label="Ocupação"><SelectField required value={value.occupationId||''} onChange={e=>set('occupationId',e.target.value)}><option value="">Selecione uma ocupação</option>{db.occupations.map(o=><option key={o.id} value={o.id}>#{String(o.code).padStart(2,'0')} · {o.name}</option>)}</SelectField></Field>
        <Field label="Foto (URL opcional)"><input type="url" value={String(value.photo||'').startsWith('data:')?'':value.photo||''} onChange={e=>set('photo',e.target.value)} placeholder="https://..."/></Field>
        <Field label="Observações"><textarea rows={3} value={value.notes||''} onChange={e=>set('notes',e.target.value)}/></Field>
        <p className="stm-person-hint">Competidores participam das provas e execuções, mas não possuem acesso de login.</p>
      </>}
      {existing&&<label className="stm-user-active"><input type="checkbox" checked={value.active!==false} onChange={e=>set('active',e.target.checked)}/> Registro ativo</label>}
      {!existing&&<p className="stm-person-hint">O novo registro será criado automaticamente como ativo.</p>}
      {error&&<div role="alert" className="stm-login-error">{error}</div>}
      {existing&&isCompetitor&&<div className="stm-person-danger"><Button variant="danger-ghost" disabled={busy} onClick={async()=>{setError('');const ok=await onDelete(source.id);if(ok)onClose()}}>Excluir competidor</Button></div>}
      </div>
      <Footer cancel={onClose} busy={busy}/>
    </form>
  </Modal>;
}

export default function Admin({db,onOccupation,onSaveRecord,onDeleteRecord,currentUser,onLogout}){
  const [occupationsOpen,setOccupationsOpen]=useState(false);
  const [accounts,setAccounts]=useState([]);
  const [editing,setEditing]=useState(undefined);
  const [error,setError]=useState('');
  const load=useCallback(()=>request('/admin/users').then(rows=>{setAccounts(rows);setError('')}).catch(err=>setError(err.message)),[]);
  useEffect(()=>{load()},[load]);
  const occupations=useMemo(()=>[...db.occupations].sort((a,b)=>Number(a.code)-Number(b.code)),[db.occupations]);
  const people=useMemo(()=>[
    ...accounts.map(a=>({id:a.id,name:a.name,kind:a.role==='admin'?'admin':'evaluator',active:a.active!==false,source:a,info:a.email||`@${a.username}`})),
    ...db.competitors.map(c=>({id:c.id,name:c.name,kind:'competitor',active:c.active!==false,source:c,info:db.occupations.find(o=>o.id===c.occupationId)?.name||'Ocupação não definida'}))
  ].sort((a,b)=>a.kind===b.kind?sortName(a,b):a.kind==='admin'?-1:b.kind==='admin'?1:sortName(a,b)),[accounts,db.competitors,db.occupations]);
  async function savePerson(resource,payload){
    if(resource==='competitor')await onSaveRecord('competitors',payload);
    else{await request(payload.id?`/admin/users/${encodeURIComponent(payload.id)}`:'/admin/users',{method:payload.id?'PUT':'POST',body:payload});if(payload.id===currentUser.id){await onLogout();return}await load()}
  }
  return <div className="stm-admin-shell">
    <header className="stm-admin-header"><div className="stm-admin-brand"><span>STM</span><strong>Skill Training Manager</strong></div><div className="stm-admin-account"><span><ShieldCheck size={15}/> {currentUser.name}</span><button type="button" onClick={onLogout}><LogOut size={15}/> Sair</button></div></header>
    <main className="stm-admin-content">
      <div className="stm-admin-hero"><div className="eyebrow">ADMINISTRAÇÃO DA ESCOLA</div><h1>Gestão de treinamentos</h1><p>Ocupações e usuários da escola. Edições e demais referências são configuradas dentro de cada modalidade.</p></div>
      <div className="stm-admin-management">
        <section className="panel"><header className="panel-heading"><div><h2>Ocupações</h2><p>Entre na modalidade para gerenciar provas, edições, execuções e competências.</p></div><Button variant="subtle" onClick={()=>setOccupationsOpen(true)}><Settings2 size={15}/> Gerenciar</Button></header>
          <div className="stm-admin-occupations">{occupations.map(o=>{const comps=db.competitors.filter(c=>c.occupationId===o.id);const exams=db.exams.filter(e=>e.occupationId===o.id);return <button type="button" key={o.id} onClick={()=>onOccupation(o)}><span className="stm-admin-code">#{String(o.code).padStart(2,'0')}</span><span className="stm-admin-occ-name"><strong>{o.name}</strong><small>{comps.length} participante{comps.length===1?'':'s'} · {exams.length} prova{exams.length===1?'':'s'}</small></span><ArrowRight size={17}/></button>})}</div>
        </section>
        <section className="panel"><header className="panel-heading"><div><h2>Usuários</h2><p>Avaliadores com acesso ao sistema e competidores cadastrados para treinamento.</p></div><Button onClick={()=>setEditing({kind:'evaluator',source:null})}><Plus size={15}/> Novo usuário</Button></header>
          <div className="stm-admin-person-list">{people.map(person=><button type="button" className="stm-admin-person" key={`${person.kind}-${person.id}`} onClick={()=>setEditing({kind:person.kind,source:person.source})}><span className="stm-admin-person-icon">{person.kind==='admin'?<ShieldCheck size={17}/>:person.kind==='competitor'?<UserRound size={17}/>:<GraduationCap size={17}/>}</span><span className="stm-admin-person-data"><strong>{person.name}</strong><small>{person.kind==='admin'?'Administrador':person.kind==='competitor'?'Competidor':'Avaliador'} · {person.info}{person.active?'':' · Inativo'}</small></span><Pencil size={15}/></button>)}{!people.length&&<div className="empty">Nenhum usuário cadastrado.</div>}</div>
          {error&&<p role="alert" className="error-text stm-admin-list-error">{error}</p>}
        </section>
      </div>
    </main>
    {occupationsOpen&&<OccupationSettingsModal db={db} onSave={onSaveRecord} onDelete={onDeleteRecord} onClose={()=>setOccupationsOpen(false)}/>}
    {editing!==undefined&&<PersonEditor editing={editing} db={db} onSave={savePerson} onDelete={id=>onDeleteRecord('competitors',id)} onClose={()=>{setEditing(undefined);load()}}/>}
  </div>;
}
