/** Exemplo isolado de UI; nenhum registro demonstrativo é salvo ou enviado à API. */
const round=n=>Math.round(n*100)/100;
const clamp=n=>Math.max(0,Math.min(100,n));
const examples={
 wsos:[
  ['1','Organização e gestão do trabalho',83],['2','Comunicação',77],
  ['3','Implementação de Design',69],['4','Front-end',86],['5','Back-end',74]
 ],
 areas:[
  ['demo-a1','Lógica e algoritmos',71],['demo-a2','Desenvolvimento Front-end',87],
  ['demo-a3','Desenvolvimento Back-end',76],['demo-a4','Design e interação',68],
  ['demo-a5','Colaboração e comunicação',79]
 ],
 competencies:[
  ['demo-c1','Roteamento SPA',['demo-a2'],85],['demo-c2','Responsividade',['demo-a2','demo-a4'],79],
  ['demo-c3','Integração REST',['demo-a3','demo-a2'],71],['demo-c4','Persistência de dados',['demo-a3'],74],
  ['demo-c5','UI e acessibilidade',['demo-a4','demo-a2'],82],['demo-c6','Algoritmos',['demo-a1'],68],
  ['demo-c7','Validação de dados',['demo-a3','demo-a2'],89],['demo-c8','Comunicação técnica',['demo-a5'],76],
  ['demo-c9','Design responsivo',['demo-a4'],80],['demo-c10','Resolução de problemas',['demo-a1'],73]
 ]
};
const areaFrom=x=>({id:x[0],name:x[1],earned:round(x[2]*.4),possible:40,percentage:x[2],aspectGrades:24,executionCount:6});
export const DEMO_PEOPLE=[{id:'demo-p1',name:'Competidor A (simulação)'},{id:'demo-p2',name:'Competidor B (simulação)'}];
export function buildDashboardDemo({range='all',competitorId='all',areaId='all'}={}){
 const offset=competitorId==='demo-p2'?-12:competitorId==='demo-p1'?3:0;
 const sampleCount=range==='month'?5:range==='90d'?4:range==='year'?7:6;
 const now=new Date();
 const weeks=range==='month';
 const trend=Array.from({length:sampleCount},(_,i)=>{
  const date=new Date(now.getFullYear(),now.getMonth(),weeks?Math.max(1,now.getDate()-((sampleCount-i-1)*6)):1-(sampleCount-i-1)*30);
  const bucket=weeks?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const label=weeks?`${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`:`${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
  const areas=Object.fromEntries(examples.areas.map(([id,_name,base],j)=>{
   const variation=(i-(sampleCount-1)/2)*5+Math.sin(i*1.5+j)*8;
   const percentage=clamp(round(base-10+variation+offset));
   return [id,{percentage,earned:round(percentage*.07),possible:7,aspectGrades:3,executionCount:1}];
  }));
  return {bucket,label,areas};
 });
 const wsos=examples.wsos.map(([code,name,val])=>({id:`demo-w${code}`,code,name,earned:round(clamp(val+offset)*.24),possible:24,percentage:clamp(val+offset),aspectGrades:20,executionCount:6}));
 const areas=examples.areas.map(([id,name,val])=>areaFrom([id,name,clamp(val+offset)]));
 const competencies=examples.competencies.filter(c=>areaId==='all'||c[2].includes(areaId)).map(([id,name,areaIds,percent],i)=>({id,name,areaIds,category:'technical',earned:round(clamp(percent+offset)*.11),possible:11,percentage:clamp(percent+offset),aspectGrades:8+i%4,executionCount:5}));
 return {meta:{range,competitorId,areaId,finalizedExecutions:6,excludedExecutions:0,aspectGrades:160,isDemo:true},
  summary:{earned:round(clamp(76+offset)*2.15),possible:215,percentage:clamp(76+offset),finalizedExecutions:6,areasWithEvidence:areas.length,areasTotal:areas.length,competenciesWithEvidence:competencies.length,competenciesTotal:competencies.length},
  wsos,areas,competencies,trend};
}
