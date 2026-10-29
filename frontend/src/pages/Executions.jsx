import React,{useEffect,useMemo,useState} from 'react';
import {Plus,ClipboardCheck,Pencil} from 'lucide-react';
import {Button,Field,Modal,PageTitle,Badge,Empty,Footer} from '../components/UI.jsx';
import {uid,clone,today,lookup,aspectList,points,percent} from '../lib/api.js';
const MODES=[{key:'overall',name:'Nota geral'},{key:'wsos',name:'Por WSOS'},{key:'subcriteria',name:'Por subcritério'},{key:'aspects',name:'Por aspecto CIS'}];
function items(exam,mode){if(!exam)return [];
 if(mode==='overall')return [{id:'overall',label:'Pontuação total',maxScore:Number(exam.maxScore)}];
 if(mode==='subcriteria')return (exam.subcriteria||[]).map(s=>({id:s.id,label:`${s.code} — ${s.title||'Sem título'}`,maxScore:(s.aspects||[]).reduce((n,a)=>n+Number(a.maxScore||0),0)}));
 if(mode==='wsos'){const group=new Map();for(const a of aspectList(exam))if(a.wsosSection){const id=String(a.wsosSection);group.set(id,(group.get(id)||0)+Number(a.maxScore||0))}return [...group].map(([id,maxScore])=>({id,label:`WSOS ${id}`,maxScore}))}
 return aspectList(exam).map(a=>({id:a.id,label:`${a.subcriterionTitle} · ${a.description}`,maxScore:Number(a.maxScore),method:a.method}));
}
function ExecutionEditor({source,db,onClose,onSave}){
 const [form,setForm]=useState(clone(source));const [busy,setBusy]=useState(false);
 const exam=db.exams.find(x=>x.id===form.examId);
 const options=items(form.examSnapshot||exam,form.mode);
 const set=(key,val)=>setForm(f=>({...f,[key]:val}));
 const changeScore=(id,raw,method)=>setForm(f=>({...f,scores:[...(f.scores||[]).filter(x=>x.id!==id), ...(raw===''?[]:[{id,...(method==='J'?{judgementLevel:Number(raw)}:{score:Number(raw)})}])] }));
 const scored=options.filter(x=>form.scores?.some(s=>s.id===x.id)).length;
 const approximate=(form.scores||[]).reduce((n,s)=>{const row=options.find(o=>o.id===s.id);return n+(s.judgementLevel!=null?((row?.maxScore||0)*s.judgementLevel/3):Number(s.score||0))},0);
 async function submit(e){e.preventDefault();if(!form.examId||!form.competitorId)return alert('Selecione prova e competidor');setBusy(true);try{const data={...form};delete data._new;await onSave(data);onClose()}finally{setBusy(false)}}
 return <Modal title={source._new?'Registrar execução':'Editar execução'} subtitle="A correção pode começar pela nota geral e evoluir para CIS." onClose={onClose} wide><form onSubmit={submit}><div className="form-grid">
 <div className="grid-two"><Field label="Competidor"><select required value={form.competitorId} onChange={e=>set('competitorId',e.target.value)}>{!form.competitorId&&<option value="">Selecione...</option>}{db.competitors.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Data de execução"><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} required/></Field></div>
 <Field label="Prova"><select disabled={!source._new} required value={form.examId} onChange={e=>setForm(f=>({...f,examId:e.target.value,scores:[],mode:'overall'}))}><option value="">Selecione uma prova...</option>{db.exams.map(x=><option key={x.id} value={x.id}>{x.module} · {x.title} ({points(x.maxScore)} pts)</option>)}</select></Field>
 <div className="grid-two"><Field label="Atividade atrelada (opcional)"><select value={form.activityId||''} onChange={e=>set('activityId',e.target.value||null)}><option value="">Sem vínculo</option>{db.activities.map(x=><option key={x.id} value={x.id}>{x.date} · {x.title}</option>)}</select></Field><Field label="Tipo de lançamento"><select value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value,scores:[]}))}>{MODES.map(x=><option key={x.key} value={x.key}>{x.name}</option>)}</select></Field></div>
 {exam&&<div className="score-panel"><header><strong>{exam.title}</strong><small>Nota máxima: {points(form.examSnapshot?.maxScore??exam.maxScore)} pts</small></header>{options.length?options.map(x=>{const current=form.scores?.find(s=>s.id===x.id);return <div className="score-row" key={x.id}><div><strong>{x.label}</strong><small>{x.method==='J'?'Judgement · 0 a 3':'Measurement / valor'}</small></div><div className="score-input">{x.method==='J'?<select aria-label={`Nota ${x.label}`} value={current?.judgementLevel??''} onChange={e=>changeScore(x.id,e.target.value,'J')}><option value="">Não avaliado</option>{[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}</select>:<input aria-label={`Nota ${x.label}`} type="number" step="any" min="0" max={x.maxScore} placeholder="—" value={current?.score??''} onChange={e=>changeScore(x.id,e.target.value)}/>}<small>/ {points(x.maxScore)}</small></div></div>}):<p className="note warning">Esta prova ainda não possui aspectos para o detalhamento selecionado. Utilize nota geral ou cadastre o CIS.</p>}
 <footer><strong>{scored} de {options.length} itens informados</strong><strong>{scored===options.length?`Total: ${points(approximate)} pts`:'Correção parcial — sem total consolidado'}</strong></footer></div>}
 <Field label="Observações da correção"><textarea rows="3" value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Dificuldades, erros recorrentes, pontos de atenção..."/></Field>
 </div><Footer cancel={onClose} busy={busy}/></form></Modal>
}
export default function Executions({db,saveRecord,deleteRecord}){
 const [editing,setEditing]=useState(null);const [competitor,setCompetitor]=useState('all');const [exam,setExam]=useState('all');
 const rows=[...db.executions].filter(x=>(competitor==='all'||x.competitorId===competitor)&&(exam==='all'||x.examId===exam)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const next=()=>({_new:true,id:uid(),competitorId:db.competitors[0]?.id||'',examId:'',activityId:null,date:today(),mode:'overall',scores:[],notes:''});
 return <><PageTitle eyebrow="ACOMPANHAMENTO DE RESULTADOS" title="Execuções" desc="Aplicações, tentativas, notas parciais e correções completas por CIS." actions={<Button onClick={()=>setEditing(next())}><Plus size={16}/> Registrar execução</Button>}/>
 <div className="filters"><select value={competitor} onChange={e=>setCompetitor(e.target.value)}><option value="all">Todos os competidores</option>{db.competitors.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={exam} onChange={e=>setExam(e.target.value)}><option value="all">Todas as provas</option>{db.exams.map(x=><option key={x.id} value={x.id}>{x.module} · {x.title}</option>)}</select></div>
 <section className="panel">{rows.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Data</th><th>Competidor</th><th>Prova</th><th>Tipo</th><th>Pontuação</th><th>Cobertura</th><th></th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.date}</td><td>{lookup(db.competitors,x.competitorId)}</td><td><strong>{lookup(db.exams,x.examId,'title')}</strong></td><td>{MODES.find(m=>m.key===x.mode)?.name||x.mode}</td><td>{x.overallScore!=null?<strong>{points(x.overallScore)} / {points(x.maxScore)} · {percent(x.percentage)}</strong>:<Badge tone="amber">Parcial</Badge>}</td><td>{percent(x.coverage)}</td><td className="cell-actions"><Button variant="subtle" onClick={()=>setEditing(x)}><Pencil size={15}/></Button><Button variant="danger-ghost" onClick={()=>deleteRecord('executions',x.id)}>Excluir</Button></td></tr>)}</tbody></table></div>:<Empty title="Nenhuma execução cadastrada" subtitle="As provas já estão no catálogo. Cadastre um competidor e registre a primeira nota."/>}</section>
 {editing&&<ExecutionEditor source={editing} db={db} onClose={()=>setEditing(null)} onSave={data=>saveRecord('executions',data)}/>}</>
}
