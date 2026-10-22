// Real HTTP/controllers/services/repository callbacks with an in-memory transaction double.
// These tests do NOT prove PostgreSQL isolation, locking or database constraint behavior.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { prisma } = require('../dist/config/prisma');
const { Prisma } = require('../dist/generated/prisma/client');
const auth = require('../dist/modules/auth/auth.repository');
const service = require('../dist/modules/assignments/assignment.service');
const { deliveryStatusSchema } = require('../dist/modules/assignments/assignment.validation');
const ids = { order: randomUUID(), rider: randomUUID(), other: randomUUID(), operator: randomUUID(), sme: randomUUID(), assignment: randomUUID() };
const tokens = { OPERATOR: 'O'.repeat(43), RIDER: 'R'.repeat(43), OTHER: 'Q'.repeat(43), SME: 'S'.repeat(43) };
auth.findSession = async hash => {
  const key = Object.keys(tokens).find(key => createHash('sha256').update(tokens[key]).digest('hex') === hash);
  if (!key) return null;
  return { accessExpiresAt: new Date(Date.now() + 60000), account: { id: ids[{ OPERATOR: 'operator', RIDER: 'rider', OTHER: 'other', SME: 'sme' }[key]], emailVerifiedAt: new Date(), email: 'test@example.invalid', profile: { role: key === 'OTHER' ? 'RIDER' : key } } };
};
let state, queue, failEvent, failRead, failConditional, txError, uniqueError, transactionOptions, calls;
const person = id => ({ id, fullName: 'Fictional Test', phone: null });
ids.provider = randomUUID();
function fresh() { return { providerId: ids.provider, riderProvider: ids.provider, order: { id: ids.order, deliveryProviderId: ids.provider, status: 'PICKED_UP', ownerRole: 'SME' }, assignment: null, extraStatuses: [], events: [], eligible: true }; }
function assignmentRow(db, detail = false) {
  if (!db.assignment) return null;
  const order = { id: ids.order, deliveryProviderId: db.order.deliveryProviderId, destinationCity: 'Yangon', deliveryFee: new Prisma.Decimal('1500.00'),
    deliveryProvider: { id: db.order.deliveryProviderId, name: 'Fictional Provider' }, orderCode: 'PODEAD000000000001', recipientName: 'Fictional Recipient', phoneNumber: 'TEST-NOT-DIALABLE',
    township: 'Tamwe', deliveryAddress: 'Fictional address', deliveryInstructions: null, parcelWeightKg: new Prisma.Decimal('1.250'),
    codAmount: new Prisma.Decimal('25000.50'), currency: 'MMK', status: db.order.status };
  if (detail) order.statusEvents = db.events.map(event => ({ ...event, actor: { id: event.actorId, fullName: 'Fictional Rider' } }));
  return { ...db.assignment, rider: person(db.assignment.riderId), assignedBy: person(ids.operator), order };
}
function client(db) {
  return {
    profile: {
      findUnique: async () => ({ role: 'OPERATOR', providerId: db.providerId }),
      findMany: args => prisma.profile.findMany(args), count: args => prisma.profile.count(args),
      findFirst: async args => { calls.push(args); return args.where.id === ids.rider && args.where.providerId === db.riderProvider && db.eligible ? person(ids.rider) : null; },
    },
    parcelOrder: {
      findFirst: async args => {
        calls.push(args);
        return args.where.id === ids.order && args.where.deliveryProviderId === db.order.deliveryProviderId && db.order.ownerRole === 'SME' ? { id: ids.order, status: db.order.status, assignment: db.assignment && { id: db.assignment.id } } : null;
      },
      updateMany: async args => {
        calls.push(args);
        if (failConditional) return { count: 0 };
        const assignment = args.where.assignment.is;
        if (db.order.id !== args.where.id || db.order.status !== args.where.status || db.assignment?.id !== assignment.id || db.assignment?.riderId !== assignment.riderId) return { count: 0 };
        db.order.status = args.data.status; return { count: 1 };
      },
    },
    riderAssignment: {
      findMany: args => prisma.riderAssignment.findMany(args), count: args => prisma.riderAssignment.count(args),
      create: async args => {
        calls.push(args);
        if (uniqueError || db.assignment) throw Object.assign(new Error('unique'), { code: 'P2002' });
        db.assignment = { id: ids.assignment, ...args.data, assignedAt: new Date() };
        return assignmentRow(db);
      },
      findFirst: async args => {
        calls.push(args);
        if (failRead && db.events.length) return null;
        return db.assignment?.id === args.where.id && db.assignment?.riderId === args.where.riderId ? assignmentRow(db, true) : null;
      },
    },
    orderStatusEvent: { create: async ({ data }) => {
      if (failEvent) throw new Error('private history failure');
      const event = { ...data, id: randomUUID(), createdAt: new Date() }; db.events.push(event); return event;
    } },
  };
}
prisma.$transaction = async (work, options) => {
  transactionOptions.push(options);
  if (Array.isArray(work)) return Promise.all(work);
  const prior = queue; let unlock; queue = new Promise(resolve => { unlock = resolve; }); await prior;
  try {
    if (txError) throw Object.assign(new Error('transaction conflict'), { code: txError });
    const draft = { ...state, order: { ...state.order }, assignment: state.assignment && { ...state.assignment }, events: [...state.events] };
    const result = await work(client(draft)); state = draft; return result;
  } finally { unlock(); }
};
prisma.riderAssignment.findFirst = async args => client(state).riderAssignment.findFirst(args);
function riderRows() {
  if (!state.assignment) return [];
  const base = assignmentRow(state);
  return [base, ...state.extraStatuses.map(status => ({
    ...base,
    id: randomUUID(),
    order: { ...base.order, id: randomUUID(), status },
  }))];
}
function filteredRiderRows(args) {
  const statuses = args.where?.order?.status?.in;
  return riderRows().filter(row => row.riderId === args.where.riderId && (!statuses || statuses.includes(row.order.status)));
}
prisma.riderAssignment.findMany = async args => {
  calls.push(args);
  const rows = filteredRiderRows(args);
  return rows.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? rows.length));
};
prisma.riderAssignment.count = async args => filteredRiderRows(args).length;
prisma.parcelOrder.groupBy = async args => {
  calls.push(args);
  const riderId = args.where?.assignment?.is?.riderId;
  const counts = new Map();
  for (const row of riderRows()) {
    if (riderId && row.riderId !== riderId) continue;
    counts.set(row.order.status, (counts.get(row.order.status) ?? 0) + 1);
  }
  return [...counts].map(([status, count]) => ({ status, _count: { _all: count } }));
};
prisma.profile.findMany = async args => { calls.push(args); return state.eligible ? [person(ids.rider)] : []; };
prisma.profile.count = async () => state.eligible ? 1 : 0;
// Completion guard reads persisted Rider identity/vehicle/provider data.
const completeRider = id => ({ id, role: 'RIDER', fullName: 'Fictional Rider', phone: 'TEST-NOT-DIALABLE',
  providerId: ids.provider, provider: { id: ids.provider, name: 'Fictional Provider' },
  account: { email: `${id}@example.invalid`, emailVerifiedAt: new Date() },
  riderProfile: { vehicleType: 'MOTORCYCLE', vehiclePlateNumber: 'ABC-123', vehicleModel: null, vehicleColor: null, completedAt: new Date() } });
