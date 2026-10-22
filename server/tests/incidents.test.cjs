// HTTP/controller/service/repository behavior with an in-memory transaction double.
// These tests do NOT prove PostgreSQL constraints, indexes or migration behavior.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { prisma } = require('../dist/config/prisma');
const auth = require('../dist/modules/auth/auth.repository');
const ids = {
  rider: randomUUID(), otherRider: randomUUID(), operator: randomUUID(), otherOperator: randomUUID(),
  sme: randomUUID(), provider: randomUUID(), otherProvider: randomUUID(), order: randomUUID(), assignment: randomUUID(),
};
const tokens = { RIDER: 'R'.repeat(43), OTHER_RIDER: 'Q'.repeat(43), OPERATOR: 'O'.repeat(43), OTHER_OPERATOR: 'P'.repeat(43), SME: 'S'.repeat(43) };
const idByToken = { RIDER: ids.rider, OTHER_RIDER: ids.otherRider, OPERATOR: ids.operator, OTHER_OPERATOR: ids.otherOperator, SME: ids.sme };
const roleByToken = { RIDER: 'RIDER', OTHER_RIDER: 'RIDER', OPERATOR: 'OPERATOR', OTHER_OPERATOR: 'OPERATOR', SME: 'SME' };
auth.findSession = async hash => {
  const key = Object.keys(tokens).find(key => createHash('sha256').update(tokens[key]).digest('hex') === hash);
  if (!key) return null;
  return { accessExpiresAt: new Date(Date.now() + 60000), account: {
    id: idByToken[key], emailVerifiedAt: new Date(), email: 'test@example.invalid', profile: { role: roleByToken[key] },
  } };
};

let state, calls, transactionOptions;
function fresh() {
  return {
    assignments: {
      [ids.assignment]: { id: ids.assignment, orderId: ids.order, riderId: ids.rider, order: { id: ids.order, deliveryProviderId: ids.provider } },
    },
    profiles: {
      [ids.rider]: { role: 'RIDER', providerId: ids.provider },
      [ids.otherRider]: { role: 'RIDER', providerId: ids.provider },
      [ids.operator]: { role: 'OPERATOR', providerId: ids.provider },
      [ids.otherOperator]: { role: 'OPERATOR', providerId: ids.otherProvider },
    },
    incidents: [], failUnique: false, txError: undefined,
  };
}
function matchIncident(row, where) {
  if (!where) return true;
  if (where.id && row.id !== where.id) return false;
  if (where.riderId && row.riderId !== where.riderId) return false;
  if (where.providerId && row.providerId !== where.providerId) return false;
  if (where.orderId && row.orderId !== where.orderId) return false;
  if (where.type && row.type !== where.type) return false;
  if (where.status && row.status !== where.status) return false;
  return true;
}
function incidentRow(data) {
  return {
    id: randomUUID(), orderId: data.orderId, riderId: data.riderId, assignmentId: data.assignmentId ?? null,
    providerId: data.providerId, type: data.type, reason: data.reason, description: data.description,
    status: 'OPEN', reviewedAt: null, reviewedById: null, createdAt: new Date(), updatedAt: new Date(),
    rider: { id: data.riderId, fullName: 'Fictional Rider', phone: null },
    reviewedBy: null,
    order: { id: data.orderId, orderCode: 'PODEAD000000000001', recipientName: 'Fictional Recipient', township: 'Tamwe', deliveryAddress: 'Fictional address', status: 'IN_TRANSIT', deliveryProviderId: data.providerId },
  };
}
function txClient(db) {
  return {
    profile: { findUnique: async args => db.profiles[args.where.id] ?? null },
    riderAssignment: { findFirst: async args => {
      calls.push(args);
      const assignment = db.assignments[args.where.id];
      return assignment && assignment.riderId === args.where.riderId ? { id: assignment.id, orderId: assignment.orderId, order: assignment.order } : null;
    } },
    riderIncident: {
      findUnique: async args => db.incidents.find(row => matchIncident(row, { orderId: args.where.orderId_type.orderId, type: args.where.orderId_type.type })) ?? null,
      create: async args => {
        calls.push(args);
        if (db.failUnique) throw Object.assign(new Error('unique'), { code: 'P2002' });
        const row = incidentRow(args.data);
        db.incidents.push(row);
        return row;
      },
      findMany: async args => db.incidents.filter(row => matchIncident(row, args.where)).slice(args.skip, args.skip + args.take),
      count: async args => db.incidents.filter(row => matchIncident(row, args.where)).length,
      findFirst: async args => db.incidents.find(row => matchIncident(row, args.where)) ?? null,
      updateMany: async args => {
        calls.push(args);
        const rows = db.incidents.filter(row => matchIncident(row, args.where));
        for (const row of rows) {
          Object.assign(row, args.data);
          if (args.data.reviewedById) row.reviewedBy = { id: args.data.reviewedById, fullName: 'Fictional Operator', phone: null };
        }
        return { count: rows.length };
      },
    },
  };
}
prisma.$transaction = async (work, options) => {
  transactionOptions.push(options);
  if (Array.isArray(work)) return Promise.all(work);
  if (state.txError) throw Object.assign(new Error('transaction conflict'), { code: state.txError });
  return work(txClient(state));
};
prisma.riderIncident.findMany = async args => state.incidents.filter(row => matchIncident(row, args.where)).slice(args.skip, args.skip + args.take);
prisma.riderIncident.count = async args => state.incidents.filter(row => matchIncident(row, args.where)).length;
prisma.riderIncident.findFirst = async args => state.incidents.find(row => matchIncident(row, args.where)) ?? null;
// Completion guard reads persisted Rider identity/vehicle/provider data.
const completeRider = id => ({ id, role: 'RIDER', fullName: 'Fictional Rider', phone: 'TEST-NOT-DIALABLE',
  providerId: ids.provider, provider: { id: ids.provider, name: 'Fictional Provider' },
  account: { email: `${id}@example.invalid`, emailVerifiedAt: new Date() },
  riderProfile: { vehicleType: 'MOTORCYCLE', vehiclePlateNumber: 'ABC-123', vehicleModel: null, vehicleColor: null, completedAt: new Date() } });
