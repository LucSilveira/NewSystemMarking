'use strict';
/**
 * Skill Training API (local development).
 *
 * json-server provides the Express application and JSON body parsing. Routes are
 * registered explicitly: mounting several independent json-server.router()
 * instances and rewriting req.url inside a mounted middleware is fragile.
 * Each collection is persisted in its own backend/data/<resource>.json file.
 */
const jsonServer = require('json-server');
const { randomUUID } = require('node:crypto');
const { RESOURCES, read, write, all } = require('./data.cjs');
const { validatePayload, computeExecution, executionChangeLocked } = require('./rules.cjs');
const auth=require('./auth.cjs');
const {queryCollection}=require('./queries.cjs');
const {reportCompetencies}=require('./competency-report.cjs');
const {buildDashboardReport}=require('./dashboard-report.cjs');
const {buildOverviewReport}=require('./overview-report.cjs');

const app = jsonServer.create();
app.disable('x-powered-by');
app.use(jsonServer.defaults({ logger: true, readOnly: false }));
app.use(jsonServer.bodyParser);

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';

const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const safe = (handler) => (req, res) => {
  try {
    // Promise handlers can be added later without changing this wrapper.
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error('[API]', err);
      if (!res.headersSent) fail(res, 500, 'Erro interno. Consulte o console da API.');
    });
  } catch (err) {
    console.error('[API]', err);
    if (!res.headersSent) fail(res, 500, 'Erro interno. Consulte o console da API.');
  }
};


// Public: health, login and installation status. All data routes below require a session.
app.get('/api/health', (_req, res) => res.json({ status: 'ok', storage: 'separate JSON files', resources: RESOURCES }));
const attempted=new Map();
app.get('/api/auth/status', (_req,res)=>res.json({configured:auth.getUsers().some(x=>x.role==='admin'&&x.active!==false)}));
app.post('/api/auth/login', safe((req,res)=>{
  const username=String(req.body?.username||'').trim().toLowerCase();
  const password=req.body?.password;
  const key=`${req.ip||'local'}:${username}`;
  const entry=attempted.get(key)||{count:0,until:0};
  if(entry.until>Date.now())return fail(res,429,'Muitas tentativas. Tente novamente mais tarde.');
  if(typeof password!=='string'||password.length>1024||username.length>254)return fail(res,401,'Credenciais inválidas');
  const user=auth.findUserByLogin(auth.getUsers(),username);
  if(!user||!auth.verifyPassword(password,user.passwordHash)){
    const count=(entry.until&&entry.until<Date.now()?0:entry.count)+1;
    attempted.set(key,{count,until:count>=8?Date.now()+15*60*1000:0});
    return fail(res,401,'Credenciais inválidas');
  }
  attempted.delete(key);
  const token=auth.createSession(user.id);
  res.setHeader('Set-Cookie',auth.cookieHeader(token,req));
  return res.json({user:auth.publicUser(user)});
}));
app.use('/api',(req,res,next)=>{
  const token=auth.cookieToken(req);
  const user=auth.userForToken(token);
  if(!user)return fail(res,401,'Sessão expirada ou acesso não autorizado');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('X-STM-Client')!=='1')return fail(res,403,'Solicitação de escrita sem confirmação da aplicação');
  req.user=user;req.authToken=token;next();
});
app.get('/api/auth/me',(req,res)=>res.json({user:req.user}));
app.post('/api/auth/logout',(req,res)=>{auth.logout(req.authToken);res.setHeader('Set-Cookie',auth.clearCookie(req));res.json({ok:true})});
app.get('/api/admin/users',(req,res)=>req.user.role==='admin'?res.json(auth.getUsers().map(auth.publicUser)):fail(res,403,'Acesso administrativo necessário'));
app.post('/api/admin/users',safe((req,res)=>{
  if(req.user.role!=='admin')return fail(res,403,'Acesso administrativo necessário');
  if(!req.body?.password)return fail(res,422,'Senha obrigatória');
  try {
    const occupationIds=req.body.occupationIds||[];
    if(req.body.role==='evaluator'&&!occupationIds.length)return fail(res,422,'O avaliador precisa estar vinculado a pelo menos uma ocupação');
    if(occupationIds.some(id=>!read('occupations').some(x=>x.id===id)))return fail(res,422,'Ocupação inexistente');
    return res.status(201).json(auth.createUser(req.body));
  }catch(err){return fail(res,422,err.message)}
}));
app.put('/api/admin/users/:id',safe((req,res)=>{
  if(req.user.role!=='admin')return fail(res,403,'Acesso administrativo necessário');
  try {
    const ids=req.body?.occupationIds;
    if(ids&&ids.some(id=>!read('occupations').some(x=>x.id===id)))return fail(res,422,'Ocupação inexistente');
    const existing=auth.getUsers().find(u=>u.id===req.params.id);
    const nextRole=req.body?.role||existing?.role;
    const nextOccupations=ids||existing?.occupationIds||[];
    if(nextRole==='evaluator'&&!nextOccupations.length)return fail(res,422,'O avaliador precisa estar vinculado a pelo menos uma ocupação');
    return res.json(auth.updateUser(req.params.id,req.body));
  }catch(err){return fail(res,422,err.message)}
}));
app.post('/api/auth/change-password',safe((req,res)=>{
  const users=auth.getUsers();
  const existing=users.find(x=>x.id===req.user.id);
  if(!existing||!auth.verifyPassword(req.body?.currentPassword,existing.passwordHash))return fail(res,401,'Senha atual incorreta');
  try {auth.updateUser(existing.id,{password:req.body?.newPassword});res.setHeader('Set-Cookie',auth.clearCookie(req));return res.json({ok:true,relogin:true})}
  catch(err){return fail(res,422,err.message)}
}));
const visibleDB=(user)=>auth.scopedData(all(),user);

