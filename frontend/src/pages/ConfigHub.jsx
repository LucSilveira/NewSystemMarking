import React from 'react';
import {ArrowLeft,BriefcaseBusiness,GraduationCap,Users,ChevronRight} from 'lucide-react';
import {configPath} from '../lib/occupationRouting.js';

const ITEMS=[
  {key:'occupations', title:'Ocupações', desc:'Modalidades da escola, códigos e descrições.', Icon:BriefcaseBusiness},
  {key:'competitors', title:'Competidores', desc:'Cadastro geral dos participantes e suas fotos.', Icon:Users},
  {key:'evaluators', title:'Avaliadores', desc:'Professores responsáveis por cada ocupação.', Icon:GraduationCap},
];

export default function ConfigHub({db,onBack,onOpen}){
  return <div className="occupation-picker-page occupation-picker-page--compact">
    <div className="occupation-picker-sheen" aria-hidden="true"/>
    <header className="occupation-picker-topbar">
      <div className="occupation-picker-brand"><span className="occupation-picker-logo">STM</span><div><strong>Skill Training</strong><small>CONFIGURAÇÕES DA ESCOLA</small></div></div>
      <button type="button" className="occupation-picker-config" onClick={onBack}><ArrowLeft size={16}/> Voltar às ocupações</button>
    </header>
    <main className="occupation-picker-content">
      <div className="occupation-picker-intro occupation-picker-intro--compact">
        <div className="occupation-picker-eyebrow">CONFIGURAÇÕES GERAIS</div>
        <h1>O que você deseja configurar?</h1>
        <p>{db.occupations.length} ocupações · {db.competitors.length} competidores · {db.evaluators.length} avaliadores</p>
      </div>
      <div className="config-hub-grid">
        {ITEMS.map(item=>{
          const count=item.key==='occupations'?db.occupations.length:item.key==='competitors'?db.competitors.length:db.evaluators.length;
          return <button key={item.key} type="button" className="config-hub-card" onClick={()=>onOpen(item.key)}>
            <span className="config-hub-icon"><item.Icon size={22}/></span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
              <small>{count} registro{count===1?'':'s'}</small>
            </div>
            <ChevronRight size={18}/>
          </button>;
        })}
      </div>
    </main>
  </div>;
}
