import React from 'react';
import {Users,BookOpen,GraduationCap,ChevronRight,UserRound} from 'lucide-react';
import {PageTitle,Badge} from '../components/UI.jsx';
export default function School({db,scopeOccupationId,setScopeOccupationId}) {
 const ordered=[...db.occupations].sort((a,b)=>Number(a.code)-Number(b.code));
 return <>
  <PageTitle eyebrow="TREINAMENTO DA ESCOLA" title="Ocupações e participantes" desc="Cada ocupação tem suas próprias provas, áreas, WSOS e competências. Avaliadores e competidores podem ser cadastrados mesmo sem um acesso ao sistema."/>
  <div className="school-stats">
   <div><strong>{ordered.length}</strong><span>Ocupações</span></div>
   <div><strong>{db.evaluators.length}</strong><span>Avaliadores</span></div>
   <div><strong>{db.competitors.length}</strong><span>Competidores</span></div>
   <div><strong>{db.teams.length}</strong><span>Equipes</span></div>
  </div>
  <div className="school-grid">{ordered.map(occupation=>{
   const evaluators=db.evaluators.filter(x=>(x.occupationIds||[]).includes(occupation.id));
   const competitors=db.competitors.filter(x=>x.occupationId===occupation.id);
   const exams=db.exams.filter(x=>x.occupationId===occupation.id);
   const teams=db.teams.filter(x=>x.occupationId===occupation.id);
   return <button type="button" key={occupation.id} className={`school-card ${scopeOccupationId===occupation.id?'selected':''}`} onClick={()=>setScopeOccupationId(occupation.id)}>
    <div className="school-card-header"><strong>#{String(occupation.code).padStart(2,'0')}</strong><span>{exams.length} prova(s)</span><ChevronRight size={18}/></div>
    <h3>{occupation.name}</h3>
    <div className="school-card-people"><div><GraduationCap size={15}/><span>Avaliador: {evaluators.map(x=>x.name).join(' · ')||'Não definido'}</span></div>
    <div><Users size={15}/><span>Competidor{competitors.length===1?'':'es'}: {competitors.map(x=>x.name).join(' · ')||'Não definido'}</span></div></div>
    {teams.length>0&&<div className="school-card-footer">{teams.map(t=><span key={t.id}>Equipe: {t.name} ({t.competitorIds.length} integrantes)</span>)}</div>}
   </button>
  })}</div>
  <p className="note">Selecionar uma ocupação muda o contexto das telas de Provas, Execuções, Competidores, Competências e Atividades. Nenhuma seleção altera as notas ou os dados armazenados.</p>
 </>;
}
