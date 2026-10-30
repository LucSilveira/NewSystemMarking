import React,{useEffect,useMemo,useState} from 'react';
import {Plus,Cloud,Pencil} from 'lucide-react';
import {Button,Field,Modal,PageTitle,Badge,Empty,Footer} from '../components/UI.jsx';
import {uid,lookup,request} from '../lib/api.js';
import {resolveReferenceTab,referenceTabUrl,REFERENCE_TAB_QUERY} from '../lib/referenceTabRouting.js';
const CONFIG={
 occupations:{name:'Modalidades',description:'Ocupações que possuem competidores, provas e WSOS configurados.',fields:[{k:'code',t:'Código'},{k:'name',t:'Nome'},{k:'description',t:'Descrição'}]},
 occupationAreas:{name:'Áreas da ocupação',description:'Áreas técnicas configuráveis para correlacionar provas e aspectos CIS. Não são seções WSOS.',fields:[{k:'name',t:'Área técnica'},{k:'description',t:'Descrição'},{k:'occupationId',t:'Ocupação',rel:'occupations'}]},
 wsos:{name:'WSOS',description:'Seções profissionais, independentes dos tipos de prova.',fields:[{k:'code',t:'Código WSOS'},{k:'name',t:'Nome'},{k:'referenceWeight',t:'Peso de referência (%)',type:'number'},{k:'occupationId',t:'Ocupação',rel:'occupations'}]},
 examTypes:{name:'Tipos de prova',description:'Categorias de provas próprias de cada ocupação.',fields:[{k:'key',t:'Identificador'},{k:'name',t:'Nome'},{k:'occupationId',t:'Ocupação',rel:'occupations'}]},
 evaluators:{name:'Avaliadores',description:'Responsáveis técnicos vinculados a uma ou mais ocupações, sem login nesta POC.',fields:[{k:'name',t:'Nome'},{k:'occupationIds',t:'Ocupações',rel:'occupations',multi:true}]},
 teams:{name:'Equipes',description:'Grupos de competidores da mesma ocupação; não substituem os cadastros individuais.',fields:[{k:'name',t:'Nome'},{k:'occupationId',t:'Ocupação',rel:'occupations'},{k:'competitorIds',t:'Integrantes',rel:'competitors',multi:true}]},
 editions:{name:'Edições',description:'Classificação histórica das provas — não é administração de eventos.',fields:[{k:'name',t:'Nome da edição'},{k:'phase',t:'Fase',options:['Seletiva estadual','Estadual','Nacional','WorldSkills Américas','EuroSkills','AsiaSkills','WorldSkills','GlobalSkills','Individuais']},{k:'year',t:'Ano',type:'number'},{k:'occupationId',t:'Ocupação',rel:'occupations'}]}
};
function EntryForm({resource,value,db,onClose,onSave}){const [data,setData]=useState(value);const set=(key,val)=>setData(p=>({...p,[key]:val}));return <Modal title={`${value._new?'Novo cadastro':'Editar'} — ${CONFIG[resource].name}`} onClose={onClose}><form onSubmit={async e=>{e.preventDefault();const v={...data};delete v._new;await onSave(v);onClose()}}><div className="form-grid">{CONFIG[resource].fields.map(field=><Field key={field.k} label={field.t}>{field.multi?<div className="multi-list">{db[field.rel].filter(x=>field.rel!=='competitors'||x.occupationId===data.occupationId).map(x=><label className="check-row" key={x.id}><input type="checkbox" checked={(data[field.k]||[]).includes(x.id)} onChange={e=>set(field.k,e.target.checked?[...(data[field.k]||[]),x.id]:(data[field.k]||[]).filter(id=>id!==x.id))}/>{x.code?`${x.code} · `:''}{x.name}</label>)}</div>:field.rel?<select required value={data[field.k]||''} onChange={e=>field.k==='occupationId'&&resource==='teams'?setData(p=>({...p,occupationId:e.target.value,competitorIds:[]})):set(field.k,e.target.value)}><option value="">Selecione</option>{db[field.rel].map(x=><option key={x.id} value={x.id}>{x.code?`${x.code} · `:''}{x.name}</option>)}</select>:field.options?<select required value={data[field.k]||field.options[0]} onChange={e=>set(field.k,e.target.value)}>{field.options.map(x=><option key={x}>{x}</option>)}</select>:<input required={field.k!=='description'&&field.k!=='referenceWeight'} type={field.type||'text'} min={field.type==='number'?0:undefined} value={data[field.k]??''} onChange={e=>set(field.k,field.type==='number'?Number(e.target.value):e.target.value)}/>}</Field>)}</div><Footer cancel={onClose}/></form></Modal>}
function remoteList(data,kind){let arr=Array.isArray(data)?data:Array.isArray(data?.data)?data.data:Array.isArray(data?.items)?data.items:[];return arr.slice(0,100).map(x=>kind==='skills'?{id:x.id,name:x.name||x.description||'',code:x.number||x.code||''}:{id:x.id,name:x.name||x.schoolName||x.description||'',code:x.code||''})}
export default function References({db,saveRecord,deleteRecord,title='Cadastros de apoio',desc='Modalidades, áreas técnicas, WSOS, tipos de prova e edições usados no mapeamento.',allowedCategories=Object.keys(CONFIG)}){
 const categoriesKey=allowedCategories.join('|');
 const categories=useMemo(()=>allowedCategories.filter(key=>CONFIG[key]),[categoriesKey]);
 const [category,setCategory]=useState(()=>resolveReferenceTab(window.location.search,allowedCategories));
 const [editing,setEditing]=useState(null);
 const [remote,setRemote]=useState(null);
 const [remoteLoading,setRemoteLoading]=useState(false);
 const [remoteError,setRemoteError]=useState('');
 // A aba selecionada fica na URL. Refresh, salvar e Voltar/Avançar restauram o contexto.
 useEffect(()=>{
   const sync=()=>{
     const next=resolveReferenceTab(window.location.search,categories);
     setCategory(next);
     const params=new URLSearchParams(window.location.search);
     if(params.get(REFERENCE_TAB_QUERY)!==next){
       window.history.replaceState(window.history.state,'',referenceTabUrl(window.location.href,next));
     }
   };
   sync();
   window.addEventListener('popstate',sync);
   return()=>window.removeEventListener('popstate',sync);
 },[categoriesKey]);
 const changeCategory=(next)=>{
   if(!categories.includes(next)||next===category)return;
   window.history.pushState(window.history.state,'',referenceTabUrl(window.location.href,next));
   setEditing(null);
   setCategory(next);
 };

 const spec=CONFIG[category];async function loadSenai(kind){setRemote(kind);setRemoteLoading(true);setRemoteError('');try{const data=await request(`/senai/${kind}`);setRemote({kind,rows:remoteList(data,kind)})}catch(e){setRemoteError(e.message)}finally{setRemoteLoading(false)}}
 return <><PageTitle eyebrow="REFERÊNCIAS DO TREINAMENTO" title={title} desc={desc} actions={<Button onClick={()=>setEditing({_new:true,id:uid(),...(category==='editions'?{year:new Date().getFullYear(),phase:'WorldSkills',occupationId:db.occupations[0]?.id||''}:category==='wsos'?{occupationId:db.occupations[0]?.id||'',referenceWeight:0}:category==='occupationAreas'?{occupationId:db.occupations[0]?.id||'',description:''}:category==='examTypes'?{occupationId:db.occupations[0]?.id||''}:category==='evaluators'?{occupationIds:[db.occupations[0]?.id].filter(Boolean),active:true}:category==='teams'?{occupationId:db.occupations[0]?.id||'',competitorIds:[],active:true}:{})})}><Plus size={16}/> Adicionar {spec.name.toLowerCase()}</Button>}/>
 <div className="tabline">{Object.entries(CONFIG).filter(([key])=>categories.includes(key)).map(([key,v])=><button key={key} className={category===key?'active':''} onClick={()=>changeCategory(key)}>{v.name} <small>{db[key]?.length||0}</small></button>)}</div>
 <section className="panel"><header className="panel-heading"><div><h2>{spec.name}</h2><p>{spec.description}</p></div></header>{db[category]?.length?<div className="table-scroll"><table className="data-table"><thead><tr>{spec.fields.map(f=><th key={f.k}>{f.t}</th>)}<th></th></tr></thead><tbody>{db[category].map(item=><tr key={item.id}>{spec.fields.map(field=><td key={field.k}>{field.multi?(item[field.k]||[]).map(id=>lookup(db[field.rel],id)).join(' · ')||'—':field.rel?lookup(db[field.rel],item[field.k]):item[field.k]??'—'}</td>)}<td className="cell-actions"><Button variant="subtle" onClick={()=>setEditing(item)}><Pencil size={15}/></Button><Button variant="danger-ghost" onClick={()=>deleteRecord(category,item.id)}>Excluir</Button></td></tr>)}</tbody></table></div>:<Empty title="Sem cadastros"/>}</section>
 <section className="panel integration-panel"><div><h2>Consultas SENAI</h2><p>O sistema consulta as listas externas sob demanda, sem armazená-las como banco local.</p></div><div className="inline-actions"><Button variant="subtle" onClick={()=>loadSenai('skills')}><Cloud size={15}/> Ocupações</Button><Button variant="subtle" onClick={()=>loadSenai('schools')}><Cloud size={15}/> Escolas</Button></div></section>
 {editing&&<EntryForm resource={category} value={editing} db={db} onClose={()=>setEditing(null)} onSave={data=>saveRecord(category,data)}/>}
 {(remote||remoteLoading||remoteError)&&<Modal title="Consulta SENAI (somente leitura)" onClose={()=>{setRemote(null);setRemoteError('')}}><div className="form-grid">{remoteLoading?<p>Consultando serviço...</p>:remoteError?<p className="error-text">{remoteError}. O sistema local continua funcionando normalmente.</p>:<><p>{remote?.rows.length||0} registros exibidos (máximo 100).</p><div className="remote-list">{remote?.rows.map((x,i)=><div className="record" key={`${x.id}-${i}`}><strong>{x.code}</strong><span>{x.name}</span></div>)}</div></>}<Button variant="subtle" onClick={()=>{setRemote(null);setRemoteError('')}}>Fechar</Button></div></Modal>}
 </>
}
