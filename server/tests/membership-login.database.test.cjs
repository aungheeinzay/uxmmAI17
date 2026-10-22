const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('verified Operator without membership can sign in and load their profile on development PostgreSQL', {
  skip: process.env.PARCELOPS_PRICING_DB_TEST !== 'confirmed', timeout: 60000,
}, async () => {
  require('dotenv').config({ quiet: true });
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.equal(new URL(process.env.DATABASE_URL).hostname, process.env.PARCELOPS_PRICING_DB_HOST);
  const { prisma } = require('../dist/config/prisma');
  const { hashPassword } = require('../dist/modules/auth/auth.password');
  const { app } = require('../dist/app');
  const id = randomUUID(), email = `membership-login-${id}@example.test`, password = randomUUID();
  let server;
  try {
    await prisma.account.create({ data: { email, passwordHash: await hashPassword(password), emailVerifiedAt: new Date(),
      profile: { create: { id, role: 'OPERATOR', fullName: 'Fictional Login Check', providerId: null } } } });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.on('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200);
    const { data } = await login.json();
    for (const path of ['/api/users/me', '/api/operator/my-provider']) {
      const response = await fetch(base + path, { headers: { Authorization: `Bearer ${data.accessToken}` } });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.data.provider, null);
      if (path === '/api/users/me') { assert.equal(payload.data.email, email); assert.equal(payload.data.role, 'OPERATOR'); }
    }
    const refresh = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: data.refreshToken }) });
    assert.equal(refresh.status, 200);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await prisma.account.deleteMany({ where: { id, email } });
    await prisma.profile.deleteMany({ where: { id, fullName: 'Fictional Login Check' } });
    await prisma.$disconnect();
  }
});