prisma.profile.findUnique = async args => args.where.id === ids.rider || args.where.id === ids.other ? completeRider(args.where.id) : null;
beforeEach(() => {
  state = fresh(); queue = Promise.resolve(); failEvent = false; failRead = false; failConditional = false; txError = undefined; uniqueError = false; transactionOptions = []; calls = [];
});
const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
async function request(path, role = 'OPERATOR', method = 'GET', body) {
  const result = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: result.status, body: await result.json(), cache: result.headers.get('cache-control') };
}
const create = (body = { orderId: ids.order, riderId: ids.rider }, role = 'OPERATOR') => request('/api/operator/assignments', role, 'POST', body);
const assign = () => service.assignParcel({ id: ids.operator, role: 'OPERATOR' }, { orderId: ids.order, riderId: ids.rider });
const update = (status, note) => request(`/api/rider/assignments/${ids.assignment}/status`, 'RIDER', 'PATCH', { status, ...(note === undefined ? {} : { note }) });

test('all new endpoints require authentication and correct roles before database access', async () => {
  const endpoints = [['/api/operator/riders', 'GET'], ['/api/operator/assignments', 'GET'], ['/api/operator/assignments', 'POST'], ['/api/rider/assignments', 'GET'], [`/api/rider/assignments/${ids.assignment}`, 'GET'], [`/api/rider/assignments/${ids.assignment}/status`, 'PATCH']];
  for (const [path, method] of endpoints) {
    assert.equal((await request(path, 'NONE', method, method === 'GET' ? undefined : {})).status, 401);
    const denied = path.includes('/operator/') ? ['SME', 'RIDER'] : ['SME', 'OPERATOR'];
    for (const role of denied) assert.equal((await request(path, role, method, method === 'GET' ? undefined : {})).status, 403);
  }
  assert.equal((await request('/api/operator/orders', 'RIDER')).status, 403);
  assert.equal(calls.length, 0);
});
test('eligible riders use verified linked accounts and expose safe identity fields only', async () => {
  const data = await service.eligibleRiders({ id: ids.operator, role: 'OPERATOR' }, { page: 2, pageSize: 10 });
  assert.deepEqual(data.riders, [person(ids.rider)]);
  assert.deepEqual(calls[0].where, { role: 'RIDER', providerId: ids.provider, deactivatedAt: null, account: { is: { emailVerifiedAt: { not: null } } } });
  assert.equal(calls[0].skip, 10); assert.equal(calls[0].take, 10);
  assert.deepEqual(calls[0].select, { id: true, fullName: true, phone: true });
  state.eligible = false; assert.deepEqual((await service.eligibleRiders({ id: ids.operator, role: 'OPERATOR' }, { page: 1, pageSize: 20 })).riders, []);
});

