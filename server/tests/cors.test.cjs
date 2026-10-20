const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.FRONTEND_URL = 'http://localhost:3000';
const { app } = require('../dist/app');
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await require('../dist/config/prisma').prisma.$disconnect();
});

test('frontend JSON registration preflight succeeds without credentials', async () => {
  const response = await fetch(base + '/api/auth/register', {
    method: 'OPTIONS', headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.match(response.headers.get('access-control-allow-methods'), /POST/);
  assert.match(response.headers.get('access-control-allow-headers'), /Content-Type/i);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
});

test('validation errors remain readable from the frontend', async () => {
  const response = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
});

test('unapproved origins are not given matching CORS permission', async () => {
  const response = await fetch(base + '/health', { headers: { Origin: 'https://unapproved.example' } });
  assert.notEqual(response.headers.get('access-control-allow-origin'), 'https://unapproved.example');
});