prisma.profile.findUnique = async args => (args.where.id === ids.rider || args.where.id === ids.otherRider ? completeRider(args.where.id) : null);
beforeEach(() => { state = fresh(); calls = []; transactionOptions = []; });
const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
async function request(path, role = 'RIDER', method = 'GET', body) {
  const result = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: result.status, body: await result.json(), cache: result.headers.get('cache-control') };
}
const create = (body = { assignmentId: ids.assignment, type: 'DAMAGED', reason: 'Parcel arrived crushed', description: 'Outer carton torn.' }, role = 'RIDER') => request('/api/rider/incidents', role, 'POST', body);

test('incident endpoints require authentication and the correct role before database access', async () => {
  const endpoints = [['/api/rider/incidents', 'POST'], ['/api/rider/incidents', 'GET'], [`/api/rider/incidents/${ids.assignment}`, 'GET'], ['/api/operator/incidents', 'GET'], [`/api/operator/incidents/${ids.assignment}`, 'GET'], [`/api/operator/incidents/${ids.assignment}/review`, 'PATCH']];
  for (const [path, method] of endpoints) {
    assert.equal((await request(path, 'NONE', method, method === 'GET' ? undefined : {})).status, 401);
    const denied = path.includes('/operator/') ? ['SME', 'RIDER'] : ['SME', 'OPERATOR'];
    for (const role of denied) assert.equal((await request(path, role, method, method === 'GET' ? undefined : {})).status, 403);
  }
  assert.equal(calls.length, 0);
});

test('the assigned Rider can report an incident linked to the correct order and provider without changing status', async () => {
  const result = await create();
  assert.equal(result.status, 201);
  assert.equal(result.cache, 'no-store');
  assert.equal(result.body.data.riderId, ids.rider);
  assert.equal(result.body.data.orderId, ids.order);
  assert.equal(result.body.data.providerId, ids.provider);
  assert.equal(result.body.data.type, 'DAMAGED');
  assert.equal(result.body.data.status, 'OPEN');
  assert.equal(result.body.data.reviewedAt, null);
  assert.equal(state.incidents.length, 1);
  assert.equal(state.incidents[0].status, 'OPEN');
  assert.equal(state.incidents[0].description, 'Outer carton torn.');
  assert.equal(transactionOptions[0].isolationLevel, 'Serializable');
});