// Resposta única para a versão atual do front. Ainda não é paginada: transição.
app.get('/api/bootstrap',safe((req,res)=>res.json(visibleDB(req.user))));
// Novo contrato paginado: ideal para a migração progressiva de catálogos e históricos.
app.get('/api/search/:resource',safe((req,res)=>{
 if(!RESOURCES.includes(req.params.resource))return fail(res,404,'Coleção não encontrada');
 const db=all();
 return res.json(queryCollection(req.params.resource,db,req.user,req.query,auth.visible));
}));
// Indicadores agregados por período, competidor e ocupação; nenhuma nota é calculada no cliente.
app.get('/api/reports/dashboard',safe((req,res)=>{
 const db=visibleDB(req.user);
 try{return res.json(buildDashboardReport(db,req.query));}
 catch(err){return fail(res,422,err.message)}
}));
app.get('/api/reports/competencies/:competitorId',safe((req,res)=>{
 const db=visibleDB(req.user);
 if(!db.competitors.some(c=>c.id===req.params.competitorId))return fail(res,404,'Competidor não encontrado ou não autorizado');
 return res.json({competitorId:req.params.competitorId,results:reportCompetencies(db,req.params.competitorId)});
}));

app.get('/api', (_req, res) => res.json({ status: 'ok', endpoints: ['/api/health', ...RESOURCES.map((r) => `/api/${r}`)] }));


app.get('/api/reports/overview',safe((req,res)=>{
  // Os filtros e a agregação são responsabilidade da API, não do React.
  const db=visibleDB(req.user);
  try{return res.json(buildOverviewReport(db,{occupationId:req.query.occupationId,competitorId:req.query.competitorId||'all'}))}
  catch(err){return fail(res,422,err.message)}
}));

app.get('/api/reports/competitor/:id', safe((req, res) => {
  const { id } = req.params;
  const db = visibleDB(req.user);
  if (!db.competitors.some((x) => x.id === id)) return fail(res, 404, 'Competidor não encontrado');
  const recentFirst = (a, b) => String(b.date).localeCompare(String(a.date));
  res.json({
    executions: db.executions.filter((x) => x.competitorId === id).sort(recentFirst),
    activities: db.activities.filter((x) => x.competitorId === id).sort(recentFirst),
    technicalAssessments: db.technicalAssessments.filter((x) => x.competitorId === id).sort(recentFirst)
  });
}));