test('assignment refuses another provider Rider or parcel and missing membership', async () => {
  state.riderProvider = randomUUID(); assert.equal((await create()).status, 404);
  state.riderProvider = ids.provider; state.order.deliveryProviderId = randomUUID(); assert.equal((await create()).status, 404);
  state.providerId = null; assert.equal((await create()).body.error.code, 'PROVIDER_MEMBERSHIP_REQUIRED');
});
test('strict request IDs and identity/role/status injection are rejected', async () => {
  for (const body of [{ orderId: 'bad', riderId: ids.rider }, { orderId: ids.order, riderId: 'bad' }, { orderId: ids.order, riderId: ids.rider, assignedById: ids.other }, { orderId: ids.order, riderId: ids.rider, role: 'OPERATOR' }, { orderId: ids.order, riderId: ids.rider, status: 'IN_TRANSIT' }]) assert.equal((await create(body)).status, 400);
  for (const path of ['/api/operator/assignments?page=0', '/api/operator/riders?pageSize=101', `/api/rider/assignments?riderId=${ids.other}`, '/api/rider/assignments/bad']) assert.equal((await request(path, path.includes('/operator/') ? 'OPERATOR' : 'RIDER')).status, 400);
  assert.equal(calls.length, 0);
});
test('only received SME parcels can be assigned', async () => {
  for (const status of ['CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED']) { state.order.status = status; assert.equal((await create()).status, 409); }
  state.order.status = 'PICKED_UP'; state.order.ownerRole = 'OPERATOR'; assert.equal((await create()).status, 404);
  assert.equal((await create({ orderId: randomUUID(), riderId: ids.rider })).status, 404);
});
test('wrong-role, missing and inactive/accountless riders are ineligible', async () => {
  for (const riderId of [ids.operator, ids.sme, randomUUID()]) assert.equal((await create({ orderId: ids.order, riderId })).status, 404);
  state.eligible = false; assert.equal((await create()).body.error.code, 'RIDER_NOT_ELIGIBLE');
  assert.equal(state.assignment, null);
  assert.equal(state.order.status, 'PICKED_UP'); assert.equal(state.events.length, 0);
});
test('missing Rider ID and unavailable Riders leave received parcels unassigned for later', async () => {
  assert.equal((await create({ orderId: ids.order })).status, 400);
  state.eligible = false;
  const result = await create(); assert.equal(result.status, 404); assert.equal(result.body.error.code, 'RIDER_NOT_ELIGIBLE');
  assert.equal(state.assignment, null); assert.equal(state.order.status, 'PICKED_UP'); assert.equal(state.events.length, 0);
  const { deriveWarehouseState } = require('../dist/modules/operator/warehouse/warehouse.state');
  assert.equal(deriveWarehouseState(state.order.status, !!state.assignment), 'UNASSIGNED');
  assert.equal(calls.some(call => call.data?.assignedById), false);
  state.eligible = true; assert.equal((await create()).status, 201);
});
test('assignment is atomic, uses authenticated operator and never changes order status/history', async () => {
  const result = await create(); assert.equal(result.status, 201);
  assert.equal(result.body.data.assignedById, ids.operator); assert.equal(result.body.data.order.status, 'PICKED_UP');
  assert.equal(result.body.data.order.codAmount, '25000.5');
  assert.equal(result.body.data.order.hasIncident, false);
  assert.equal(state.order.status, 'PICKED_UP'); assert.equal(state.events.length, 0);
  assert.equal(transactionOptions[0].isolationLevel, 'Serializable');
  assert.equal((await create()).status, 409);
});
test('concurrent assignment calls have a single winner in the transaction double', async () => {
  const results = await Promise.allSettled([assign(), assign()]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
});
test('database unique, FK race and serialization errors map to stable 409', async () => {
  uniqueError = true; assert.equal((await create()).body.error.code, 'ASSIGNMENT_CONFLICT'); uniqueError = false;
  for (const code of ['P2034', 'P2003']) { txError = code; assert.equal((await create()).status, 409); }
});
test('operator list paginates and rider list scopes to authenticated identity', async () => {
  await assign(); const operator = await request('/api/operator/assignments?page=2&pageSize=10');
  assert.equal(operator.status, 200); assert.equal(operator.body.data.pagination.page, 2);
  const own = await request('/api/rider/assignments', 'RIDER'); assert.equal(own.body.data.assignments.length, 1);
  const other = await request('/api/rider/assignments', 'OTHER'); assert.deepEqual(other.body.data.assignments, []);
  assert.equal(other.body.data.pagination.total, 0);
  assert.ok(calls.some(call => call.where?.riderId === ids.rider));
  assert.doesNotMatch(JSON.stringify(own.body), /password|token|email|sessions/);
});
test('rider tabs filter with full-dataset counts independent of group, status and pagination', async () => {
  await assign();
  state.extraStatuses = ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED', 'CREATED'];
  const fullCounts = {
    active: { all: 3, PICKED_UP: 1, IN_TRANSIT: 1, OUT_FOR_DELIVERY: 1 },
    completed: { all: 3, DELIVERED: 1, FAILED: 1, CANCELLED: 1 },
  };
  const active = await request('/api/rider/assignments?group=active', 'RIDER');
  assert.equal(active.status, 200);
  assert.equal(active.body.data.assignments.length, 3);
  assert.ok(active.body.data.assignments.every(row => ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(row.order.status)));
  assert.deepEqual(active.body.data.counts, fullCounts);
  assert.equal(active.body.data.assignments[0].order.destinationCity, 'Yangon');
  assert.equal(active.body.data.assignments[0].order.parcelWeight, '1.25');
  assert.equal(active.body.data.assignments[0].order.parcelWeightUnit, 'kg');
  const completed = await request('/api/rider/assignments?group=completed&page=1&pageSize=2', 'RIDER');
  assert.equal(completed.body.data.assignments.length, 2);
  assert.equal(completed.body.data.pagination.total, 3);
  assert.equal(completed.body.data.pagination.totalPages, 2);
  assert.ok(completed.body.data.assignments.every(row => ['DELIVERED', 'FAILED', 'CANCELLED'].includes(row.order.status)));
  assert.deepEqual(completed.body.data.counts, fullCounts);
  const filtered = await request('/api/rider/assignments?group=active&status=IN_TRANSIT', 'RIDER');
  assert.equal(filtered.body.data.assignments.length, 1);
  assert.equal(filtered.body.data.assignments[0].order.status, 'IN_TRANSIT');
  assert.equal(filtered.body.data.pagination.total, 1);
  assert.deepEqual(filtered.body.data.counts, fullCounts);
  const statusOnly = await request('/api/rider/assignments?status=DELIVERED', 'RIDER');
  assert.equal(statusOnly.body.data.assignments.length, 1);
  assert.deepEqual(statusOnly.body.data.counts, fullCounts);
  const created = await request('/api/rider/assignments?status=CREATED', 'RIDER');
  assert.equal(created.body.data.assignments.length, 1);
  assert.deepEqual(created.body.data.counts, fullCounts);
  const other = await request('/api/rider/assignments?group=active', 'OTHER');
  assert.deepEqual(other.body.data.assignments, []);
  assert.deepEqual(other.body.data.counts, {
    active: { all: 0, PICKED_UP: 0, IN_TRANSIT: 0, OUT_FOR_DELIVERY: 0 },
    completed: { all: 0, DELIVERED: 0, FAILED: 0, CANCELLED: 0 },
  });
  const countCall = calls.find(call => call.by?.includes('status'));
  assert.deepEqual(countCall.where, { assignment: { is: { riderId: ids.rider } } });
  assert.equal(countCall.orderBy.status, 'asc');
});
test('rider group and status query validation rejects invalid combinations before database access', async () => {
  const before = calls.length;
  for (const query of [
    'group=active&status=DELIVERED',
    'group=completed&status=PICKED_UP',
    'group=active&status=CREATED',
    'group=unknown',
    'status=UNKNOWN',
    `group=active&status=IN_TRANSIT&riderId=${ids.other}`,
  ]) assert.equal((await request(`/api/rider/assignments?${query}`, 'RIDER')).status, 400, query);
  assert.equal(calls.length, before);
});
test('detail and status mutations hide missing/other-rider assignment existence', async () => {
  await assign();
  assert.equal((await request(`/api/rider/assignments/${ids.assignment}`, 'RIDER')).status, 200);
  for (const path of [`/api/rider/assignments/${ids.assignment}`, `/api/rider/assignments/${randomUUID()}`]) assert.equal((await request(path, 'OTHER')).status, 404);
  assert.equal((await request(`/api/rider/assignments/${ids.assignment}/status`, 'OTHER', 'PATCH', { status: 'IN_TRANSIT' })).status, 404);
  assert.equal(state.events.length, 0);
});
test('delivery progression and history use authenticated rider and server timestamp', async () => {
  await assign();
  for (const [beforeStatus, status] of [['PICKED_UP', 'IN_TRANSIT'], ['IN_TRANSIT', 'OUT_FOR_DELIVERY'], ['OUT_FOR_DELIVERY', 'DELIVERED']]) {
    const result = await update(status); assert.equal(result.status, 200); assert.equal(result.body.data.previousStatus, beforeStatus);
    assert.equal(result.body.data.order.status, status); assert.equal(result.body.data.order.statusEvents.at(-1).actor.id, ids.rider);
  }
  assert.equal(state.events.length, 3); assert.equal(state.events[0].actorId, ids.rider); assert.ok(state.events[0].createdAt);
  const write = calls.find(call => call.data?.status === 'IN_TRANSIT');
  assert.deepEqual(write.where, { id: ids.order, status: 'PICKED_UP', assignment: { is: { id: ids.assignment, riderId: ids.rider } } });
});
test('FAILED succeeds only with a trimmed meaningful note from active delivery states', async () => {
  await assign();
  for (const status of ['IN_TRANSIT', 'OUT_FOR_DELIVERY']) {
    state.order.status = status;
    for (const note of [undefined, '', '  ', 'ab', null, 'x'.repeat(1001)]) assert.equal((await update('FAILED', note)).status, 400);
    const result = await update('FAILED', '  Recipient unavailable  '); assert.equal(result.status, 200);
    assert.equal(state.events.at(-1).note, 'Recipient unavailable');
  }
});
test('every prohibited transition and terminal-state mutation is rejected', async () => {
  await assign();
  const allowed = { PICKED_UP: ['IN_TRANSIT'], IN_TRANSIT: ['OUT_FOR_DELIVERY', 'FAILED'], OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'] };
  for (const previous of ['CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED']) {
    for (const target of ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']) {
      if (allowed[previous]?.includes(target)) continue;
      state.order.status = previous; assert.equal((await update(target, 'Test reason')).status, 409, `${previous} -> ${target}`);
      assert.equal(state.order.status, previous);
    }
  }
  for (const status of ['CREATED', 'PICKED_UP', 'CANCELLED', 'ASSIGNED', 'unknown']) assert.equal((await update(status)).status, 400);
});
test('status request rejects trusted-field overrides', async () => {
  await assign();
  for (const extra of [{ actorId: ids.other }, { riderId: ids.other }, { createdAt: new Date().toISOString() }, { previousStatus: 'CREATED' }]) {
    assert.equal((await request(`/api/rider/assignments/${ids.assignment}/status`, 'RIDER', 'PATCH', { status: 'IN_TRANSIT', ...extra })).status, 400);
  }
});
test('history or response-read failure rolls back status in the transaction double', async () => {
  await assign(); failEvent = true; const failed = await update('IN_TRANSIT');
  assert.equal(failed.status, 500); assert.equal(state.order.status, 'PICKED_UP'); assert.equal(state.events.length, 0);
  assert.doesNotMatch(JSON.stringify(failed.body), /private history/);
  failEvent = false; failRead = true; assert.equal((await update('IN_TRANSIT')).status, 500);
  assert.equal(state.order.status, 'PICKED_UP'); assert.equal(state.events.length, 0);
});
test('concurrent identical status requests cannot both succeed in the double', async () => {
  await assign(); const results = await Promise.all([update('IN_TRANSIT'), update('IN_TRANSIT')]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]); assert.equal(state.events.length, 1);
  txError = 'P2034'; assert.equal((await update('OUT_FOR_DELIVERY')).status, 409);
});
test('conditional write conflict does not create history or change status', async () => {
  await assign(); failConditional = true;
  assert.equal((await update('IN_TRANSIT')).status, 409);
  assert.equal(state.order.status, 'PICKED_UP'); assert.equal(state.events.length, 0);
});
test('services enforce roles even outside Express', async () => {
  const actor = { id: ids.sme, role: 'SME' }, query = { page: 1, pageSize: 20 };
  for (const work of [() => service.assignParcel(actor, { orderId: ids.order, riderId: ids.rider }), () => service.eligibleRiders(actor, query), () => service.operatorAssignments(actor, query), () => service.riderAssignments(actor, query), () => service.riderAssignment(actor, ids.assignment), () => service.updateDeliveryStatus(actor, ids.assignment, { status: 'IN_TRANSIT' })]) await assert.rejects(work, error => error.status === 403);
  assert.equal(calls.length, 0);
});
test('Swagger exposes all six paths, exact roles, schemas, and transition errors', async () => {
  const result = await request('/api/docs.json'); assert.equal(result.status, 200); const spec = result.body;
  for (const [path, method] of [['/api/operator/riders', 'get'], ['/api/operator/assignments', 'get'], ['/api/operator/assignments', 'post'], ['/api/rider/assignments', 'get'], ['/api/rider/assignments/{id}', 'get'], ['/api/rider/assignments/{id}/status', 'patch']]) {
    const operation = spec.paths[path][method]; assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    for (const status of [400, 401, 403, 500]) assert.ok(operation.responses[status]);
  }
  assert.ok(spec.paths['/api/rider/assignments/{id}/status'].patch.responses[409]);
  assert.equal(spec.components.schemas.CreateAssignmentInput.additionalProperties, false);
  assert.ok(spec.components.schemas.OperatorOrderDetail.allOf[1].properties.assignment);
  const riderList = spec.paths['/api/rider/assignments'].get;
  const groupParameter = riderList.parameters.find(parameter => parameter.name === 'group');
  const statusParameter = riderList.parameters.find(parameter => parameter.name === 'status');
  assert.deepEqual(groupParameter.schema.enum, ['active', 'completed']);
  assert.ok(statusParameter.schema.enum.includes('DELIVERED'));
  assert.ok(spec.components.schemas.RiderAssignmentList.required.includes('counts'));
  assert.ok(spec.components.schemas.AssignmentOrder.required.includes('destinationCity'));
  assert.ok(spec.components.schemas.AssignmentOrder.required.includes('parcelWeight'));
  assert.ok(spec.components.schemas.AssignmentOrder.required.includes('parcelWeightUnit'));
  assert.equal(deliveryStatusSchema.safeParse({ status: 'FAILED', note: '  ' }).success, false);
});
