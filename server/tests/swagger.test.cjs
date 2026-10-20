const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
delete process.env.ENABLE_API_DOCS;
const { app } = require('../dist/app');
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await require('../dist/config/prisma').prisma.$disconnect();
});

test('Swagger HTML, assets and valid JSON document are served', async () => {
  const ui = await fetch(base + '/api/docs');
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /swagger-ui/);
  for (const asset of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-init.js']) {
    const res = await fetch(base + '/api/docs/' + asset);
    assert.equal(res.status, 200);
    if (asset === 'swagger-ui-init.js') {
      const js = await res.text();
      assert.match(js, /\/api\/docs.json/);
      assert.match(js, /persistAuthorization/);
    }
  }
  const res = await fetch(base + '/api/docs.json');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const spec = await res.json();
  assert.equal(spec.openapi, '3.0.3');
  const operations = Object.entries(spec.paths).flatMap(([path, methods]) => Object.keys(methods).map(method => `${method} ${path}`));
  assert.deepEqual(operations.sort(), [
    'post /api/auth/register', 'post /api/auth/login', 'post /api/auth/refresh',
    'post /api/auth/logout', 'get /api/users/me', 'patch /api/users/me', 'get /health',
  ].sort());
  assert.deepEqual(spec.components.securitySchemes.bearerAuth.type, 'http');
  assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');
  assert.equal(spec.components.securitySchemes.bearerAuth.bearerFormat, undefined);
  for (const path of ['/api/auth/register', '/api/auth/login', '/api/auth/refresh']) {
    assert.deepEqual(spec.paths[path].post.security, []);
  }
  assert.deepEqual(spec.paths['/api/auth/logout'].post.security, [{ bearerAuth: [] }]);
  for (const method of ['get', 'patch']) assert.deepEqual(spec.paths['/api/users/me'][method].security, [{ bearerAuth: [] }]);
  const { registerSchema, loginSchema, refreshSchema } = require('../dist/modules/auth/auth.validation');
  const { profileUpdateSchema } = require('../dist/modules/users/user.validation');
  const { z } = require('zod');
  for (const [name, schema] of [['RegisterInput', registerSchema], ['LoginInput', loginSchema], ['RefreshInput', refreshSchema]]) {
    assert.deepEqual(spec.components.schemas[name], z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }));
  }
  assert.deepEqual(spec.components.schemas.ProfileUpdate, { ...z.toJSONSchema(profileUpdateSchema, { target: 'openapi-3.0', io: 'input' }), minProperties: 1 });
  function verifyRefs(node) {
    if (!node || typeof node !== 'object') return;
    if (node.$ref) {
      assert.ok(node.$ref.startsWith('#/components/schemas/'));
      assert.ok(spec.components.schemas[node.$ref.split('/').pop()]);
    }
    for (const value of Object.values(node)) verifyRefs(value);
  }
  verifyRefs(spec);
  assert.doesNotMatch(JSON.stringify(spec), /postgres(?:ql)?:\/\/|passwordHash|password_hash|access_hash|refresh_hash/);
});

test('public operations reach validation without auth and protected operations reject missing Bearer', async () => {
  assert.equal((await fetch(base + '/health')).status, 200);
  for (const path of ['/api/auth/register', '/api/auth/login', '/api/auth/refresh']) {
    const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
  }
  for (const [method, path] of [['GET', '/api/users/me'], ['PATCH', '/api/users/me'], ['POST', '/api/auth/logout']]) {
    assert.equal((await fetch(base + path, { method })).status, 401);
  }
});

test('production hides both docs routes unless explicitly enabled; false disables in development', () => {
  const script = `
    const assert = require('node:assert/strict');
    const {app} = require('./dist/app');
    const server = app.listen(0, '127.0.0.1', async () => {
      try {
        const base = 'http://127.0.0.1:' + server.address().port;
        for (const path of ['/api/docs', '/api/docs.json', '/api/docs/swagger-ui-init.js']) {
          const r = await fetch(base + path);
          assert.equal(r.status, Number(process.env.EXPECTED_STATUS));
        }
      } catch (e) { console.error(e); process.exitCode = 1; }
      finally { server.close(); await require('./dist/config/prisma').prisma.$disconnect(); }
    });`;
  for (const [nodeEnv, flag, status] of [['production', undefined, 404], ['production', 'true', 200], ['production', 'false', 404], ['development', 'false', 404]]) {
    const env = { ...process.env, NODE_ENV: nodeEnv, EXPECTED_STATUS: String(status) };
    if (flag === undefined) delete env.ENABLE_API_DOCS; else env.ENABLE_API_DOCS = flag;
    const result = spawnSync(process.execPath, ['-e', script], { cwd: require('node:path').join(__dirname, '..'), env, encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  }
});
