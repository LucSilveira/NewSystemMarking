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
const { validatePayload, computeExecution } = require('./rules.cjs');

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

app.get('/api', (_req, res) => res.json({ status: 'ok', endpoints: ['/api/health', ...RESOURCES.map((r) => `/api/${r}`)] }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', storage: 'separate JSON files', resources: RESOURCES }));

app.get('/api/reports/overview', safe((_req, res) => {
  const db = all();
  const latest = [...db.executions].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
  const valid = db.executions.filter((e) => e.overallScore != null && e.maxScore > 0);
  const weightedMax = valid.reduce((sum, e) => sum + e.maxScore, 0);
  const overall = weightedMax ? Math.round(valid.reduce((sum, e) => sum + e.overallScore, 0) / weightedMax * 10000) / 100 : null;
  const wsosResults = {};
  for (const e of db.executions) {
    for (const s of e.wsosResults || []) {
      const k = s.wsosSection;
      wsosResults[k] ??= { earned: 0, maxScore: 0, entries: 0 };
      wsosResults[k].earned += s.earned;
      wsosResults[k].maxScore += s.maxScore;
      wsosResults[k].entries++;
    }
  }
  res.json({ counts: Object.fromEntries(RESOURCES.map((k) => [k, db[k].length])), overall, latest, wsosResults });
}));

app.get('/api/reports/competitor/:id', safe((req, res) => {
  const { id } = req.params;
  const db = all();
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
  candidate.id = existing?.id || input.id || randomUUID();
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return fail(res, 422, 'ID inválido');
  if (isNew && rows.some((r) => String(r.id) === String(candidate.id))) return fail(res, 409, 'ID já cadastrado');

  const refs = all();
  const issues = validatePayload(resource, candidate, refs, { currentId: existing?.id });
  if (issues.length) return fail(res, 422, issues.join(' | '), { issues });

  if (existing && resource === 'competitors' && existing.occupationId!==candidate.occupationId && (refs.executions.some(e=>e.competitorId===existing.id)||refs.technicalAssessments.some(e=>e.competitorId===existing.id)||refs.activities.some(e=>e.competitorId===existing.id)||refs.teams.some(t=>(t.competitorIds||[]).includes(existing.id)))) return fail(res,422,'Ocupação do competidor não pode mudar enquanto houver vínculos; mantenha o histórico');
  if (existing && resource === 'exams' && existing.occupationId!==candidate.occupationId && refs.executions.some(e=>e.examId===existing.id)) return fail(res,422,'Ocupação da prova não pode mudar após aplicações');
  if (resource === 'executions') {
    const exam = refs.exams.find((x) => x.id === candidate.examId);
    if (existing && existing.examId !== candidate.examId) {
      return fail(res, 422, 'Não altere a prova vinculada à execução. Crie uma nova execução.');
    }
    try {
      const snapshot = existing?.examSnapshot || {
        maxScore: exam.maxScore,
        subcriteria: structuredClone(exam.subcriteria || []),
        areaIds: structuredClone(exam.areaIds || []),
        competencyIds: structuredClone(exam.competencyIds || [])
      };
      Object.assign(candidate, computeExecution(candidate, snapshot));
      candidate.examSnapshot = snapshot;
      candidate.examVersion = existing?.examVersion || exam.version || 1;
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
  if (resource === 'examTypes' && read('exams').some(ex => ex.typeKey===existing.key && (!existing.occupationId || ex.occupationId===existing.occupationId))) return fail(res,409,'Tipo de prova usado por prova cadastrada');
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
  app.get(collection, safe((_req, res) => res.json(read(resource))));
  app.get(item, safe((req, res) => {
    const found = read(resource).find((x) => String(x.id) === String(req.params.id));
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
