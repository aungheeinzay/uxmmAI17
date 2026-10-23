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
    'get /api/delivery-providers', 'get /api/operator/my-provider', 'get /api/operator/my-provider/city-prices',
    'post /api/operator/my-provider/city-prices', 'patch /api/operator/my-provider/city-prices/{priceId}',
    'post /api/auth/register', 'post /api/auth/login', 'post /api/auth/refresh',
    'post /api/auth/verify-email', 'post /api/auth/resend-verification', 'post /api/auth/forgot-password', 'post /api/auth/reset-password',
    'post /api/auth/logout', 'get /api/users/me', 'patch /api/users/me', 'get /health',
    'post /api/riders/invitations', 'post /api/riders/activate',
    'get /api/orders', 'post /api/orders', 'get /api/orders/{id}',
    'get /api/orders/{id}/qr', 'get /api/orders/{id}/status', 'patch /api/orders/{id}/status',
    'get /api/operator/orders', 'get /api/operator/orders/{id}', 'get /api/operator/reports/overview',
    'patch /api/operator/orders/{id}/receive',
    'get /api/operator/riders', 'get /api/operator/assignments', 'post /api/operator/assignments',
    'get /api/operator/riders/overview', 'get /api/operator/riders/invitations', 'get /api/operator/riders/{riderId}',
    'patch /api/operator/riders/{riderId}', 'patch /api/operator/riders/{riderId}/deactivate', 'patch /api/operator/riders/{riderId}/reactivate',
    'get /api/operator/warehouse/overview', 'get /api/operator/warehouse/parcels',
    'get /api/rider/assignments', 'get /api/rider/assignments/{id}', 'patch /api/rider/assignments/{id}/status', 'post /api/rider/parcel-scans/verify',
    'get /api/rider/profile', 'patch /api/rider/profile',
    'post /api/rider/incidents', 'get /api/rider/incidents', 'get /api/rider/incidents/{id}',
    'get /api/operator/incidents', 'get /api/operator/incidents/{id}', 'patch /api/operator/incidents/{id}/review',
    'get /api/sme/dashboard',
    'get /api/delivery/services', 'get /api/delivery/cities',
  ].sort());
  assert.deepEqual(spec.components.securitySchemes.bearerAuth.type, 'http');
  assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');
  assert.equal(spec.components.securitySchemes.bearerAuth.bearerFormat, undefined);
  for (const path of ['/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/verify-email', '/api/auth/resend-verification', '/api/auth/forgot-password', '/api/auth/reset-password']) {
    assert.deepEqual(spec.paths[path].post.security, []);
  }
  assert.deepEqual(spec.paths['/api/auth/logout'].post.security, [{ bearerAuth: [] }]);
  for (const method of ['get', 'patch']) assert.deepEqual(spec.paths['/api/users/me'][method].security, [{ bearerAuth: [] }]);
  const { registerSchema, loginSchema, refreshSchema, verifyEmailSchema, emailRequestSchema, resetPasswordSchema } = require('../dist/modules/auth/auth.validation');
  const { profileUpdateSchema } = require('../dist/modules/users/user.validation');
  const { z } = require('zod');
  for (const [name, schema] of [['RegisterInput', registerSchema], ['LoginInput', loginSchema], ['RefreshInput', refreshSchema], ['VerifyEmailInput', verifyEmailSchema], ['EmailRequestInput', emailRequestSchema], ['ResetPasswordInput', resetPasswordSchema]]) {
    assert.deepEqual(spec.components.schemas[name], z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }));
  }
  assert.deepEqual(spec.components.schemas.ProfileUpdate, { ...z.toJSONSchema(profileUpdateSchema, { target: 'openapi-3.0', io: 'input' }), minProperties: 1 });
  const { operatorRiderUpdateSchema } = require('../dist/modules/riders/management/rider-management.validation');
  assert.deepEqual(spec.paths['/api/operator/riders/{riderId}'].patch.requestBody.content['application/json'].schema, z.toJSONSchema(operatorRiderUpdateSchema, { target: 'openapi-3.0', io: 'input' }));
  function verifyRefs(node) {
    if (!node || typeof node !== 'object') return;
    if (node.$ref) {
      assert.ok(node.$ref.startsWith('#/components/schemas/'));
      assert.ok(spec.components.schemas[node.$ref.split('/').pop()]);
    }
    for (const value of Object.values(node)) verifyRefs(value);
  }
  verifyRefs(spec);
  assert.equal(spec.components.schemas.Registration.properties.confirmationRequired.enum[0], true);
  assert.equal(spec.components.schemas.Registration.properties.accessToken, undefined);
  assert.ok(spec.paths['/api/auth/login'].post.responses['403']);
  const login403Codes = Object.values(spec.paths['/api/auth/login'].post.responses['403'].content['application/json'].examples).map(example => example.value.error.code);
  assert.ok(login403Codes.includes('EMAIL_NOT_VERIFIED'));
  assert.ok(login403Codes.includes('ACCOUNT_DEACTIVATED'));
  assert.match(spec.paths['/api/operator/assignments'].post.responses['404'].description, /deactivated/i);
  const deactivate409 = Object.values(spec.paths['/api/operator/riders/{riderId}/deactivate'].patch.responses['409'].content['application/json'].examples).map(example => example.value.error.code);
  assert.ok(deactivate409.includes('RIDER_HAS_ACTIVE_ASSIGNMENTS'));
  assert.ok(deactivate409.includes('RIDER_DEACTIVATION_CONFLICT'));
  assert.ok(spec.paths['/api/operator/riders/{riderId}/deactivate'].patch.requestBody === undefined);
  const riderListParams = spec.paths['/api/operator/riders'].get.parameters.map(parameter => parameter.name);
  for (const name of ['page', 'pageSize', 'search', 'workload', 'status', 'eligible']) assert.ok(riderListParams.includes(name), `Rider list docs need ${name}`);
  for (const path of ['/api/operator/riders/invitations', '/api/operator/riders/{riderId}']) {
    assert.ok(spec.paths[path].get.parameters.some(parameter => parameter.name === 'pageSize'), `${path} docs need pageSize`);
  }
  const orderList = spec.paths['/api/orders'].get;
  assert.deepEqual(orderList.parameters.find(p => p.name === 'tab').schema.enum, ['all', 'needs_pickup', 'exceptions']);
  assert.deepEqual(spec.components.schemas.OrderList.required, ['orders', 'pagination', 'tabCounts']);
  assert.deepEqual(orderList.responses['200'].content['application/json'].example.data.tabCounts, { all: 1, needsPickup: 1, exceptions: 0 });
  for (const [path, schema] of [['/api/auth/verify-email', verifyEmailSchema], ['/api/auth/reset-password', resetPasswordSchema]]) {
    assert.equal(schema.safeParse(spec.paths[path].post.requestBody.content['application/json'].example).success, true);
  }
  assert.ok(spec.components.schemas.RiderProfileResult);
  assert.ok(spec.components.schemas.RiderProfileUpdateInput);
  for (const name of ['Riders', 'Rider Profile', 'Rider Deliveries', 'Rider Incidents', 'Operator Incidents']) {
    assert.ok(spec.tags.find(tag => tag.name === name).description, `${name} tag needs a description`);
  }
  for (const [method, path] of [['get', '/api/rider/assignments'], ['get', '/api/rider/assignments/{id}'], ['patch', '/api/rider/assignments/{id}/status']]) {
    const forbidden = spec.paths[path][method].responses['403'];
    assert.match(forbidden.description, /RIDER_PROFILE_INCOMPLETE/);
    assert.match(forbidden.description, /RIDER_PROVIDER_MEMBERSHIP_REQUIRED/);
    const codes = Object.values(forbidden.content['application/json'].examples).map(example => example.value.error.code);
    assert.ok(codes.includes('FORBIDDEN'));
    assert.ok(codes.includes('RIDER_DEACTIVATED'));
    assert.ok(codes.includes('RIDER_PROVIDER_MEMBERSHIP_REQUIRED'));
    assert.ok(codes.includes('RIDER_PROFILE_INCOMPLETE'));
  }
  for (const method of ['get', 'patch']) {
    const examples = spec.paths['/api/rider/profile'][method].responses['200'].content['application/json'].examples;
    assert.ok(examples.complete);
    assert.equal(examples.incomplete.value.data.profileComplete, false);
    assert.deepEqual(examples.incomplete.value.data.missingFields, ['vehicleType']);
    assert.equal(examples.providerSetup.value.data.provider, null);
    assert.deepEqual(examples.providerSetup.value.data.missingFields, ['provider']);
  }
  assert.doesNotMatch(JSON.stringify(spec), /postgres(?:ql)?:\/\/|passwordHash|password_hash|access_hash|refresh_hash/);
});

test('public operations reach validation without auth and protected operations reject missing Bearer', async () => {
  assert.equal((await fetch(base + '/health')).status, 200);
  for (const path of ['/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/verify-email', '/api/auth/resend-verification', '/api/auth/forgot-password', '/api/auth/reset-password']) {
    const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
  }
  for (const [method, path] of [['GET', '/api/users/me'], ['PATCH', '/api/users/me'], ['POST', '/api/auth/logout']]) {
    assert.equal((await fetch(base + path, { method })).status, 401);
  }
});

test('email request endpoints share a stricter IP rate limit', async () => {
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const path = i % 2 ? '/api/auth/forgot-password' : '/api/auth/resend-verification';
    const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    statuses.push(res.status);
    if (res.status === 429) assert.equal((await res.json()).error.code, 'RATE_LIMITED');
  }
  assert.equal(statuses.at(-1), 429);
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