test('only the assigned Rider may report and identity/ownership injection is rejected', async () => {
  assert.equal((await create(undefined, 'OTHER_RIDER')).status, 404);
  assert.equal((await create(undefined, 'OTHER_RIDER')).body.error.code, 'ASSIGNMENT_NOT_FOUND');
  for (const extra of [{ orderId: ids.order }, { riderId: ids.otherRider }, { providerId: ids.otherProvider }, { status: 'REVIEWED' }, { reviewedById: ids.operator }]) {
    assert.equal((await create({ assignmentId: ids.assignment, type: 'BROKEN', reason: 'Smashed', description: 'Glass broken.', ...extra })).status, 400, JSON.stringify(extra));
  }
  assert.equal(state.incidents.length, 0);
});

test('duplicate reports of the same type are rejected while a different type is allowed', async () => {
  assert.equal((await create()).status, 201);
  assert.equal((await create()).status, 409);
  assert.equal((await create()).body.error.code, 'INCIDENT_ALREADY_REPORTED');
  const other = await create({ assignmentId: ids.assignment, type: 'LOST', reason: 'Parcel missing', description: 'Could not locate the parcel.' });
  assert.equal(other.status, 201);
  assert.equal(state.incidents.length, 2);
  const race = await create({ assignmentId: ids.assignment, type: 'BROKEN', reason: 'Smashed', description: 'Glass broken.' });
  assert.equal(race.status, 201);
  state.failUnique = true;
  assert.equal((await create({ assignmentId: ids.assignment, type: 'DAMAGED', reason: 'Crushed', description: 'Crushed again.' })).body.error.code, 'INCIDENT_ALREADY_REPORTED');
});

test('payload validation rejects malformed types, blank text, overlong text and unknown fields', async () => {
  for (const body of [
    { assignmentId: ids.assignment, type: 'WET', reason: 'Wet parcel', description: 'Rain damage.' },
    { assignmentId: 'bad', type: 'DAMAGED', reason: 'Crushed', description: 'Crushed.' },
    { assignmentId: ids.assignment, type: 'DAMAGED', reason: 'ab', description: 'Crushed.' },
    { assignmentId: ids.assignment, type: 'DAMAGED', reason: '   ', description: 'Crushed.' },
    { assignmentId: ids.assignment, type: 'DAMAGED', reason: 'Crushed', description: '   ' },
    { assignmentId: ids.assignment, type: 'DAMAGED', reason: 'x'.repeat(201), description: 'Crushed.' },
    { assignmentId: ids.assignment, type: 'DAMAGED', reason: 'Crushed', description: 'x'.repeat(1001) },
  ]) assert.equal((await create(body)).status, 400);
  assert.equal(state.incidents.length, 0);
});

test('a Rider can list and view only their own incidents', async () => {
  await create();
  const list = await request('/api/rider/incidents', 'RIDER');
  assert.equal(list.status, 200);
  assert.equal(list.body.data.incidents.length, 1);
  assert.equal(list.body.data.pagination.total, 1);
  const incidentId = list.body.data.incidents[0].id;
  assert.equal((await request(`/api/rider/incidents/${incidentId}`, 'RIDER')).status, 200);
  const otherList = await request('/api/rider/incidents', 'OTHER_RIDER');
  assert.deepEqual(otherList.body.data.incidents, []);
  assert.equal(otherList.body.data.pagination.total, 0);
  assert.equal((await request(`/api/rider/incidents/${incidentId}`, 'OTHER_RIDER')).status, 404);
  assert.doesNotMatch(JSON.stringify(list.body), /password|token|access_hash|refresh_hash/i);
});

