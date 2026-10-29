// A URL e a unica fonte de verdade do contexto de ocupacao.
export const ROUTES = Object.freeze({
  dashboard: {slug:'painel', label:'Visão geral'},
  exams: {slug:'provas', label:'Provas'},
  executions: {slug:'execucoes', label:'Execuções'},
  activities: {slug:'atividades', label:'Atividades'},
  competitors: {slug:'competidores', label:'Competidores'},
  competencies: {slug:'competencias', label:'Competências'},
  references: {slug:'cadastros', label:'Cadastros de apoio'},
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

export function readOccupationRoute(pathname) {
  const path=String(pathname||'/').split('?')[0].split('#')[0];
  const pieces=path.split('/').filter(Boolean);
  if(!pieces.length) return {type:'home'};
  if(pieces.length>2) return {type:'notfound'};
  let code;
  try { code=occupationCode(decodeURIComponent(pieces[0])); }
  catch { return {type:'notfound'}; }
  if(!/^\d+$/.test(code)) return {type:'notfound'};
  if(pieces.length===1) return {type:'workspace',code,page:'dashboard'};
  const route=Object.entries(ROUTES).find(([,v])=>v.slug===pieces[1]);
  return route ? {type:'workspace',code,page:route[0]} : {type:'notfound'};
}
