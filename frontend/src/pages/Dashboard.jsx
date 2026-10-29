import React,{useMemo,useState} from 'react';
import {Activity,BookOpen,CalendarDays,ClipboardCheck,TrendingUp,Target,ArrowRight,BarChart3} from 'lucide-react';
import {PageTitle,Badge,Empty} from '../components/UI.jsx';
import {points,percent,lookup,today} from '../lib/api.js';
export default function Dashboard({db,selectTab}){
 const {exams,executions,competitors,activities,wsos}=db;
 const [competitorId,setCompetitorId]=useState('all');
 const tests=useMemo(()=>competitorId==='all'?executions:executions.filter(x=>x.competitorId===competitorId),[executions,competitorId]);
 const valid=tests.filter(x=>x.overallScore!=null&&x.maxScore>0);
 const denom=valid.reduce((n,x)=>n+x.maxScore,0);const score=denom?valid.reduce((n,x)=>n+x.overallScore,0)/denom*100:null;
 const recent=[...tests].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
 const upcoming=[...activities].filter(x=>x.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
 const wsosTotals=wsos.map(w=>{let obtained=0,total=0,count=0;for(const ex of tests){for(const part of ex.wsosResults||[]){if(String(part.wsosSection)===String(w.code)){obtained+=part.earned;total+=part.maxScore;count++}}}return {...w,obtained,total,count,percentage:total?obtained/total*100:0}});
 return <><PageTitle eyebrow="CENTRAL DE TREINAMENTO" title="Visão geral" desc="Notas recentes, histórico, atividades e acompanhamento WSOS." actions={<select className="select-small" value={competitorId} onChange={e=>setCompetitorId(e.target.value)}><option value="all">Todos os competidores</option>{competitors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}/>
 <div className="stat-grid">{[{t:'Provas cadastradas',v:exams.length,i:BookOpen},{t:'Execuções registradas',v:tests.length,i:ClipboardCheck},{t:'Aproveitamento geral',v:percent(score),i:TrendingUp},{t:'Atividades cadastradas',v:activities.length,i:CalendarDays}].map(s=><div className="stat-card" key={s.t}><s.i size={20}/><strong>{s.v}</strong><span>{s.t}</span></div>)}</div>
 <div className="two-column"><section className="panel"><header className="panel-heading"><div><h2>Últimas provas em treinamento</h2><p>Execuções registradas, das mais recentes para as antigas</p></div><button className="text-action" onClick={()=>selectTab('executions')}>Ver todas <ArrowRight size={14}/></button></header>{recent.length?recent.map(x=><div className="record" key={x.id}><div><strong>{lookup(exams,x.examId,'title')}</strong><small>{x.date} · {lookup(competitors,x.competitorId)}</small></div><Badge tone={x.complete?'blue':'amber'}>{x.overallScore!=null?percent(x.percentage):'Parcial'}</Badge></div>):<Empty title="Sem execuções" subtitle="Cadastre a primeira aplicação no módulo Execuções."/>}</section>
 <section className="panel"><header className="panel-heading"><div><h2>Atividades programadas</h2><p>Agenda e atividades do treinamento</p></div><button className="text-action" onClick={()=>selectTab('activities')}>Ver calendário <ArrowRight size={14}/></button></header>{upcoming.length?upcoming.map(x=><div className="record" key={x.id}><div><strong>{x.title}</strong><small>{x.date} · {x.startTime||'—'} {x.location?`· ${x.location}`:''}</small></div><Badge>{x.status||'Planejada'}</Badge></div>):<Empty title="Sem atividades futuras" subtitle="Adicione compromissos no calendário."/>}</section></div>
 <section className="panel"><header className="panel-heading"><div><h2>Desempenho por WSOS</h2><p>Somente avaliações com detalhamento por WSOS ou aspectos. Dados parciais identificados.</p></div><BarChart3 size={20}/></header><div className="bars">{wsosTotals.map(w=><div className="bar-row" key={w.id}><div className="bar-meta"><strong>{w.code} · {w.name}</strong><span>{w.count?`${percent(w.percentage)} · ${points(w.obtained)}/${points(w.total)} pts`:'Sem dados'}</span></div><div className="bar-track"><span style={{width:`${Math.min(100,w.percentage)}%`}}/></div></div>)}</div></section>
 </>
}
