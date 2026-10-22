const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { prisma } = require('../dist/config/prisma');
const { Prisma } = require('../dist/generated/prisma/client');
const auth = require('../dist/modules/auth/auth.repository');
const service = require('../dist/modules/operator/operator.service');
const repository = require('../dist/modules/operator/operator.repository');
const { receiveParcelSchema } = require('../dist/modules/operator/operator.validation');
const id = randomUUID(), ownerId = randomUUID(), operatorId = randomUUID();
const tokens = { OPERATOR: 'O'.repeat(43), SME: 'S'.repeat(43), RIDER: 'R'.repeat(43), expired: 'E'.repeat(43) };
auth.findSession = async hash => {
  const role = Object.keys(tokens).find(key => createHash('sha256').update(tokens[key]).digest('hex') === hash);
  return role ? { accessExpiresAt: role === 'expired' ? new Date(0) : new Date(Date.now() + 60000), account: {
    id: operatorId, emailVerifiedAt: new Date(), email: 'operator@example.invalid', profile: { role: role === 'expired' ? 'OPERATOR' : role },
  } } : null;
};
let state, history, reads, writes, eventInputs, transactionCalls, failHistory, failRead, beforeTransaction, queue;
function row(record, events) {
  return { id: record.id, ownerId: record.ownerId, orderCode: 'PODEAD000000000001',
    recipientName: 'FICTIONAL Recipient', phoneNumber: 'TEST-NOT-DIALABLE', township: 'Tamwe',
    deliveryAddress: 'FICTIONAL address', senderName: 'TEST Shop', deliveryInstructions: null,
    parcelWeightKg: new Prisma.Decimal('1.25'), codAmount: new Prisma.Decimal('0'), currency: 'MMK', status: record.status,
    createdAt: new Date('2026-10-21T00:00:00Z'), updatedAt: new Date('2026-10-21T01:00:00Z'),
    owner: { id: record.ownerId, fullName: 'TEST Seller', phone: null }, operatorId, operator: { id: operatorId, fullName: 'TEST Operator', phone: null },
    statusEvents: events.map(event => ({ ...event, actor: { id: event.actorId, fullName: 'TEST Operator' } })),
  };
}
function matches(record, where) {
  return record && record.id === where.id && record.ownerRole === where.owner.role
    && (!where.ownerId || record.ownerId === where.ownerId) && (!where.status || record.status === where.status);
}
prisma.parcelOrder.findFirst = async args => { reads.push(args); return matches(state, args.where) ? row(state, history) : null; };
// A transactional in-memory double exercises the real repository callback and CAS
// predicates, without connecting to PostgreSQL. It is not a database isolation test.
prisma.$transaction = async callback => {
  transactionCalls++;
  const prior = queue;
  let unlock;
  queue = new Promise(resolve => { unlock = resolve; });
  await prior;
  try {
    if (beforeTransaction) { beforeTransaction(); beforeTransaction = undefined; }
    const draft = state ? { ...state } : null;
    const events = [...history];
    const result = await callback({
      parcelOrder: {
        updateMany: async args => {
          writes.push(args);
          if (!matches(draft, args.where)) return { count: 0 };
          draft.status = args.data.status;
          return { count: 1 };
        },
        findFirst: async args => {
          reads.push(args);
          return !failRead && matches(draft, args.where) ? row(draft, events) : null;
        },
      },
      orderStatusEvent: { create: async ({ data }) => {
        eventInputs.push(data);
        if (failHistory) throw new Error('test history failure');
        const event = { ...data, id: randomUUID(), createdAt: new Date() };
        events.push(event); return event;
      } },
    });
    state = draft; history = events;
    return result;
  } finally { unlock(); }
};
beforeEach(() => {
  state = { id, ownerId, status: 'CREATED', ownerRole: 'SME' }; history = []; reads = []; writes = []; eventInputs = [];
  transactionCalls = 0; failHistory = false; failRead = false; beforeTransaction = undefined; queue = Promise.resolve();
});
const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
async function receive(body = {}, token = tokens.OPERATOR, parcelId = id) {
  const response = await fetch(`${base}/api/operator/orders/${parcelId}/receive`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), 'X-Role': 'OPERATOR' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
test('receiving requires a valid OPERATOR session before any parcel lookup', async () => {
  for (const token of ['', 'invalid', 'Z'.repeat(43), tokens.expired]) assert.equal((await receive({}, token)).status, 401);
  for (const role of ['SME', 'RIDER']) assert.equal((await receive({}, tokens[role])).status, 403);
  assert.equal(reads.length, 0); assert.equal(transactionCalls, 0);
});
test('service rejects wrong roles even when invoked without the HTTP router', async () => {
  for (const role of ['SME', 'RIDER']) await assert.rejects(service.receiveParcel({ id: operatorId, role }, id, {}), error => error.status === 403);
  assert.equal(reads.length, 0); assert.equal(transactionCalls, 0);
});
test('operator receives CREATED parcel and records trusted actor, fixed status and server timestamp', async () => {
  const result = await receive({ note: '  Intake desk  ' });
  assert.equal(result.status, 200); assert.equal(result.cache, 'no-store');
  assert.equal(result.body.data.status, 'PICKED_UP'); assert.equal(result.body.data.previousStatus, 'CREATED');
  assert.equal(result.body.data.ownerId, ownerId); assert.equal(result.body.data.parcelWeight, '1.25');
  assert.equal(state.status, 'PICKED_UP'); assert.equal(transactionCalls, 1); assert.equal(history.length, 1);
  assert.deepEqual(eventInputs[0], { orderId: id, actorId: operatorId, previousStatus: 'CREATED', status: 'PICKED_UP', note: 'Intake desk' });
  assert.equal('createdAt' in eventInputs[0], false);
  assert.equal(result.body.data.statusEvents[0].actor.id, operatorId);
  assert.ok(result.body.data.statusEvents[0].createdAt);
  assert.deepEqual(writes[0], { where: { id, ownerId, owner: { role: 'SME' }, status: 'CREATED' }, data: { status: 'PICKED_UP' } });
  assert.doesNotMatch(JSON.stringify(reads.at(-1).select), /account|password|session|token/i);
});
test('missing note and blank or null notes produce null history notes', async () => {
  for (const body of [{}, { note: null }, { note: '  ' }]) {
    state.status = 'CREATED'; history = [];
    assert.equal((await receive(body)).status, 200); assert.equal(history[0].note, null);
  }
  state.status = 'CREATED'; history = [];
  const response = await fetch(`${base}/api/operator/orders/${id}/receive`, { method: 'PATCH', headers: { Authorization: `Bearer ${tokens.OPERATOR}` } });
  assert.equal(response.status, 200); assert.equal(history[0].note, null);
});
test('body cannot override status, actor, timestamp, order ownership or role', async () => {
  for (const body of [{ status: 'DELIVERED' }, { status: 'CANCELLED' }, { actorId: randomUUID() },
    { ownerId: randomUUID() }, { role: 'OPERATOR' }, { createdAt: new Date().toISOString() }, { note: 'x'.repeat(1001) }, { note: 7 }]) {
    assert.equal((await receive(body)).status, 400);
  }
  assert.equal(writes.length, 0); assert.equal(history.length, 0);
});
test('invalid UUID is 400 and missing or out-of-scope parcels are 404', async () => {
  assert.equal((await receive({}, tokens.OPERATOR, 'invalid')).status, 400);
  assert.equal((await receive({}, tokens.OPERATOR, randomUUID())).status, 404);
  state.ownerRole = 'OPERATOR';
  assert.equal((await receive()).status, 404);
  assert.equal(transactionCalls, 0); assert.equal(history.length, 0);
});
test('every non-CREATED state including all terminal states rejects receiving with 409', async () => {
  for (const status of ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED']) {
    state.status = status;
    const result = await receive();
    assert.equal(result.status, 409, status); assert.equal(result.body.error.code, 'STATUS_TRANSITION_NOT_ALLOWED');
    assert.equal(state.status, status);
  }
  assert.equal(transactionCalls, 0); assert.equal(history.length, 0);
});
test('repeated receiving cannot create duplicate history', async () => {
  assert.equal((await receive()).status, 200); assert.equal((await receive()).status, 409);
  assert.equal(history.length, 1);
});
test('two concurrent receives have exactly one winner and one history event', async () => {
  const actor = { id: operatorId, role: 'OPERATOR' };
  const results = await Promise.allSettled([service.receiveParcel(actor, id, {}), service.receiveParcel(actor, id, {})]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const loser = results.find(result => result.status === 'rejected');
  assert.equal(loser.reason.status, 409); assert.equal(loser.reason.code, 'STATUS_UPDATE_CONFLICT');
  assert.equal(state.status, 'PICKED_UP'); assert.equal(history.length, 1);
});
test('conditional write rejects cancellation, ownership changes and scope changes after initial lookup', async () => {
  for (const change of [() => { state.status = 'CANCELLED'; }, () => { state.ownerId = randomUUID(); }, () => { state.ownerRole = 'RIDER'; }]) {
    state = { id, ownerId, status: 'CREATED', ownerRole: 'SME' };
    beforeTransaction = change;
    const result = await receive();
    assert.equal(result.status, 409); assert.equal(result.body.error.code, 'STATUS_UPDATE_CONFLICT');
    assert.equal(history.length, 0);
  }
});
test('history insertion failure rejects transaction and does not commit status', async () => {
  failHistory = true;
  const result = await receive();
  assert.equal(result.status, 500); assert.equal(state.status, 'CREATED'); assert.equal(history.length, 0);
  assert.doesNotMatch(JSON.stringify(result.body), /test history failure/);
});
test('post-write read failure rejects transaction rather than committing a partial result', async () => {
  failRead = true;
  await assert.rejects(repository.receiveCreatedOrder({ orderId: id, ownerId, actorId: operatorId, note: null }));
  assert.equal(state.status, 'CREATED'); assert.equal(history.length, 0);
});
test('Swagger documents real receiving permissions, request schema and standard responses', () => {
  const { openApiDocument: spec } = require('../dist/config/swagger');
  const operation = spec.paths['/api/operator/orders/{id}/receive'].patch;
  assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
  assert.match(operation.description, /only CREATED to PICKED_UP/);
  assert.match(operation.summary, /OPERATOR only/);
  assert.deepEqual(spec.components.schemas.ReceiveParcelInput, require('zod').z.toJSONSchema(receiveParcelSchema, { target: 'openapi-3.0', io: 'input' }));
  for (const status of [200, 400, 401, 403, 404, 409, 500]) assert.ok(operation.responses[status]);
  assert.equal(operation.requestBody.required, false);
});