// Read-only convenience integrations: optional and not needed for local data.
for (const [route, target] of [['skills', 'Skills'], ['schools', 'school']]) {
  app.get(`/api/senai/${route}`, safe(async (_req, res) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`https://hgestaoolimpiadaconhecimentoapi.sp.senai.br/api/${target}`, {
        signal: controller.signal, headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      res.json(await response.json());
    } catch (err) {
      fail(res, 502, `Falha na consulta externa: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }));
}

const USED_BY = {
  occupations: [['competitors', 'occupationId'], ['wsos', 'occupationId'], ['occupationAreas', 'occupationId'], ['competencies', 'occupationId'], ['exams', 'occupationId'], ['teams', 'occupationId'], ['activities', 'occupationId'], ['editions', 'occupationId']],
  examTypes: [],
  editions: [['exams', 'editionId']],
  exams: [['executions', 'examId'], ['activities', 'examId'], ['exams', 'sourceExamId']],
  competitors: [['executions', 'competitorId'], ['activities', 'competitorId'], ['technicalAssessments', 'competitorId']],
  evaluators: [], teams: [],
  competencies: [['technicalAssessments', 'competencyId']],
  occupationAreas: [],
  wsos: [['competencies', 'wsosId']],
  activities: [['executions', 'activityId']]
};

function saveResource(resource, req, res, existing = null) {
  const input = req.body;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail(res, 400, 'Corpo JSON inválido');
  }
  const rows = read(resource);
  const isNew = existing === null;
  const candidate = { ...(existing || {}), ...input };
  if(isNew && resource==='competitors')candidate.active=true;
  candidate.id = existing?.id || input.id || randomUUID();
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return fail(res, 422, 'ID inválido');
  if (isNew && rows.some((r) => String(r.id) === String(candidate.id))) return fail(res, 409, 'ID já cadastrado');

  const refs = all();
  if(existing&&!auth.canMutate(req.user,resource,existing,refs))return fail(res,403,'Sem permissão nesta ocupação');
  if(!auth.canMutate(req.user,resource,candidate,refs))return fail(res,403,'Sem permissão para cadastrar nesta ocupação');
  if(resource==='exams'&&candidate.sourceExamId&&refs.exams.some(x=>x.id===candidate.sourceExamId&&!auth.visible(req.user,'exams',x,refs)))return fail(res,403,'Prova de origem não autorizada');
  const issues = validatePayload(resource, candidate, refs, { currentId: existing?.id });
  if (issues.length) return fail(res, 422, issues.join(' | '), { issues });

  if (existing && resource === 'editions' && existing.occupationId!==candidate.occupationId && refs.exams.some(ex=>ex.editionId===existing.id)) return fail(res,422,'Edição usada em provas não pode ser movida para outra ocupação');
  if (existing && resource === 'competitors' && existing.occupationId!==candidate.occupationId && (refs.executions.some(e=>e.competitorId===existing.id)||refs.technicalAssessments.some(e=>e.competitorId===existing.id)||refs.activities.some(e=>e.competitorId===existing.id)||refs.teams.some(t=>(t.competitorIds||[]).includes(existing.id)))) return fail(res,422,'Ocupação do competidor não pode mudar enquanto houver vínculos; mantenha o histórico');
  if (existing && resource === 'exams' && existing.occupationId!==candidate.occupationId && refs.executions.some(e=>e.examId===existing.id)) return fail(res,422,'Ocupação da prova não pode mudar após aplicações');
  if (resource === 'executions') {
    if(executionChangeLocked(existing,candidate))return fail(res,409,'Correção finalizada. Reabra primeiro a execução antes de alterar notas ou dados.');
    const exam = refs.exams.find((x) => x.id === candidate.examId);
    if (existing && existing.examId !== candidate.examId) {
      return fail(res, 422, 'Não altere a prova vinculada à execução. Crie uma nova execução.');
    }
    try {
      const snapshot = existing?.examSnapshot || {
        maxScore: exam.maxScore,
        title: exam.title, module: exam.module,
        subcriteria: structuredClone(exam.subcriteria || []),
        areaIds: structuredClone(exam.areaIds || []),
        competencyIds: structuredClone(exam.competencyIds || [])
      };
      Object.assign(candidate, computeExecution(candidate, snapshot));
      candidate.examSnapshot = snapshot;
      candidate.examVersion = existing?.examVersion || exam.version || 1;
      candidate.finalizedAt = candidate.status==='finalized' ? (existing?.status==='finalized' ? existing.finalizedAt : new Date().toISOString()) : null;
      candidate.finalizedBy = candidate.status==='finalized' ? (existing?.status==='finalized' ? existing.finalizedBy : req.user.id) : null;
      candidate.createdBy = existing?.createdBy || req.user.id;
      candidate.updatedBy = req.user.id;
      const events=Array.isArray(existing?.statusEvents)?existing.statusEvents:[];
      candidate.statusEvents=[...events,...(existing&&existing.status!==candidate.status?[{from:existing.status||'draft',to:candidate.status,at:new Date().toISOString(),by:req.user.id}]:[])];
    } catch (err) { return fail(res, 422, err.message); }
  }

  if (resource === 'exams') {
    const changed = existing && (
      JSON.stringify(existing.areaIds || []) !== JSON.stringify(candidate.areaIds || []) ||
      JSON.stringify(existing.competencyIds || []) !== JSON.stringify(candidate.competencyIds || []) ||
      JSON.stringify(existing.subcriteria || []) !== JSON.stringify(candidate.subcriteria || []) ||
      Number(existing.maxScore) !== Number(candidate.maxScore)
    );
    candidate.version = changed ? Number(existing.version || 1) + 1 : existing?.version || candidate.version || 1;
  }

  const timestamp = new Date().toISOString();
  candidate.createdAt = existing?.createdAt || timestamp;
  candidate.updatedAt = timestamp;

  if (isNew) rows.push(candidate);
  else {
    const index = rows.findIndex((r) => String(r.id) === String(existing.id));
    if (index < 0) return fail(res, 404, 'Registro não encontrado');
    rows[index] = candidate;
  }
  write(resource, rows);
  return res.status(isNew ? 201 : 200).json(candidate);
}

function deleteResource(resource, req, res) {
  const id = String(req.params.id);
  const rows = read(resource);
  const existing = rows.find((x) => String(x.id) === id);
  if (!existing) return fail(res, 404, 'Registro não encontrado');
  if(!auth.canMutate(req.user,resource,existing,all()))return fail(res,403,'Sem permissão nesta ocupação');
  if (resource === 'examTypes' && read('exams').some(ex => ex.typeKey===existing.key && (!existing.occupationId || ex.occupationId===existing.occupationId))) return fail(res,409,'Tipo de prova usado por prova cadastrada');
  if (resource === 'occupations' && auth.getUsers().some(u=>(u.occupationIds||[]).includes(id)))return fail(res,409,'Ocupação vinculada a conta de avaliador');
  if (resource === 'competitors' && read('teams').some(t => (t.competitorIds || []).includes(id))) return fail(res, 409, 'Competidor vinculado a uma equipe');
  if (resource === 'occupations' && read('evaluators').some(e=>(e.occupationIds||[]).includes(id))) return fail(res,409,'Ocupação vinculada a avaliador');
  if (resource === 'competencies' && read('exams').some(ex => (ex.competencyIds||[]).includes(id) ||
      (ex.subcriteria||[]).some(sub => (sub.aspects||[]).some(a =>
        (a.competencyLinks||[]).some(link=>String(link.competencyId)===id) || (a.competencyIds||[]).includes(id))))) {
    return fail(res,409,'Competência vinculada a uma prova');
  }
  if (resource === 'occupationAreas' && (read('exams').some(ex => (ex.areaIds||[]).includes(id) ||
      (ex.subcriteria||[]).some(sub => (sub.aspects||[]).some(a => (a.areaIds||[]).includes(id)))) ||
      read('competencies').some(c => (c.areaIds||[]).includes(id)))) {
    return fail(res,409,'Área vinculada a provas ou competências');
  }
  if (resource === 'wsos' && read('exams').some((ex) => ex.subcriteria?.some((sub) =>
    sub.aspects?.some((a) => String(a.wsosSection) === String(existing.code) && (!existing.occupationId || ex.occupationId===existing.occupationId))))) {
    return fail(res, 409, 'Seção WSOS usada por aspectos CIS');
  }
  for (const [other, field, matchField] of USED_BY[resource] || []) {
    const value = matchField ? existing[matchField] : existing.id;
    if (read(other).some((r) => r[field] === value && (other !== resource || r.id !== existing.id))) {
      return fail(res, 409, `Registro vinculado a ${other}. Remova os vínculos antes de excluir.`);
    }
  }
  write(resource, rows.filter((x) => String(x.id) !== id));
  res.status(200).json(existing);
}

// No URL rewriting, no nested JSON Server routers: every endpoint is explicit.
for (const resource of RESOURCES) {
  const collection = `/api/${resource}`;
  const item = `${collection}/:id`;
  app.get(collection, safe((req, res) => {const db=all();res.json(read(resource).filter(row=>auth.visible(req.user,resource,row,db)))}));
  app.get(item, safe((req, res) => {
    const db=all();
    const found = read(resource).find((x) => String(x.id) === String(req.params.id)&&auth.visible(req.user,resource,x,db));
    return found ? res.json(found) : fail(res, 404, 'Registro não encontrado');
  }));
  app.post(collection, safe((req, res) => saveResource(resource, req, res)));
  app.put(item, safe((req, res) => {
    const existing = read(resource).find((x) => String(x.id) === String(req.params.id));
    return existing ? saveResource(resource, req, res, existing) : fail(res, 404, 'Registro não encontrado');
  }));
  app.patch(item, safe((req, res) => {
    const existing = read(resource).find((x) => String(x.id) === String(req.params.id));
    return existing ? saveResource(resource, req, res, existing) : fail(res, 404, 'Registro não encontrado');
  }));
  app.delete(item, safe((req, res) => deleteResource(resource, req, res)));
}

app.use('/api', (_req, res) => fail(res, 404, 'Endpoint não encontrado'));
app.use((err, _req, res, _next) => {
  console.error('[API]', err);
  if (!res.headersSent) fail(res, 500, 'Erro interno. Consulte o console da API.');
});

if (require.main === module) {
  const server = app.listen(port, host, () => {
    console.log(`Skill Training API: http://${host}:${port}/api/health`);
    console.log('Rotas:', RESOURCES.map((r) => `/api/${r}`).join(', '));
  });
  server.on('error', (err) => {
    console.error(`Não foi possível iniciar a API em ${host}:${port}:`, err.message);
    process.exitCode = 1;
  });
}
module.exports = app;
