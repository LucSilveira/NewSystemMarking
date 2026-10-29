import React,{useCallback,useEffect,useState} from 'react';
import {LayoutDashboard,BookOpen,ClipboardCheck,CalendarDays,Users,Target,Settings,Database,RefreshCw,AlertCircle,CheckCircle2,Menu,X,ArrowLeft,ChevronRight} from 'lucide-react';
import {list,create,update,remove} from './lib/api.js';
import {Badge} from './components/UI.jsx';
import {readOccupationRoute,occupationCode,occupationPath,ROUTES} from './lib/occupationRouting.js';
import OccupationPicker from './pages/OccupationPicker.jsx';
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
  {key:'references',label:'Configurações da modalidade',icon:Settings},
];
export default function App(){
  const [route,setRoute]=useState(()=>readOccupationRoute(window.location.pathname));
  const [db,setDb]=useState(EMPTY),[loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState(null),[menu,setMenu]=useState(false);
  const refresh=useCallback(async()=>{setLoading(true);setError('');try{const entries=await Promise.all(KEYS.map(async k=>[k,await list(k)]));setDb(Object.fromEntries(entries))}catch(e){setError(e.message)}finally{setLoading(false)}},[]);
  useEffect(()=>{refresh()},[refresh]);
  useEffect(()=>{
    const onPop=()=>{setRoute(readOccupationRoute(window.location.pathname));setMenu(false)};
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[]);
  const go=useCallback((path)=>{
    if(window.location.pathname!==path) window.history.pushState(null,'',path);
    setRoute(readOccupationRoute(path));setMenu(false);window.scrollTo(0,0);
  },[]);
  const notify=(message,bad=false)=>{setToast({message,bad});setTimeout(()=>setToast(null),3800)};
  async function saveRecord(resource,record){try{const exists=db[resource].some(x=>x.id===record.id);const data=exists?await update(resource,record):await create(resource,record);await refresh();notify(exists?'Registro atualizado':'Registro criado');return data}catch(e){notify(e.message,true);throw e}}
  async function deleteRecord(resource,id){if(!window.confirm('Deseja excluir este registro? Os vínculos existentes podem impedir a remoção.'))return false;try{await remove(resource,id);await refresh();notify('Registro excluído');return true}catch(e){notify(e.message,true);return false}}
  const currentOccupation=route.type==='workspace'?db.occupations.find(o=>occupationCode(o.code)===route.code):null;
  const activeId=currentOccupation?.id;
  const page=route.type==='workspace'?route.page:'dashboard';
  const changePage=key=>{if(currentOccupation&&ROUTES[key])go(occupationPath(currentOccupation.code,key))};
  const scopedDb={...db,
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
    activities:db.activities.filter(x=>x.occupationId===activeId || (!x.occupationId&&(db.competitors.some(c=>c.id===x.competitorId&&c.occupationId===activeId)||db.exams.some(e=>e.id===x.examId&&e.occupationId===activeId)))),
    executions:db.executions.filter(x=>db.competitors.some(c=>c.id===x.competitorId&&c.occupationId===activeId)),
    technicalAssessments:db.technicalAssessments.filter(x=>db.competitors.some(c=>c.id===x.competitorId&&c.occupationId===activeId))
  };
  useEffect(()=>{document.title=route.type==='home'?'Escolher ocupação · Skill Training':currentOccupation?`${ROUTES[page]?.label} · #${occupationCode(currentOccupation.code)} · Skill Training`:'Skill Training Manager'},[route.type,currentOccupation,page]);
  const contentProps={db:scopedDb,saveRecord,deleteRecord,refresh};
  if(route.type==='home')return <OccupationPicker db={db} loading={loading} error={error} onRetry={refresh} onSelect={occupation=>go(occupationPath(occupation.code,'dashboard'))} onSaveRecord={saveRecord} onDeleteRecord={deleteRecord}/>;
  if(!currentOccupation && (route.type==='notfound'||!loading))return <div className="occupation-route-error"><div className="occupation-route-error-card"><span className="occupation-route-error-logo">STM</span><h1>Esta ocupação não foi encontrada.</h1><p>O endereço pode estar incorreto ou a ocupação pode não estar cadastrada. Selecione uma modalidade disponível na página inicial.</p>{error&&<p className="occupation-route-error-api">Não foi possível carregar a API: {error}</p>}<button onClick={()=>go('/')}> <ArrowLeft size={17}/> Escolher ocupação</button>{error&&<button className="occupation-route-retry" onClick={refresh}><RefreshCw size={16}/> Tentar novamente</button>}</div></div>;
  if(!currentOccupation)return <div className="loading" style={{margin:'18vh auto',textAlign:'center'}}>Carregando ocupação...</div>;
  return <div className="app"><aside className={`sidebar ${menu?'open':''}`}>
    <div className="brand"><div className="brand-symbol">STM</div><div><strong>Skill Training</strong><span>PERFORMANCE MANAGER</span></div></div>
    <div className="occupation-context"><span className="occupation-context-caption">OCUPAÇÃO ATIVA</span><strong>#{occupationCode(currentOccupation.code)} · {currentOccupation.name}</strong><button type="button" onClick={()=>go('/')}><ArrowLeft size={14}/> Trocar ocupação</button></div>
    <div className="nav-caption">ACOMPANHAMENTO</div>
    <nav className="navigation">{NAV.map(item=><button className={page===item.key?'active':''} key={item.key} onClick={()=>changePage(item.key)} aria-current={page===item.key?'page':undefined}><item.icon size={19}/>{item.label}{item.key==='exams'&&<small>{scopedDb.exams.length}</small>}</button>)}</nav>
    <div className="sidebar-end"><div className="database-info"><Database size={17}/><div><strong>Armazenamento local</strong><small>JSON Server · arquivos separados</small></div></div><p>Dados em <code>backend/data/</code>. O contexto da URL organiza a navegação, mas não substitui autenticação.</p><span className="version">v0.8.1 · Espaços por ocupação</span></div>
  </aside><div className="main"><header className="topbar"><div className="topbar-left"><button className="mobile-toggle" onClick={()=>setMenu(!menu)} aria-label={menu?'Fechar menu':'Abrir menu'}>{menu?<X size={21}/>:<Menu size={21}/>}</button><button type="button" className="occupation-topbar-back" onClick={()=>go('/')} title="Escolher outra ocupação">Ocupações</button><ChevronRight size={14}/><span className="occupation-topbar-name" title={currentOccupation.name}>#{occupationCode(currentOccupation.code)} · {currentOccupation.name}</span><ChevronRight size={14}/><strong>{ROUTES[page]?.label}</strong></div><div className="topbar-right"><Badge tone="blue">Ambiente local</Badge><button className="refresh" title="Atualizar registros" onClick={refresh}><RefreshCw size={17}/></button></div></header><main className="content">
    {error&&<div className="banner error"><AlertCircle size={20}/><div><strong>Não foi possível conectar à API.</strong><p>{error}. Inicie o back-end em http://127.0.0.1:3001.</p></div><button onClick={refresh}>Tentar novamente</button></div>}
    {loading&&!error&&db.exams.length===0?<div className="loading">Carregando registros do JSON Server...</div>:<>
      {page==='dashboard'&&<Dashboard db={scopedDb} selectTab={changePage}/>}
      {page==='exams'&&<Exams {...contentProps}/>}
      {page==='executions'&&<Executions {...contentProps}/>}
      {page==='activities'&&<Activities {...contentProps}/>}
      {page==='competitors'&&<Competitors {...contentProps}/>}
      {page==='competencies'&&<Competencies {...contentProps}/>}
      {page==='references'&&<References db={scopedDb} saveRecord={saveRecord} deleteRecord={deleteRecord} title='Configurações da modalidade' desc='Áreas técnicas, WSOS, tipos de prova e edições de referência.' allowedCategories={['occupationAreas','wsos','examTypes','editions']}/>}
    </>}
  </main></div>{toast&&<div className={`toast ${toast.bad?'bad':''}`}><span>{toast.message}</span><button onClick={()=>setToast(null)} aria-label="Fechar aviso"><X size={15}/></button></div>}</div>;
}
