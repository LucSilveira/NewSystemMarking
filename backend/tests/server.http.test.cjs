'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let available = true;
try { require.resolve('json-server'); } catch { available = false; }

test('API HTTP: GET, POST, PATCH, DELETE with independent JSON files', { skip: available ? false : 'Install backend dependencies to run HTTP integration test' }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-training-api-'));
  for (const filename of fs.readdirSync(path.join(__dirname, '../data'))) {
    if (filename.endsWith('.json') && filename !== 'seed-reference.json') {
      fs.copyFileSync(path.join(__dirname, '../data', filename), path.join(tmp, filename));
    }
  }
  const priorDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tmp;
  const {createUser}=require('../src/auth.cjs');
  createUser({name:'Administrador de teste',username:'admin-test',password:'SenhaDeTesteSuperForte!2026',role:'admin',occupationIds:[],active:true});
  const app = require('../src/server.cjs');
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');

    const unauthorized=await fetch(`${base}/exams`);
    assert.equal(unauthorized.status,401);
    const login=await fetch(`${base}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin-test',password:'SenhaDeTesteSuperForte!2026'})});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const authFetch=(path,options={})=>fetch(`${base}${path}`,{...options,headers:{Cookie:cookie,'X-STM-Client':'1',...(options.headers||{})}});
    const exams = await authFetch('/exams');
    assert.equal(exams.status, 200);
    const list = await exams.json();
    assert.equal(Array.isArray(list), true);
    assert.equal(list.length >= 7, true);

    const specific = await authFetch(`/exams/${encodeURIComponent(list[0].id)}`);
    assert.equal(specific.status, 200);
    assert.equal((await specific.json()).id, list[0].id);

    const missing = await authFetch(`/exams/does-not-exist`);
    assert.equal(missing.status, 404);

    const create = await authFetch(`/competencies`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Competência de teste' })
    });
    assert.equal(create.status, 201);
    const created = await create.json();
    assert.ok(created.id);

    const update = await authFetch(`/competencies/${created.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Competência atualizada' })
    });
    assert.equal(update.status, 200);
    assert.equal((await update.json()).name, 'Competência atualizada');

    const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'competencies.json'), 'utf8'));
    assert.equal(saved.competencies.some((row) => row.id === created.id && row.name === 'Competência atualizada'), true);

    const remove = await authFetch(`/competencies/${created.id}`, { method: 'DELETE' });
    assert.equal(remove.status, 200);
    const after = await authFetch(`/competencies/${created.id}`);
    assert.equal(after.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (priorDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = priorDir;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
