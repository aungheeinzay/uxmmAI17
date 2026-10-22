const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { prisma } = require('../dist/config/prisma');
const repo = require('../dist/modules/riders/management/rider-management.repository');
const actual = { ...repo };
const service = require('../dist/modules/riders/management/rider-management.service');
const invitationRepo = require('../dist/modules/riders/rider.repository');
const auth = require('../dist/modules/auth/auth.service');
const operator = randomUUID(), provider = randomUUID(), rider = randomUUID(), foreign = randomUUID();
let configured = true, pending = 0, progress = 0, completed = 0;
const person = () => ({ id: rider, fullName: 'Rider One', phone: null, providerId: provider, provider: { id: provider, name: 'One' }, account: { email: 'rider@example.test', emailVerifiedAt: new Date() } });
repo.transaction = async work => work({});
repo.operator = async (_tx, id) => { assert.equal(id, operator); return { role: 'OPERATOR', providerId: configured ? provider : null }; };
repo.list = async (_tx, id) => { assert.equal(id, provider); return { rows: [person()], total: 1 }; };
repo.findRider = async (_tx, scope, id) => scope === provider && id === rider ? person() : null;
repo.counts = async () => [pending, progress, completed].map(value => value ? [{ riderId: rider, _count: { _all: value } }] : []);
repo.overview = async () => ({ totalRiders: 1, available: 1, assigned: 0, delivering: 0 });
repo.assignments = async () => ({ rows: [], total: 0 });
repo.invitations = async () => ({ rows: [{ id: randomUUID(), email: 'pending@example.test', fullName: null, createdAt: new Date(), expiresAt: new Date() }], total: 1 });
auth.authenticate = async role => ({ id: operator, role });
const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
async function call(path, role = 'OPERATOR') { const response = await fetch(base + path, { headers: role ? { Authorization: `Bearer ${role}` } : {} }); return { status: response.status, data: await response.json() }; }
test('management reads enforce roles, missing membership and strict filters', async () => {
  for (const path of ['/api/operator/riders', '/api/operator/riders/overview', '/api/operator/riders/invitations', `/api/operator/riders/${rider}`]) {
    assert.equal((await call(path, null)).status, 401);
    for (const role of ['SME', 'RIDER']) assert.equal((await call(path, role)).status, 403);
  }
  configured = false; assert.equal((await call('/api/operator/riders')).data.error.code, 'PROVIDER_MEMBERSHIP_REQUIRED'); configured = true;
  for (const query of ['providerId=' + foreign, 'workload=ONLINE', 'page=0', 'eligible=false']) assert.equal((await call('/api/operator/riders?' + query)).status, 400);
});
test('Rider list and details expose workload and safe provider identity, never account secrets', async () => {
  const result = await call('/api/operator/riders'); assert.equal(result.status, 200);
  assert.equal(result.data.data.riders[0].providerId, provider); assert.equal(result.data.data.riders[0].accountStatus, 'ACTIVATED');
  assert.equal(result.data.data.riders[0].account, undefined);
  assert.equal((await call(`/api/operator/riders/${foreign}`)).status, 404);
  assert.equal((await call(`/api/operator/riders/${rider}`)).data.data.rider.id, rider);
  const invitations = await call('/api/operator/riders/invitations'); assert.equal(invitations.data.data.invitations.length, 1);
  assert.doesNotMatch(JSON.stringify(invitations.data), /tokenHash|passwordHash|sessions/);
});
test('workload precedence and all counts derive from grouped assignment data', async () => {
  for (const [p, d, c, state] of [[0, 0, 3, 'AVAILABLE'], [2, 0, 0, 'HAS_ASSIGNED_TASKS'], [0, 1, 0, 'DELIVERING'], [3, 2, 4, 'DELIVERING']]) {
    pending = p; progress = d; completed = c;
    const result = await service.list({ id: operator, role: 'OPERATOR' }, { page: 1, pageSize: 20 });
    assert.equal(result.riders[0].workload, state); assert.equal(result.riders[0].activeAssignedTaskCount, p + d); assert.equal(result.riders[0].completedDeliveryCount, c);
  }
});
test('database predicates scope Riders, workload, search and grouped counts before pagination', async () => {
  const where = actual.riderWhere(provider, { search: 'One', workload: 'HAS_ASSIGNED_TASKS', eligible: 'true' });
  assert.equal(where.providerId, provider); assert.equal(where.role, 'RIDER'); assert.equal(where.AND.length, 2); assert.equal(where.OR.length, 3);
  assert.deepEqual(where.account, { is: { emailVerifiedAt: { not: null } } });
  const available = actual.riderWhere(provider, { workload: 'AVAILABLE' });
  assert.deepEqual(available.riderAssignments.none.order.status.in, ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']);
  const calls = [];
  await actual.counts({ riderAssignment: { groupBy: async args => { calls.push(args); return []; } } }, provider, [rider]);
  assert.equal(calls.length, 3);
  for (const call of calls) { assert.equal(call.where.rider.providerId, provider); assert.equal(call.where.order.deliveryProviderId, provider); assert.deepEqual(call.by, ['riderId']); }
  assert.deepEqual(calls[1].where.order.status.in, ['IN_TRANSIT', 'OUT_FOR_DELIVERY']);
  assert.deepEqual(calls[2].where.order.status.in, ['DELIVERED']);
});
test('invitation repository captures trusted provider and activation retains it', async () => {
  const original = prisma.$transaction; let captured, activated;
  const operatorAccount = { emailVerifiedAt: new Date(), profile: { role: 'OPERATOR', providerId: provider } };
  const tx = { account: { findUnique: async args => args.where.id ? operatorAccount : null, create: async args => { activated = args.data.profile.create; } },
    riderInvitation: { findUnique: async args => args.where.tokenHash ? { id: randomUUID(), providerId: provider, invitedById: operator, email: 'rider@example.test', fullName: 'One' } : null,
      create: async args => { captured = args.data; return { id: randomUUID() }; }, updateMany: async () => ({ count: 1 }) } };
  prisma.$transaction = async work => work(tx);
  try {
    assert.equal((await invitationRepo.reserveInvitation({ email: 'rider@example.test', invitedById: operator, tokenHash: 'hash', expiresAt: new Date() })).status, 'created');
    assert.equal(captured.providerId, provider);
    operatorAccount.profile.providerId = foreign;
    assert.equal(await invitationRepo.activateInvitation('hash', 'fictional-hash'), 'activated');
    assert.equal(activated.providerId, provider); assert.equal(activated.role, 'RIDER');
    operatorAccount.profile.providerId = null;
    assert.equal((await invitationRepo.reserveInvitation({ email: 'other@example.test', invitedById: operator, tokenHash: 'hash', expiresAt: new Date() })).status, 'membership_required');
  } finally { prisma.$transaction = original; }
});
test('legacy invitation activation resolves only a verified trusted inviter membership', async () => {
  const original = prisma.$transaction; let member = provider, consumed = false, created;
  const tx = { account: { findUnique: async () => ({ emailVerifiedAt: new Date(), profile: { role: 'OPERATOR', providerId: member } }), create: async args => { created = args.data.profile.create; } },
    riderInvitation: { findUnique: async () => ({ id: randomUUID(), providerId: null, invitedById: operator, email: 'legacy@example.test', fullName: null }), updateMany: async args => { consumed = true; assert.equal(args.data.providerId, provider); return { count: 1 }; } } };
  prisma.$transaction = async work => work(tx);
  try {
    assert.equal(await invitationRepo.activateInvitation('hash', 'test-only-hash'), 'activated'); assert.equal(created.providerId, provider);
    member = null; consumed = false;
    assert.equal(await invitationRepo.activateInvitation('hash', 'test-only-hash'), 'invalid'); assert.equal(consumed, false);
  } finally { prisma.$transaction = original; }
});
test('Swagger documents all management routes and read-only workload semantics', () => {
  const { openApiDocument: spec } = require('../dist/config/swagger');
  for (const path of ['/api/operator/riders', '/api/operator/riders/overview', '/api/operator/riders/invitations', '/api/operator/riders/{riderId}']) assert.deepEqual(spec.paths[path].get.security, [{ bearerAuth: [] }]);
  assert.match(spec.components.schemas.ManagedRider.properties.workload.description, /never online/);
});
