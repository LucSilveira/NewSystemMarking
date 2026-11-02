import React,{useEffect,useState} from 'react';
import {BookOpen,CalendarDays,ClipboardCheck,TrendingUp,ArrowRight,BarChart3} from 'lucide-react';
import SelectField from '../components/SelectField.jsx';
import {PageTitle,Badge,Empty} from '../components/UI.jsx';
import {points,percent,lookup,request} from '../lib/api.js';
const dateBR=date=>/^\d{4}-\d{2}-\d{2}$/.test(String(date))?`${date.slice(8,10)}/${date.slice(5,7)}/${date.slice(0,4)}`:date||'—';
export default function Dashboard({db,selectTab}){
  const {exams,executions,competitors,activities,wsos,occupations}=db;
  const occupationId=occupations[0]?.id;
  const [competitorId,setCompetitorId]=useState('all');
  const [summary,setSummary]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  // Após um cadastro, a API devolve somente o resumo agregado da ocupação.
  useEffect(()=>{
    if(!occupationId){setSummary(null);return}
    let active=true;setLoading(true);setError('');
    const params=new URLSearchParams({occupationId,competitorId});
    request(`/reports/overview?${params}`).then(data=>{if(active)setSummary(data)}).catch(err=>{if(active){setSummary(null);setError(err.message)}}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[occupationId,competitorId,exams,executions,activities,wsos]);
  const stats=summary?.counts;
  const wsosTotals=summary?.wsosResults||[];
  return <>
    <PageTitle eyebrow="CENTRAL DE TREINAMENTO" title="Visão geral" desc="Notas recentes, histórico, atividades e acompanhamento WSOS." actions={<SelectField className="select-small" value={competitorId} onChange={e=>setCompetitorId(e.target.value)}><option value="all">Todos os competidores</option>{competitors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</SelectField>}/>
    {error&&<div className="banner error" role="alert">Não foi possível consultar o resumo na API: {error}</div>}
    {loading&&<div className="loading" aria-live="polite">Atualizando indicadores...</div>}
    <div className="stat-grid">{[
      {t:'Provas cadastradas',v:stats?.exams??'—',i:BookOpen},
      {t:'Execuções registradas',v:stats?.executions??'—',i:ClipboardCheck},
      {t:'Aproveitamento geral',v:percent(summary?.overall),i:TrendingUp},
      {t:'Atividades cadastradas',v:stats?.activities??'—',i:CalendarDays}
    ].map(s=><div className="stat-card" key={s.t}><s.i size={20}/><strong>{s.v}</strong><span>{s.t}</span></div>)}</div>
    <div className="two-column">
      <section className="panel"><header className="panel-heading"><div><h2>Últimas provas em treinamento</h2><p>Execuções registradas, das mais recentes para as antigas</p></div><button className="text-action" onClick={()=>selectTab('executions')}>Ver todas <ArrowRight size={14}/></button></header>
        {summary?.latest?.length?summary.latest.map(x=><div className="record" key={x.id}><div><strong>{lookup(exams,x.examId,'title')}</strong><small>{dateBR(x.date)} · {lookup(competitors,x.competitorId)}</small></div><Badge tone={x.status==='finalized'?'blue':'amber'}>{x.status==='finalized'?percent(x.percentage):'Rascunho'}</Badge></div>):<Empty title="Sem execuções" subtitle="Cadastre a primeira aplicação no módulo Execuções."/>}</section>
      <section className="panel"><header className="panel-heading"><div><h2>Atividades programadas</h2><p>Agenda e atividades do treinamento</p></div><button className="text-action" onClick={()=>selectTab('activities')}>Ver calendário <ArrowRight size={14}/></button></header>
        {summary?.upcoming?.length?summary.upcoming.map(x=><div className="record" key={x.id}><div><strong>{x.title}</strong><small>{dateBR(x.date)} · {x.startTime||'—'} {x.location?`· ${x.location}`:''}</small></div><Badge>{x.status||'Planejada'}</Badge></div>):<Empty title="Sem atividades futuras" subtitle="Adicione compromissos no calendário."/>}</section>
    </div>
    <section className="panel"><header className="panel-heading"><div><h2>Desempenho por WSOS</h2><p>Somente notas de correções finalizadas, calculadas pela API.</p></div><BarChart3 size={20}/></header>
      <div className="bars">{wsosTotals.map(w=><div className="bar-row" key={w.id}><div className="bar-meta"><strong>{w.code} · {w.name}</strong><span>{w.count?`${percent(w.percentage)} · ${points(w.earned)}/${points(w.maxScore)} pts`:'Sem dados'}</span></div><div className="bar-track"><span style={{width:`${Math.min(100,w.percentage||0)}%`}}/></div></div>)}</div>
    </section>
  </>;
}
