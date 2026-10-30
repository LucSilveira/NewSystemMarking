// A URL e a unica fonte de verdade do contexto de ocupacao.
export const ROUTES = Object.freeze({
  dashboard: {slug:'painel', label:'Visão geral'},
  exams: {slug:'provas', label:'Provas'},
  executions: {slug:'execucoes', label:'Execuções'},
  activities: {slug:'atividades', label:'Atividades'},
  competitors: {slug:'competidores', label:'Competidores'},
  competencies: {slug:'competencias', label:'Competências'},
  references: {slug:'cadastros', label:'Configurações da modalidade'},
});

export const occupationCode = (code) => {
  const value=String(code??'').trim().replace(/^#/, '');
  return /^\d+$/.test(value) ? value.padStart(2,'0') : value;
};

export function occupationPath(code, page='dashboard') {
  const normalized=occupationCode(code);
  if(!/^\d+$/.test(normalized)) throw new Error('Código de ocupação inválido');
  if(!ROUTES[page]) throw new Error('Página inexistente');
  return `/${encodeURIComponent(normalized)}/${ROUTES[page].slug}`;
}

export function executionPath(code,view='nova') {
  const base=occupationPath(code,'executions');
  if(view==='nova'||view==='importar')return `${base}/${view}`;
  if(typeof view!=='string'||!/^[a-zA-Z0-9_-]{3,120}$/.test(view))throw new Error('ID da execução inválido');
  return `${base}/${encodeURIComponent(view)}`;
}

export function readOccupationRoute(pathname) {
  const path=String(pathname||'/').split('?')[0].split('#')[0];
  const pieces=path.split('/').filter(Boolean);
  if(!pieces.length || (pieces.length===1 && pieces[0]==='login')) return {type:'login'};
  if(pieces.length===1 && pieces[0]==='painel') return {type:'home'};
  if(pieces.length===1 && pieces[0]==='admin') return {type:'admin'};
  if(pieces.length>3) return {type:'notfound'};
  if(pieces.length===3){
   const code=occupationCode(pieces[0]);
   if(!/^\d+$/.test(code)||pieces[1]!=='execucoes')return {type:'notfound'};
   if(pieces[2]==='nova')return {type:'workspace',code,page:'executions',executionView:'new'};
   if(pieces[2]==='importar')return {type:'workspace',code,page:'executions',executionView:'batch'};
   try {const id=decodeURIComponent(pieces[2]);return /^[a-zA-Z0-9_-]{3,120}$/.test(id)?{type:'workspace',code,page:'executions',executionView:'edit',executionId:id}:{type:'notfound'};}catch{return {type:'notfound'};}
  }
  let code;
  try { code=occupationCode(decodeURIComponent(pieces[0])); }
  catch { return {type:'notfound'}; }
  if(!/^\d+$/.test(code)) return {type:'notfound'};
  if(pieces.length===1) return {type:'workspace',code,page:'dashboard'};
  const route=Object.entries(ROUTES).find(([,v])=>v.slug===pieces[1]);
  return route ? {type:'workspace',code,page:route[0]} : {type:'notfound'};
}
