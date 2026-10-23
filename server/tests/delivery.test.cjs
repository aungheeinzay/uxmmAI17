const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const digest = value => createHash('sha256').update(value).digest('hex');
const authRepo = require('../dist/modules/auth/auth.repository');
const repo = require('../dist/modules/delivery/delivery.repository');
const findServicesForCity = repo.findServicesForCity;

const providerIds = { shwe: randomUUID(), khit: randomUUID() };
const catalog = new Map([
  ['yangon', [
    { id: providerIds.khit, name: 'Khit Thit', fee: '4200' },
    { id: providerIds.shwe, name: 'Shwe Express', fee: '3500' },
  ]],
  ['mandalay', [{ id: providerIds.shwe, name: 'Shwe Express', fee: '4000' }]],
]);
const lookups = [];
repo.findServicesForCity = async city => {
  lookups.push(city);
  // Prisma returns Decimal fees; toString normalizes 3500.00 to "3500".
  return (catalog.get(city) ?? []).map(entry => ({ id: entry.id, name: entry.name, cityPrices: [{ fee: { toString: () => entry.fee } }] }));
};
repo.findActiveCities = async () => [...catalog.keys()].sort().map(city => ({ city }));

const sessions = new Map();
const tokens = { SME: 'S'.repeat(43), OPERATOR: 'O'.repeat(43), RIDER: 'R'.repeat(43), expired: 'E'.repeat(43) };
for (const role of ['SME', 'OPERATOR', 'RIDER']) sessions.set(digest(tokens[role]), {
  accessExpiresAt: new Date(Date.now() + 60000), account: {
    id: randomUUID(), email: `${role.toLowerCase()}@example.com`,
    emailVerifiedAt: new Date(), profile: { role },
  },
});
sessions.set(digest(tokens.expired), { ...sessions.get(digest(tokens.SME)), accessExpiresAt: new Date(0) });
authRepo.findSession = async hash => sessions.get(hash) || null;

const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(r => server.close(r)); await require('../dist/config/prisma').prisma.$disconnect(); });
async function get(path, token) {
  const response = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: response.status, body: await response.json() };
}

test('authentication and the SME role protect the delivery catalog', async () => {
  for (const token of [undefined, 'invalid', tokens.expired]) assert.equal((await get('/api/delivery/services?city=yangon', token)).status, 401);
  for (const role of ['OPERATOR', 'RIDER']) {
    assert.equal((await get('/api/delivery/services?city=yangon', tokens[role])).status, 403);
    assert.equal((await get('/api/delivery/cities', tokens[role])).status, 403);
  }
  assert.equal((await get('/api/delivery/cities')).status, 401);
});

test('a city is required and unknown query parameters are rejected', async () => {
  for (const path of ['/api/delivery/services', '/api/delivery/services?city=%20', '/api/delivery/services?city=yangon&page=1']) {
    const result = await get(path, tokens.SME);
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  }
});

test('services are normalized by city and priced in MMK', async () => {
  lookups.length = 0;
  const result = await get('/api/delivery/services?city=%20Yangon%20', tokens.SME);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    success: true,
    data: {
      city: 'yangon',
      services: [
        { id: providerIds.khit, name: 'Khit Thit', city: 'yangon', fee: '4200', currency: 'MMK' },
        { id: providerIds.shwe, name: 'Shwe Express', city: 'yangon', fee: '3500', currency: 'MMK' },
      ],
    },
  });
  assert.deepEqual(lookups, ['yangon']);
});
test('service lookup excludes providers without an assigned operator', async () => {
  const { prisma } = require('../dist/config/prisma');
  const originalFindMany = prisma.deliveryProvider.findMany;
  let query;
  prisma.deliveryProvider.findMany = async args => { query = args; return []; };
  try {
    await findServicesForCity('yangon');
    assert.deepEqual(query.where.operators, { some: { role: 'OPERATOR' } });
  } finally { prisma.deliveryProvider.findMany = originalFindMany; }
});

test('a city without providers returns an empty list', async () => {
  const result = await get('/api/delivery/services?city=naypyidaw', tokens.SME);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data, { city: 'naypyidaw', services: [] });
});

test('cities are the distinct active price cities in alphabetical order', async () => {
  const result = await get('/api/delivery/cities', tokens.SME);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { success: true, data: { cities: ['mandalay', 'yangon'] } });
});
