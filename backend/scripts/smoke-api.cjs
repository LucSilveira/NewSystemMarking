'use strict';
// Start the backend separately, then run: npm run api:check
// Read-only connectivity check: it does not change the JSON files.
const base = (process.env.API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const endpoints = ['/api/health', '/api/exams', '/api/occupations', '/api/occupationAreas', '/api/competencies', '/api/editions', '/api/wsos', '/api/reports/overview'];

(async () => {
  let errors = 0;
  for (const route of endpoints) {
    try {
      const response = await fetch(base + route, { signal: AbortSignal.timeout(5000) });
      const raw = await response.text();
      let body;
      try { body = JSON.parse(raw); } catch { throw new Error(`Resposta não é JSON: ${raw.slice(0, 120)}`); }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.error || raw.slice(0, 120)}`);
      const detail = Array.isArray(body) ? `${body.length} registros` : 'OK';
      console.log(`OK  ${route} (${detail})`);
    } catch (error) {
      errors++;
      console.error(`ERRO ${route}: ${error.message}`);
    }
  }
  if (errors) {
    console.error(`\n${errors} endpoint(s) falharam. Confira se o backend iniciou e se a porta está correta.`);
    process.exitCode = 1;
  } else console.log('\nTodos os endpoints GET responderam corretamente.');
})();
