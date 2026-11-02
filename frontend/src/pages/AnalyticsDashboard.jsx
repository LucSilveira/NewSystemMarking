import React,{useEffect,useMemo,useState} from 'react';
import {Activity,BarChart3,BookOpen,Info,Layers3,LineChart,RefreshCw,Target} from 'lucide-react';
import SelectField from '../components/SelectField.jsx';
import {request,points,percent} from '../lib/api.js';
import {buildDashboardDemo,DEMO_PEOPLE} from '../lib/dashboardDemo.js';

const COLORS=['#2d74c0','#10a5a5','#9464d6','#e5a248','#e46f81','#6584be','#69a25b','#c17ed0'];
const labels={all:'Todo o histórico',month:'Este mês', '90d':'Últimos 90 dias',year:'Este ano',custom:'Personalizado'};
const BR=(n,digits=1)=>n==null?'—':`${Number(n).toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits})}%`;
const xOf=(i,total,left,right)=>(total<2?(left+right)/2:left+(right-left)*i/(total-1));
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
function Head({icon:Icon,title,description,extra}){return <div className="analytics-card-head"><div className="analytics-card-heading"><span className="analytics-card-icon"><Icon size={18}/></span><div><h2>{title}</h2><p>{description}</p></div></div>{extra}</div>}
function NoEvidence({message='Ainda não há correções finalizadas com evidências CIS para estes filtros.'}){return <div className="analytics-empty"><Info size={26}/><strong>Sem dados para exibir</strong><p>{message}</p></div>}
function Stat({label,value,sub,icon:Icon}){return <div className="analytics-stat"><span><Icon size={17}/>{label}</span><strong>{value}</strong><small>{sub}</small></div>}
function WsosChart({rows}){
 if(!rows.some(r=>r.possible>0))return <NoEvidence message="As seções WSOS serão comparadas após a correção de aspectos CIS vinculados a elas."/>;
 return <div className="analytics-wsos-list">{rows.map((row,i)=><div className="analytics-wsos-row" key={row.id||row.code}>
  <div className="analytics-wsos-meta"><strong>{row.code} · {row.name}</strong><span>{row.percentage==null?'Sem evidências':`${BR(row.percentage)} · ${points(row.earned)} / ${points(row.possible)} pts`}</span></div>
  <div className="analytics-wsos-track"><span className="analytics-wsos-fill" style={{width:`${clamp(row.percentage)}%`,background:COLORS[i%COLORS.length]}}/></div>
 </div>)}</div>;
}
function TrendChart({rows,areas,selectedArea}){
 const shown=areas.filter(a=>a.possible>0&&(selectedArea==='all'||a.id===selectedArea));
 if(!shown.length||!rows.length)return <NoEvidence message="O histórico das áreas começa a aparecer quando os aspectos CIS dessas áreas são avaliados em execuções finalizadas."/>;
 const W=850,H=300,left=42,right=818,top=25,bottom=248;
 const pointsFor=id=>rows.map((r,i)=>({x:xOf(i,rows.length,left,right),y:bottom-(r.areas?.[id]?.percentage||0)*(bottom-top)/100,valid:r.areas?.[id]?.percentage!=null}));
 function segments(series){const result=[];let part=[];for(const p of series){if(!p.valid){if(part.length)result.push(part);part=[]}else part.push(p)}if(part.length)result.push(part);return result}
 const maxLabels=7;
 return <div className="analytics-chart-wrap"><svg className="analytics-trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução percentual das áreas por período, de zero a cem porcento">
  {[0,25,50,75,100].map(v=><g key={v}><line x1={left} y1={bottom-v*(bottom-top)/100} x2={right} y2={bottom-v*(bottom-top)/100} stroke="#e3edf7" strokeDasharray="4 5"/><text x={left-9} y={bottom-v*(bottom-top)/100+4} textAnchor="end" fontSize="12" fill="#7f96ac">{v}%</text></g>)}
  {rows.map((r,i)=>rows.length<=maxLabels||i%Math.ceil(rows.length/maxLabels)===0||i===rows.length-1?<text key={r.bucket} x={xOf(i,rows.length,left,right)} y="273" textAnchor="middle" fontSize="12" fill="#7890a6">{r.label}</text>:null)}
  {shown.map((a,i)=>{const series=pointsFor(a.id),col=COLORS[areas.findIndex(r=>r.id===a.id)%COLORS.length];return <g key={a.id}>{segments(series).map((seg,k)=>seg.length>1?<polyline key={k} points={seg.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={col} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>:null)}{series.filter(p=>p.valid).map((p,k)=><circle key={k} cx={p.x} cy={p.y} r="4.3" fill={col} stroke="white" strokeWidth="2"/>)}</g>})}
 </svg><div className="analytics-chart-legend">{shown.map(a=><span key={a.id}><i style={{background:COLORS[areas.findIndex(r=>r.id===a.id)%COLORS.length]}}/>{a.name}</span>)}</div></div>;
}
function wrappedLabel(label){const words=String(label).split(' ');if(label.length<=17)return [label];const cut=Math.ceil(words.length/2);return [words.slice(0,cut).join(' '),words.slice(cut).join(' ')].filter(Boolean)}
function Radar({competencies}){
 const valid=[...competencies].filter(c=>c.possible>0).sort((a,b)=>b.possible-a.possible).slice(0,8);
 if(valid.length<3)return <NoEvidence message="O radar precisa de evidências CIS em pelo menos três competências. Você pode filtrar por área ou usar a simulação para conferir o visual."/>;
 const cx=340,cy=215,r=138,W=690,H=440,n=valid.length;
 const polar=(index,radius)=>{const rad=-Math.PI/2+2*Math.PI*index/n;return [cx+Math.cos(rad)*radius,cy+Math.sin(rad)*radius]};
 const poly=(radius)=>valid.map((_,i)=>polar(i,radius).join(',')).join(' ');
 const valuePoints=valid.map((v,i)=>polar(i,r*clamp(v.percentage)/100).join(',')).join(' ');
 return <div className="analytics-radar-wrap"><svg className="analytics-radar-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Radar do aproveitamento de ${valid.length} competências, de 0 a 100 porcento`}>
  {[20,40,60,80,100].map(level=><polygon key={level} points={poly(r*level/100)} stroke="#dce7f2" fill={level===100?'#f7fbff':'none'} strokeWidth="1"/>)}
  {valid.map((item,i)=>{const [ex,ey]=polar(i,r);const [tx,ty]=polar(i,r+23);return <g key={item.id}><line x1={cx} y1={cy} x2={ex} y2={ey} stroke="#dbe7f3"/>{wrappedLabel(item.name).map((line,j,lines)=><text key={j} x={tx} y={ty+3+j*12-(lines.length-1)*6} textAnchor={Math.abs(tx-cx)<6?'middle':tx>cx?'start':'end'} fill="#4b647e" fontSize="11.5" fontWeight="600">{line.length>25?`${line.slice(0,24)}…`:line}</text>)}</g>})}
  <polygon points={valuePoints} fill="#2d74c033" stroke="#2d74c0" strokeWidth="3" strokeLinejoin="round"/>
  {valid.map((v,i)=>{const [x,y]=polar(i,r*clamp(v.percentage)/100);return <circle key={v.id} cx={x} cy={y} r="4.5" fill="#2d74c0" stroke="white" strokeWidth="2"><title>{v.name}: {BR(v.percentage)}</title></circle>})}
  <text x={cx+5} y={cy-r*.8+4} fill="#8da2b4" fontSize="11">80%</text>
 </svg><div className="analytics-radar-summary"><strong>{valid.length} competências com evidência</strong><span>Exibimos até 8 competências com maior volume de pontos CIS no recorte escolhido.</span></div></div>;
}
export default function AnalyticsDashboard({db}){
 const occupation=db.occupations[0];
 const [competitorId,setCompetitorId]=useState('all');
 const [range,setRange]=useState('all');
 const [dateFrom,setDateFrom]=useState('');
 const [dateTo,setDateTo]=useState('');
 const [areaId,setAreaId]=useState('all');
 const [demo,setDemo]=useState(false);
 const [result,setResult]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(range==='custom'&&(!dateFrom||!dateTo||dateFrom>dateTo))return;
  if(!occupation?.id){setResult(null);return}
  let active=true;setLoading(true);setError('');
  const params=new URLSearchParams({occupationId:occupation.id,competitorId,range,areaId});
  if(range==='custom'){params.set('dateFrom',dateFrom);params.set('dateTo',dateTo)}
  request(`/reports/dashboard?${params}`).then(data=>{if(active)setResult(data)}).catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[occupation?.id,competitorId,range,dateFrom,dateTo,areaId]);
 const preview=useMemo(()=>buildDashboardDemo({range,competitorId:competitorId.startsWith('demo-')?competitorId:'all',areaId:areaId.startsWith('demo-')?areaId:'all'}),[range,competitorId,areaId]);
 const incompleteDates=range==='custom'&&(!dateFrom||!dateTo||dateFrom>dateTo);
 const report=demo?preview:(loading||error||incompleteDates?null:result);
 const areaOptions=demo?preview.areas:db.occupationAreas;
 const competitorOptions=demo?DEMO_PEOPLE:db.competitors;
 const mappedAreaId=areaOptions.some(a=>a.id===areaId)?areaId:'all';
 const shownCompetencies=(report?.competencies||[]).filter(c=>mappedAreaId==='all'||(c.areaIds||[]).includes(mappedAreaId));
 return <div className="analytics-page">
  <div className="analytics-page-header"><div><div className="eyebrow">INDICADORES E EVOLUÇÃO</div><h1>Dashboard de desempenho</h1><p>Comparativos WSOS, evolução das áreas e abrangência das competências por evidências CIS.</p></div><button className={`analytics-demo-toggle ${demo?'is-active':''}`} type="button" onClick={()=>{setDemo(d=>!d);setAreaId('all');setCompetitorId('all')}}><Activity size={16}/>{demo?'Voltar aos dados reais':'Visualizar simulação'}</button></div>
  {demo&&<div className="analytics-demo-banner"><Info size={18}/><div><strong>Simulação visual — dados fictícios</strong><span>Os valores abaixo servem exclusivamente para testar o layout. Nenhum lançamento foi criado ou alterado no banco.</span></div></div>}
  <div className="analytics-filters">
   <label><span>Competidor</span><SelectField value={competitorId} onChange={e=>setCompetitorId(e.target.value)}><option value="all">Todos os competidores</option>{competitorOptions.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</SelectField></label>
   <label><span>Período</span><SelectField value={range} onChange={e=>setRange(e.target.value)}>{Object.entries(labels).map(([id,label])=><option value={id} key={id}>{label}</option>)}</SelectField></label>
   <label><span>Área técnica</span><SelectField value={mappedAreaId} onChange={e=>setAreaId(e.target.value)}><option value="all">Todas as áreas</option>{areaOptions.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</SelectField></label>
   {range==='custom'&&<><label><span>De</span><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label><span>Até</span><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label></>}
  </div>
  {!demo&&loading&&<div className="analytics-inline-state"><RefreshCw size={16}/> Carregando indicadores...</div>}
  {!demo&&incompleteDates&&<div className="analytics-inline-state"><Info size={16}/> Selecione um intervalo válido de início e término para visualizar os resultados.</div>}
  {!demo&&error&&<div className="analytics-inline-error" role="alert">Não foi possível consultar os indicadores: {error}</div>}
  {report&&<>
   {!demo&&report.summary.finalizedExecutions===0&&<div className="analytics-inline-state"><Info size={16}/> Ainda não há execuções finalizadas com aspectos CIS neste período. Use <strong>Visualizar simulação</strong> para explorar os gráficos sem criar dados.</div>}
   <div className="analytics-stats"><Stat icon={Activity} label="Aproveitamento CIS" value={BR(report.summary.percentage)} sub={`${points(report.summary.earned)} / ${points(report.summary.possible)} pontos`}/><Stat icon={BookOpen} label="Execuções finalizadas" value={report.summary.finalizedExecutions} sub="Somente avaliações por aspecto"/><Stat icon={Layers3} label="Áreas com evidências" value={`${report.summary.areasWithEvidence}/${report.summary.areasTotal}`} sub="Áreas com notas vinculadas"/><Stat icon={Target} label="Competências cobertas" value={`${report.summary.competenciesWithEvidence}/${report.summary.competenciesTotal}`} sub="No filtro atual"/></div>
   <section className="analytics-panel"><Head icon={BarChart3} title="Comparativo WSOS" description="Aproveitamento percentual de cada seção, ponderado pelos pontos efetivamente avaliados."/><WsosChart rows={report.wsos||[]}/></section>
   <section className="analytics-panel"><Head icon={LineChart} title="Evolução das áreas técnicas" description="Cada ponto representa o aproveitamento das avaliações concluídas no período, sem acumular notas entre períodos."/><TrendChart rows={report.trend||[]} areas={report.areas||[]} selectedArea={mappedAreaId}/></section>
   <section className="analytics-panel"><Head icon={Target} title="Abrangência das competências" description="Radar com o aproveitamento das competências vinculadas aos aspectos CIS corrigidos." extra={<span className="analytics-small-tag">{mappedAreaId==='all'?'Todas as áreas':areaOptions.find(a=>a.id===mappedAreaId)?.name}</span>}/><Radar competencies={shownCompetencies}/></section>
   <div className="analytics-method-note"><Info size={17}/><p>Os três gráficos usam exclusivamente notas de aspectos CIS de execuções finalizadas. Uma evidência associada a mais de uma área ou competência participa separadamente de cada indicador; por isso, os percentuais dessas dimensões não devem ser somados. Avaliações subjetivas do professor continuam independentes.</p></div>
  </>}
 </div>;
}
