const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { prisma } = require('../dist/config/prisma');
const { Prisma } = require('../dist/generated/prisma/client');
const auth = require('../dist/modules/auth/auth.repository');
const id = randomUUID(), ownerId = randomUUID();
const tokens = { OPERATOR: 'O'.repeat(43), SME: 'S'.repeat(43), RIDER: 'R'.repeat(43) };
auth.findSession = async hash => {
  const role = Object.keys(tokens).find(role => createHash('sha256').update(tokens[role]).digest('hex') === hash);
  return role ? { accessExpiresAt: new Date(Date.now() + 60000), account: {
    id: randomUUID(), email: 'fictional@example.invalid', emailVerifiedAt: new Date(), profile: { role },
  } } : null;
};
const row = { id, orderCode: 'PODEAD000000000001', ownerId, recipientName: 'FICTIONAL Recipient',
  phoneNumber: 'TEST-NOT-DIALABLE', township: 'Tamwe', deliveryAddress: 'FICTIONAL lane', senderName: 'TEST Shop',
  parcelWeightKg: new Prisma.Decimal('1.25'), codAmount: new Prisma.Decimal('2500'), currency: 'MMK',
  status: 'CREATED', createdAt: new Date(), updatedAt: new Date(), deliveryInstructions: null,
  owner: { id: ownerId, fullName: 'TEST Seller', phone: null }, operatorId: null, operator: null };
let listArgs, countArgs, detailArgs, transactionOptions;
prisma.parcelOrder.findMany = async args => { listArgs = args; return [row]; };
prisma.parcelOrder.count = async args => { countArgs = args; return 41; };
prisma.parcelOrder.findFirst = async args => {
  detailArgs = args;
  return args.where.id === id ? { ...row, statusEvents: [{ id: randomUUID(), previousStatus: 'CREATED',
    status: 'PICKED_UP', note: null, createdAt: new Date(), actor: { id: ownerId, fullName: 'TEST Actor' } }] } : null;
};
prisma.$transaction = async (queries, options) => { transactionOptions = options; return Promise.all(queries); };
const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(r => server.close(r)); await prisma.$disconnect(); });
async function get(path, token = tokens.OPERATOR) {
  const response = await fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}`, 'X-Role': 'OPERATOR' } : {} });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
test('both routes enforce sessions and trusted OPERATOR role', async () => {
  for (const path of ['/api/operator/orders', `/api/operator/orders/${id}`]) {
    for (const token of ['', 'invalid', 'Z'.repeat(43)]) assert.equal((await get(path, token)).status, 401);
    for (const role of ['SME', 'RIDER']) assert.equal((await get(path, tokens[role])).status, 403);
    assert.equal((await get(path)).status, 200);
  }
  // Existing SME authorization must remain intact.
  assert.equal((await get('/api/orders')).status, 403);
});
test('pagination, filters, consistent count, deterministic order and safe projections', async () => {
  const result = await get('/api/operator/orders?page=2&pageSize=20&search=TEST&township=Tamwe&status=CREATED&createdDate=2026-10-21');
  assert.equal(result.status, 200);
  assert.equal(result.cache, 'no-store');
  assert.deepEqual(result.body.data.pagination, { page: 2, pageSize: 20, total: 41, totalPages: 3 });
  assert.equal(result.body.data.orders[0].parcelWeight, '1.25');
  assert.equal(result.body.data.orders[0].codAmount, '2500');
  assert.equal(listArgs.skip, 20); assert.equal(listArgs.take, 20);
  assert.deepEqual(listArgs.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  assert.deepEqual(listArgs.where, countArgs.where);
  assert.deepEqual(listArgs.where.owner, { role: 'SME' });
  assert.equal(listArgs.where.status, 'CREATED');
  assert.deepEqual(listArgs.where.township, { equals: 'Tamwe', mode: 'insensitive' });
  assert.equal(listArgs.where.OR[0].orderCode.contains, 'TEST');
  assert.equal(listArgs.where.OR[1].recipientName.contains, 'TEST');
  assert.equal(listArgs.where.createdAt.gte.toISOString(), '2026-10-21T00:00:00.000Z');
  assert.equal(listArgs.where.createdAt.lt.toISOString(), '2026-10-22T00:00:00.000Z');
  assert.equal(transactionOptions.isolationLevel, 'RepeatableRead');
  assert.deepEqual(listArgs.select.owner.select, { id: true, fullName: true, phone: true });
  assert.deepEqual(listArgs.select.operator.select, { id: true, fullName: true, phone: true });
  assert.equal(listArgs.select.operatorId, true);
  assert.equal(listArgs.select.deliveryService, undefined);
  assert.doesNotMatch(JSON.stringify(listArgs.select), /account|password|session|token/i);
  assert.doesNotMatch(JSON.stringify(result.body), /password|session|token|Hash/);
});

test('assignment eligibility filters use the real relation and reject invalid values', async () => {
  assert.equal((await get('/api/operator/orders?status=PICKED_UP&unassigned=true')).status, 200);
  assert.deepEqual(listArgs.where.assignment, { is: null });
  assert.equal(listArgs.where.status, 'PICKED_UP');
  assert.equal((await get('/api/operator/orders?unassigned=false')).status, 200);
  assert.deepEqual(listArgs.where.assignment, { isNot: null });
  assert.equal((await get('/api/operator/orders?unassigned=maybe')).status, 400);
});
test('invalid inputs are rejected before database access', async () => {
  for (const query of ['page=0', 'page=1.1', 'pageSize=101', 'pageSize=0', 'status=RECEIVED', 'search=', 'createdDate=2026-02-30', 'ownerId=x', 'page=1&page=2']) {
    assert.equal((await get('/api/operator/orders?' + query)).status, 400, query);
  }
  assert.equal((await get('/api/operator/orders/invalid')).status, 400);
});
test('details include history, use safe projections, and missing parcels return 404', async () => {
  const result = await get(`/api/operator/orders/${id}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.statusEvents[0].status, 'PICKED_UP');
  assert.deepEqual(detailArgs.where, { id, owner: { role: 'SME' } });
  assert.deepEqual(detailArgs.select.statusEvents.orderBy, [{ createdAt: 'asc' }, { id: 'asc' }]);
  assert.deepEqual(detailArgs.select.statusEvents.select.actor.select, { id: true, fullName: true });
  assert.doesNotMatch(JSON.stringify(detailArgs.select), /account|password|session|token/i);
  assert.equal((await get(`/api/operator/orders/${randomUUID()}`)).status, 404);
});
test('empty pages retain correct totals and default page bounds', async () => {
  prisma.parcelOrder.findMany = async args => { listArgs = args; return []; };
  prisma.parcelOrder.count = async () => 0;
  const result = await get('/api/operator/orders');
  assert.deepEqual(result.body.data, { orders: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  assert.equal(listArgs.skip, 0); assert.equal(listArgs.take, 20);
});
