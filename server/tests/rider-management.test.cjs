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
let configured = true, pending = 0, progress = 0, completed = 0, activeAssignments = 0, revokedSessions = 0;
const person = () => ({ id: rider, fullName: 'Rider One', phone: '09123456789', providerId: provider, deactivatedAt: null,
  provider: { id: provider, name: 'One' }, account: { email: 'rider@example.test', emailVerifiedAt: new Date() },
  riderProfile: { vehicleType: 'MOTORCYCLE', vehiclePlateNumber: 'ABC-123', vehicleModel: null, vehicleColor: null, completedAt: new Date('2026-10-22T00:00:00Z') } });
let riderRecord = person();
repo.transaction = async work => work({});
repo.mutationTransaction = async work => work({});
repo.operator = async (_tx, id) => { assert.equal(id, operator); return { role: 'OPERATOR', providerId: configured ? provider : null }; };
repo.list = async (_tx, id) => { assert.equal(id, provider); return { rows: [person()], total: 1 }; };
repo.findRider = async (_tx, scope, id) => scope === provider && id === rider ? riderRecord : null;
repo.counts = async () => [pending, progress, completed].map(value => value ? [{ riderId: rider, _count: { _all: value } }] : []);
repo.overview = async () => ({ totalRiders: 1, available: 1, assigned: 0, delivering: 0, inactive: 0 });
repo.assignments = async () => ({ rows: [], total: 0 });
repo.invitations = async () => ({ rows: [{ id: randomUUID(), email: 'pending@example.test', fullName: null, createdAt: new Date(), expiresAt: new Date() }], total: 1 });
repo.updateRider = async (_tx, _provider, id, identity, vehicle, completedAt) => {
  if (id !== rider) return null;
  riderRecord = { ...riderRecord, ...identity, riderProfile: { ...vehicle, completedAt } };
  return riderRecord;
};
repo.countActiveAssignments = async () => activeAssignments;
repo.lockRiderAccount = async () => [];
repo.setDeactivatedAt = async (_tx, _provider, id, deactivatedAt) => {
  if (id !== rider) return { count: 0 };
  riderRecord = { ...riderRecord, deactivatedAt };
  return { count: 1 };
};
repo.revokeRiderSessions = async () => { revokedSessions += 1; return { count: 1 }; };
auth.authenticate = async role => ({ id: operator, role });
const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
async function call(path, role = 'OPERATOR', options = {}) {
  const headers = {};
  if (role) headers.Authorization = `Bearer ${role}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  return { status: response.status, data: await response.json() };
}
function resetRider() { riderRecord = person(); activeAssignments = 0; revokedSessions = 0; }
test('management reads enforce roles, missing membership and strict filters', async () => {
  for (const path of ['/api/operator/riders', '/api/operator/riders/overview', '/api/operator/riders/invitations', `/api/operator/riders/${rider}`]) {
    assert.equal((await call(path, null)).status, 401);
    for (const role of ['SME', 'RIDER']) assert.equal((await call(path, role)).status, 403);
  }
  configured = false; assert.equal((await call('/api/operator/riders')).data.error.code, 'PROVIDER_MEMBERSHIP_REQUIRED'); configured = true;
  for (const query of ['providerId=' + foreign, 'workload=ONLINE', 'status=DEACTIVATED', 'page=0', 'eligible=false']) assert.equal((await call('/api/operator/riders?' + query)).status, 400);
});
test('Rider list and details expose workload, vehicle, completion and safe provider identity', async () => {
  resetRider();
  const result = await call('/api/operator/riders'); assert.equal(result.status, 200);
  assert.equal(result.data.data.riders[0].providerId, provider); assert.equal(result.data.data.riders[0].accountStatus, 'ACTIVATED');
  assert.equal(result.data.data.riders[0].isActive, true); assert.equal(result.data.data.riders[0].profileComplete, true);
  assert.equal(result.data.data.riders[0].vehicle.plateNumber, 'ABC-123'); assert.equal(result.data.data.riders[0].account, undefined);
  assert.equal((await call(`/api/operator/riders/${foreign}`)).status, 404);
  const detail = await call(`/api/operator/riders/${rider}`); assert.equal(detail.data.data.rider.id, rider); assert.equal(detail.data.data.rider.deactivatedAt, null);
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
test('database predicates scope Riders, operational status, search and grouped counts before pagination', async () => {
  const where = actual.riderWhere(provider, { search: 'One', workload: 'HAS_ASSIGNED_TASKS', eligible: 'true' });
  assert.equal(where.providerId, provider); assert.equal(where.role, 'RIDER'); assert.equal(where.AND.length, 2); assert.equal(where.OR.length, 3);
  assert.equal(where.deactivatedAt, null);
  assert.deepEqual(where.account, { is: { emailVerifiedAt: { not: null } } });
  const available = actual.riderWhere(provider, { workload: 'AVAILABLE' });
  assert.equal(available.deactivatedAt, null);
  assert.deepEqual(available.riderAssignments.none.order.status.in, ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']);
  const inactive = actual.riderWhere(provider, { status: 'INACTIVE' });
  assert.deepEqual(inactive.deactivatedAt, { not: null });
  const active = actual.riderWhere(provider, { status: 'ACTIVE', workload: 'DELIVERING' });
  assert.equal(active.deactivatedAt, null);
  const calls = [];
  await actual.counts({ riderAssignment: { groupBy: async args => { calls.push(args); return []; } } }, provider, [rider]);
  assert.equal(calls.length, 3);
  for (const call of calls) { assert.equal(call.where.rider.providerId, provider); assert.equal(call.where.order.deliveryProviderId, provider); assert.deepEqual(call.by, ['riderId']); }
  assert.deepEqual(calls[1].where.order.status.in, ['IN_TRANSIT', 'OUT_FOR_DELIVERY']);
  assert.deepEqual(calls[2].where.order.status.in, ['DELIVERED']);
});
test('Operator mutations enforce roles and reject protected fields', async () => {
  for (const path of [`/api/operator/riders/${rider}`, `/api/operator/riders/${rider}/deactivate`, `/api/operator/riders/${rider}/reactivate`]) {
    assert.equal((await call(path, null, { method: 'PATCH', body: {} })).status, 401);
    for (const role of ['SME', 'RIDER']) assert.equal((await call(path, role, { method: 'PATCH', body: {} })).status, 403);
  }
  for (const protectedField of ['role', 'providerId', 'email', 'password', 'emailVerifiedAt', 'riderId', 'id']) {
    const body = { fullName: 'Rider One', phone: '09123456789', vehicleType: 'MOTORCYCLE', vehiclePlateNumber: 'ABC-123', [protectedField]: 'forbidden' };
    assert.equal((await call(`/api/operator/riders/${rider}`, 'OPERATOR', { method: 'PATCH', body })).status, 400);
  }
});
test('Operator edit validates motor-vehicle plates, persists allowlisted fields and recalculates completion', async () => {
  resetRider();
  const noPlate = { fullName: 'Rider One', phone: '09123456789', vehicleType: 'CAR' };
  assert.equal((await call(`/api/operator/riders/${rider}`, 'OPERATOR', { method: 'PATCH', body: noPlate })).status, 400);
  assert.equal(riderRecord.fullName, 'Rider One');
  const bicycle = await call(`/api/operator/riders/${rider}`, 'OPERATOR', { method: 'PATCH', body: { fullName: 'Rider Updated', phone: '09987654321', vehicleType: 'BICYCLE', vehicleModel: 'City', vehicleColor: 'Blue' } });
  assert.equal(bicycle.status, 200);
  assert.equal(bicycle.data.data.rider.fullName, 'Rider Updated'); assert.equal(bicycle.data.data.rider.phone, '09987654321');
  assert.equal(bicycle.data.data.rider.vehicle.type, 'BICYCLE'); assert.equal(bicycle.data.data.rider.vehicle.plateNumber, null);
  assert.equal(bicycle.data.data.rider.profileComplete, true); assert.equal(bicycle.data.data.rider.completedAt, '2026-10-22T00:00:00.000Z');
  assert.equal(riderRecord.fullName, 'Rider Updated'); assert.equal(riderRecord.riderProfile.vehicleType, 'BICYCLE');
  const motor = await call(`/api/operator/riders/${rider}`, 'OPERATOR', { method: 'PATCH', body: { fullName: 'Rider Updated', phone: '09987654321', vehicleType: 'VAN', vehiclePlateNumber: '  abc 123 ' } });
  assert.equal(motor.status, 200); assert.equal(motor.data.data.rider.vehicle.plateNumber, 'ABC 123');
});
test('Operator cannot edit or change status for another provider', async () => {
  resetRider();
  const body = { fullName: 'Foreign', phone: '09123456789', vehicleType: 'BICYCLE' };
  assert.equal((await call(`/api/operator/riders/${foreign}`, 'OPERATOR', { method: 'PATCH', body })).status, 404);
  assert.equal((await call(`/api/operator/riders/${foreign}/deactivate`, 'OPERATOR', { method: 'PATCH', body: {} })).status, 404);
  assert.equal((await call(`/api/operator/riders/${foreign}/reactivate`, 'OPERATOR', { method: 'PATCH', body: {} })).status, 404);
});
test('deactivation is blocked by active assignments, then deactivation/reactivation are idempotent', async () => {
  resetRider(); activeAssignments = 2;
  const blocked = await call(`/api/operator/riders/${rider}/deactivate`, 'OPERATOR', { method: 'PATCH', body: {} });
  assert.equal(blocked.status, 409); assert.equal(blocked.data.error.code, 'RIDER_HAS_ACTIVE_ASSIGNMENTS');
  assert.match(blocked.data.error.message, /2 active assignments/); assert.equal(riderRecord.deactivatedAt, null); assert.equal(revokedSessions, 0);
  activeAssignments = 0;
  const deactivated = await call(`/api/operator/riders/${rider}/deactivate`, 'OPERATOR', { method: 'PATCH', body: {} });
  assert.equal(deactivated.status, 200); assert.equal(deactivated.data.data.rider.isActive, false); assert.ok(deactivated.data.data.rider.deactivatedAt);
  assert.equal(deactivated.data.data.rider.profileComplete, true); assert.equal(deactivated.data.data.rider.completedAt, '2026-10-22T00:00:00.000Z');
  assert.equal(revokedSessions, 1); const firstTimestamp = deactivated.data.data.rider.deactivatedAt;
  const repeated = await call(`/api/operator/riders/${rider}/deactivate`, 'OPERATOR', { method: 'PATCH', body: {} });
  assert.equal(repeated.status, 200); assert.equal(repeated.data.data.rider.deactivatedAt, firstTimestamp);
  const reactivated = await call(`/api/operator/riders/${rider}/reactivate`, 'OPERATOR', { method: 'PATCH', body: {} });
  assert.equal(reactivated.status, 200); assert.equal(reactivated.data.data.rider.isActive, true); assert.equal(reactivated.data.data.rider.deactivatedAt, null);
  assert.equal(reactivated.data.data.rider.profileComplete, true); assert.equal(reactivated.data.data.rider.completedAt, '2026-10-22T00:00:00.000Z');
  const repeatedReactivate = await call(`/api/operator/riders/${rider}/reactivate`, 'OPERATOR', { method: 'PATCH', body: {} });
  assert.equal(repeatedReactivate.status, 200); assert.equal(repeatedReactivate.data.data.rider.isActive, true);
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
test('Swagger documents management reads and live edit/deactivate/reactivate actions', () => {
  const { openApiDocument: spec } = require('../dist/config/swagger');
  for (const path of ['/api/operator/riders', '/api/operator/riders/overview', '/api/operator/riders/invitations', '/api/operator/riders/{riderId}']) assert.deepEqual(spec.paths[path].get.security, [{ bearerAuth: [] }]);
  assert.match(spec.components.schemas.ManagedRider.properties.workload.description, /never online/);
  for (const path of ['/api/operator/riders/{riderId}', '/api/operator/riders/{riderId}/deactivate', '/api/operator/riders/{riderId}/reactivate']) assert.deepEqual(spec.paths[path].patch.security, [{ bearerAuth: [] }]);
  assert.equal(spec.components.schemas.ManagedRider.properties.isActive.type, 'boolean');
  assert.ok(spec.components.schemas.RiderWorkloadOverview.required.includes('inactive'));
});
