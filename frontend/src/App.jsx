import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {LayoutDashboard,BookOpen,ClipboardCheck,CalendarDays,Users,Target,Settings,RefreshCw,AlertCircle,Menu,X,ArrowLeft,ChevronRight,LogOut,ShieldCheck} from 'lucide-react';
import {list,create,update,remove,request} from './lib/api.js';
import {Badge} from './components/UI.jsx';
import {readOccupationRoute,occupationCode,occupationPath,ROUTES} from './lib/occupationRouting.js';
import {soleEvaluatorDestination} from './lib/workspaceAccess.js';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import TrainingOverview from './pages/TrainingOverview.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Exams from './pages/Exams.jsx';
import Executions from './pages/Executions.jsx';
import Activities from './pages/Activities.jsx';
import Competitors from './pages/Competitors.jsx';
import Competencies from './pages/Competencies.jsx';
import References from './pages/References.jsx';

const KEYS=['occupations','occupationAreas','wsos','examTypes','editions','competitors','competencies','exams','executions','technicalAssessments','activities','evaluators','teams'];
const EMPTY=Object.fromEntries(KEYS.map(x=>[x,[]]));
const NAV=[
 {key:'dashboard',label:'Visão geral',icon:LayoutDashboard},
 {key:'exams',label:'Provas',icon:BookOpen},
 {key:'executions',label:'Execuções',icon:ClipboardCheck},
 {key:'activities',label:'Atividades',icon:CalendarDays},
 {key:'competitors',label:'Competidores',icon:Users},
 {key:'competencies',label:'Competências',icon:Target},
 {key:'references',label:'Configurações da modalidade',icon:Settings}
];
export default function App(){
 const [route,setRoute]=useState(()=>readOccupationRoute(window.location.pathname));
 const [user,setUser]=useState(null),[authReady,setAuthReady]=useState(false);
 const [db,setDb]=useState(EMPTY),[loading,setLoading]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState(null),[menu,setMenu]=useState(false);
 const go=useCallback((path,replace=false)=>{if(window.location.pathname!==path){if(replace)window.history.replaceState(null,'',path);else window.history.pushState(null,'',path)}setRoute(readOccupationRoute(path));setMenu(false);window.scrollTo(0,0)},[]);
 useEffect(()=>{const pop=()=>{setRoute(readOccupationRoute(window.location.pathname));setMenu(false)};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[]);
 useEffect(()=>{let active=true;request('/auth/me').then(({user})=>{if(active)setUser(user)}).catch(()=>{if(active)setUser(null)}).finally(()=>{if(active)setAuthReady(true)});return()=>{active=false}},[]);
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{const entries=await Promise.all(KEYS.map(async key=>[key,await list(key)]));setDb(Object.fromEntries(entries))}catch(e){setError(e.message);if(/sessão|acesso não autorizado/i.test(e.message))setUser(null)}finally{setLoading(false)}},[]);
 useEffect(()=>{if(user)refresh()},[user?.id,refresh]);
 const afterLogin=async(nextUser)=>{setUser(nextUser);const landing=nextUser.role==='admin'?'/painel':'/painel';go(landing,true)};
 const logout=async()=>{try{await request('/auth/logout',{method:'POST'})}catch{}setUser(null);setDb(EMPTY);go('/login',true)};
 const notify=(message,bad=false)=>{setToast({message,bad});setTimeout(()=>setToast(null),3800)};
 async function saveRecord(resource,record){try{const exists=db[resource].some(x=>x.id===record.id);const data=exists?await update(resource,record):await create(resource,record);await refresh();notify(exists?'Registro atualizado':'Registro criado');return data}catch(e){notify(e.message,true);throw e}}
 async function deleteRecord(resource,id,options={}){if(!options.skipConfirm&&!window.confirm(options.confirmMessage||'Deseja excluir este registro? Os vínculos existentes podem impedir a remoção.'))return false;try{await remove(resource,id);await refresh();notify('Registro excluído');return true}catch(e){notify(e.message,true);return false}}
 const currentOccupation=route.type==='workspace'?db.occupations.find(o=>occupationCode(o.code)===route.code):null;
 const accessible=currentOccupation&&(user?.role==='admin'||user?.occupationIds?.includes(currentOccupation.id));
 const activeId=accessible?currentOccupation.id:null;
 const page=route.type==='workspace'?route.page:'dashboard';
 const changePage=key=>{if(accessible&&ROUTES[key])go(occupationPath(currentOccupation.code,key))};
 const scopedDb=useMemo(()=>({...db,
  occupations:db.occupations.filter(o=>o.id===activeId),
  examTypes:db.examTypes.filter(x=>!x.occupationId||x.occupationId===activeId),
  occupationAreas:db.occupationAreas.filter(x=>x.occupationId===activeId),
  wsos:db.wsos.filter(x=>x.occupationId===activeId),
  competencies:db.competencies.filter(x=>x.occupationId===activeId),
  editions:db.editions.filter(x=>x.occupationId===activeId),
  competitors:db.competitors.filter(x=>x.occupationId===activeId),
  exams:db.exams.filter(x=>x.occupationId===activeId),
  teams:db.teams.filter(x=>x.occupationId===activeId),
  evaluators:db.evaluators.filter(x=>(x.occupationIds||[]).includes(activeId)),
  activities:db.activities.filter(x=>x.occupationId===activeId||(!x.occupationId&&(db.competitors.some(c=>c.id===x.competitorId&&c.occupationId===activeId)||db.exams.some(e=>e.id===x.examId&&e.occupationId===activeId)))),
  executions:db.executions.filter(x=>db.competitors.some(c=>c.id===x.competitorId&&c.occupationId===activeId)),
  technicalAssessments:db.technicalAssessments.filter(x=>db.competitors.some(c=>c.id===x.competitorId&&c.occupationId===activeId))
 }),[db,activeId]);
 const soleOccupationPath=useMemo(()=>soleEvaluatorDestination(user,db.occupations),[user,db.occupations]);
 useEffect(()=>{
  if(authReady&&user&&route.type==='home'&&soleOccupationPath&&!loading&&!error){
   go(soleOccupationPath,true);
  }
 },[authReady,user,route.type,soleOccupationPath,loading,error,go]);
 useEffect(()=>{if(authReady&&user&&route.type==='login')go('/painel',true)},[authReady,user,route.type,go]);
 useEffect(()=>{document.title=route.type==='workspace'&&currentOccupation?`${ROUTES[page]?.label} · #${occupationCode(currentOccupation.code)} · Skill Training`:user?'Treinamento e relatórios · Skill Training':'Entrar · Skill Training'},[route,currentOccupation,user,page]);
 const contentProps={db:scopedDb,saveRecord,deleteRecord,refresh};
 if(!authReady)return <div className="stm-auth-loading">Carregando acesso seguro...</div>;
 if(!user)return <Login onLogin={afterLogin}/>;
 if(route.type==='login')return <div className='stm-auth-loading'>Abrindo painel de treinamento...</div>;
 if(route.type==='home'){
  if(user.role==='evaluator'&&user.occupationIds?.length===1&&(loading||soleOccupationPath)&&!error)return <div className='stm-auth-loading'>{loading?'Carregando seu treinamento...':'Abrindo o painel da sua ocupação...'}</div>;
  return user.role==='admin'?<Admin db={db} onOccupation={o=>go(occupationPath(o.code))} onSaveRecord={saveRecord} onDeleteRecord={deleteRecord} currentUser={user} onLogout={logout}/>:<TrainingOverview db={db} user={user} onOccupation={o=>go(occupationPath(o.code))} onLogout={logout}/>;
 }
 if(route.type==='admin')return user.role==='admin'?<Admin db={db} onOccupation={o=>go(occupationPath(o.code))} onSaveRecord={saveRecord} onDeleteRecord={deleteRecord} currentUser={user} onLogout={logout}/>:<div className='occupation-route-error'><div className='occupation-route-error-card'><h1>Acesso não autorizado</h1><button onClick={()=>go('/painel')}>Voltar ao painel</button></div></div>;
 if(!accessible&&(!loading||route.type==='notfound'))return <div className="occupation-route-error"><div className="occupation-route-error-card"><span className="occupation-route-error-logo">STM</span><h1>Ocupação indisponível</h1><p>Este endereço não pertence às ocupações autorizadas para o seu acesso.</p><button onClick={()=>go('/painel')}><ArrowLeft size={17}/> Ir ao painel</button></div></div>;
 if(!accessible)return <div className="stm-auth-loading">Carregando ocupação...</div>;
 return <div className="app"><aside className={`sidebar ${menu?'open':''}`}>
  <div className="brand"><div className="brand-symbol">STM</div><div><strong>Skill Training</strong><span>PERFORMANCE MANAGER</span></div></div>
  <div className="occupation-context"><span className="occupation-context-caption">OCUPAÇÃO ATIVA</span><strong>#{occupationCode(currentOccupation.code)} · {currentOccupation.name}</strong>{!soleOccupationPath&&<button type="button" onClick={()=>go('/painel')}><ArrowLeft size={14}/> Painel principal</button>}</div>
  <div className="nav-caption">TREINAMENTO E RELATÓRIOS</div><nav className="navigation">{NAV.map(item=><button className={page===item.key?'active':''} key={item.key} onClick={()=>changePage(item.key)} aria-current={page===item.key?'page':undefined}><item.icon size={19}/>{item.label}{item.key==='exams'&&<small>{scopedDb.exams.length}</small>}</button>)}</nav>
  <div className="sidebar-end"><div className="database-info"><ShieldCheck size={17}/><div><strong>{user.name}</strong><small>{user.role==='admin'?'Administrador':'Avaliador'}</small></div></div><button className="stm-sidebar-logout" onClick={logout}><LogOut size={15}/> Encerrar sessão</button><span className="version">v0.9.4 · Acesso autenticado</span></div>
 </aside><div className="main"><header className="topbar"><div className="topbar-left"><button className="mobile-toggle" onClick={()=>setMenu(!menu)} aria-label={menu?'Fechar menu':'Abrir menu'}>{menu?<X size={21}/>:<Menu size={21}/>}</button>{!soleOccupationPath&&<><button type="button" className="occupation-topbar-back" onClick={()=>go('/painel')}>Painel</button><ChevronRight size={14}/></>}<span className="occupation-topbar-name">#{occupationCode(currentOccupation.code)} · {currentOccupation.name}</span><ChevronRight size={14}/><strong>{ROUTES[page]?.label}</strong></div><div className="topbar-right"><Badge tone="blue">{user.role==='admin'?'Administrador':'Avaliador'}</Badge><button className="refresh" title="Atualizar registros" onClick={refresh}><RefreshCw size={17}/></button></div></header><main className="content">
  {error&&<div className="banner error"><AlertCircle size={20}/><div><strong>Não foi possível carregar os registros.</strong><p>{error}</p></div><button onClick={refresh}>Tentar novamente</button></div>}
  {loading&&!error&&!db.occupations.length?<div className="loading">Carregando dados autorizados...</div>:<>
   {page==='dashboard'&&<Dashboard db={scopedDb} selectTab={changePage}/>}
   {page==='exams'&&<Exams {...contentProps}/>}
   {page==='executions'&&<Executions {...contentProps}/>}
   {page==='activities'&&<Activities {...contentProps}/>}
   {page==='competitors'&&<Competitors {...contentProps}/>}
   {page==='competencies'&&<Competencies {...contentProps}/>}
   {page==='references'&&<References db={scopedDb} saveRecord={saveRecord} deleteRecord={deleteRecord} title="Configurações da modalidade" desc="Áreas técnicas, WSOS, tipos de prova e edições de referência." allowedCategories={['occupationAreas','wsos','examTypes','editions']}/>}
  </>}
 </main></div>{toast&&<div className={`toast ${toast.bad?'bad':''}`}><span>{toast.message}</span><button onClick={()=>setToast(null)} aria-label="Fechar aviso"><X size={15}/></button></div>}</div>;
}