test('the owning-provider Operator can see and review an incident, and review is idempotent', async () => {
  const created = await create();
  const incidentId = created.body.data.id;
  const list = await request('/api/operator/incidents', 'OPERATOR');
  assert.equal(list.status, 200);
  assert.equal(list.body.data.incidents.length, 1);
  const detail = await request(`/api/operator/incidents/${incidentId}`, 'OPERATOR');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.type, 'DAMAGED');
  assert.equal(detail.body.data.rider.id, ids.rider);
  const review = await request(`/api/operator/incidents/${incidentId}/review`, 'OPERATOR', 'PATCH', { status: 'REVIEWED' });
  assert.equal(review.status, 200);
  assert.equal(review.body.data.status, 'REVIEWED');
  assert.equal(review.body.data.reviewedById, ids.operator);
  assert.ok(review.body.data.reviewedAt);
  const again = await request(`/api/operator/incidents/${incidentId}/review`, 'OPERATOR', 'PATCH', { status: 'REVIEWED' });
  assert.equal(again.status, 200);
  assert.equal(again.body.data.status, 'REVIEWED');
  assert.equal(state.incidents.filter(row => row.status === 'REVIEWED').length, 1);
});

test('another provider Operator cannot see, open or review an incident', async () => {
  const created = await create();
  const incidentId = created.body.data.id;
  const list = await request('/api/operator/incidents', 'OTHER_OPERATOR');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data.incidents, []);
  assert.equal((await request(`/api/operator/incidents/${incidentId}`, 'OTHER_OPERATOR')).status, 404);
  assert.equal((await request(`/api/operator/incidents/${incidentId}/review`, 'OTHER_OPERATOR', 'PATCH', { status: 'REVIEWED' })).status, 404);
  assert.equal(state.incidents[0].status, 'OPEN');
});

test('operators without provider membership cannot list incidents', async () => {
  state.profiles[ids.operator].providerId = null;
  const result = await request('/api/operator/incidents', 'OPERATOR');
  assert.equal(result.status, 409);
  assert.equal(result.body.error.code, 'PROVIDER_MEMBERSHIP_REQUIRED');
});

test('incomplete Riders cannot report and review rejects untrusted status values', async () => {
  prisma.profile.findUnique = async args => ({ ...completeRider(args.where.id), fullName: null });
  const blocked = await create();
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, 'RIDER_PROFILE_INCOMPLETE');
  prisma.profile.findUnique = async args => completeRider(args.where.id);
  for (const body of [{ status: 'OPEN' }, { status: 'RESOLVED' }, { status: 'REVIEWED', reviewedById: ids.otherOperator }, {}]) {
    assert.equal((await request('/api/operator/incidents/' + ids.assignment + '/review', 'OPERATOR', 'PATCH', body)).status, 400);
  }
});

test('hasIncident is derived from incident records rather than stored on the order', async () => {
  const { serializeOperatorOrder } = require('../dist/modules/operator/operator.service');
  const { Prisma } = require('../dist/generated/prisma/client');
  const base = { parcelWeightKg: new Prisma.Decimal('1'), codAmount: new Prisma.Decimal('25000.50') };
  assert.equal(serializeOperatorOrder({ ...base, incidents: [] }).hasIncident, false);
  assert.equal(serializeOperatorOrder({ ...base, incidents: [{ id: randomUUID() }] }).hasIncident, true);
  assert.equal(serializeOperatorOrder({ ...base }).hasIncident, false);
});

test('services enforce roles even outside Express', async () => {
  const service = require('../dist/modules/incidents/incident.service');
  const query = { page: 1, pageSize: 20 };
  const actor = { id: ids.sme, role: 'SME' };
  for (const work of [
    () => service.createIncident(actor, { assignmentId: ids.assignment, type: 'DAMAGED', reason: 'Crushed', description: 'Crushed.' }),
    () => service.riderIncidents(actor, query), () => service.riderIncident(actor, ids.assignment),
    () => service.operatorIncidents(actor, query), () => service.operatorIncident(actor, ids.assignment),
    () => service.reviewIncident(actor, ids.assignment, 'REVIEWED'),
  ]) await assert.rejects(work, error => error.status === 403);
  assert.equal(calls.length, 0);
});
