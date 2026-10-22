// HTTP + actual query-builder/service tests with a database double; live coverage is separate.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { prisma } = require('../dist/config/prisma');
const { Prisma } = require('../dist/generated/prisma/client');
const { deriveWarehouseState } = require('../dist/modules/operator/warehouse/warehouse.state');
const service = require('../dist/modules/operator/warehouse/warehouse.service');
const repository = require('../dist/modules/operator/warehouse/warehouse.repository');
const auth = require('../dist/modules/auth/auth.repository');
const actorId = randomUUID(), riderId = randomUUID();
const tokens = { OPERATOR: 'O'.repeat(43), SME: 'S'.repeat(43), RIDER: 'R'.repeat(43) };
auth.findSession = async hash => {
  const role = Object.keys(tokens).find(key => createHash('sha256').update(tokens[key]).digest('hex') === hash);
  return role ? { accessExpiresAt: new Date(Date.now() + 60000), account: { id: actorId, emailVerifiedAt: new Date(), email: 'test@example.invalid', profile: { role } } } : null;
};
const person = id => ({ id, fullName: 'Fictional Test', phone: null });
function row(status, assigned, index, ownerRole = 'SME') {
  return { id: randomUUID(), orderCode: `PO${String(index).padStart(16, '0')}`, ownerRole, ownerId: actorId, recipientName: 'Fictional Recipient', phoneNumber: 'TEST-NOT-DIALABLE', township: index % 2 ? 'Tamwe' : 'Kamayut', deliveryAddress: 'Fictional address', senderName: 'Fictional Shop', deliveryInstructions: null,
    parcelWeightKg: new Prisma.Decimal('1'), codAmount: new Prisma.Decimal('25000.50'), currency: 'MMK', status, createdAt: new Date(`2026-10-${index % 2 ? '21' : '22'}T00:00:00Z`), updatedAt: new Date(), owner: person(actorId), operatorId: actorId, operator: person(actorId),
    assignment: assigned ? { id: randomUUID(), riderId, assignedById: actorId, assignedAt: new Date(), rider: person(riderId) } : null };
}
let rows, reads, transactions;
function matches(row, where) {
  if (where.owner && row.ownerRole !== where.owner.role) return false;
  if (typeof where.status === 'string' && row.status !== where.status) return false;
  if (where.status?.in && !where.status.in.includes(row.status)) return false;
  if (where.assignment?.is === null && row.assignment) return false;
  if (where.assignment?.isNot === null && !row.assignment) return false;
  if (where.township && row.township.toLowerCase() !== where.township.equals.toLowerCase()) return false;
  if (where.OR && !where.OR.some(term => Object.entries(term).some(([key, value]) => row[key].toLowerCase().includes(value.contains.toLowerCase())))) return false;
  if (where.createdAt && !(row.createdAt >= where.createdAt.gte && row.createdAt < where.createdAt.lt)) return false;
  return true;
}
prisma.parcelOrder.findMany = async args => { reads.push(args); return rows.filter(row => matches(row, args.where)).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(args.skip, args.skip + args.take); };
prisma.parcelOrder.count = async args => { reads.push(args); return rows.filter(row => matches(row, args.where)).length; };
prisma.$transaction = async (queries, options) => { transactions.push(options); return Promise.all(queries); };
beforeEach(() => {
  rows = [row('CREATED', false, 0), row('PICKED_UP', false, 1), row('PICKED_UP', true, 2), row('IN_TRANSIT', true, 3), row('OUT_FOR_DELIVERY', true, 4), row('DELIVERED', true, 5), row('FAILED', true, 6), row('CANCELLED', false, 7), row('PICKED_UP', false, 8, 'OPERATOR')];
  reads = []; transactions = [];
});
const { app } = require('../dist/app'); let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
async function get(path, role = 'OPERATOR') { const response = await fetch(`${base}/api/operator/warehouse/${path}`, { headers: tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {} }); return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') }; }
test('warehouse APIs require authenticated Operator role, including service entry points', async () => {
  for (const endpoint of ['overview', 'parcels']) {
    assert.equal((await get(endpoint, 'NONE')).status, 401);
    for (const role of ['SME', 'RIDER']) assert.equal((await get(endpoint, role)).status, 403);
  }
  for (const role of ['SME', 'RIDER']) {
    await assert.rejects(() => service.overview({ id: actorId, role }), error => error.status === 403);
    await assert.rejects(() => service.parcels({ id: actorId, role }, { page: 1, pageSize: 20 }), error => error.status === 403);
  }
  assert.equal(reads.length, 0);
});
test('overview counts the actual state predicates in one consistent transaction', async () => {
  const result = await get('overview'); assert.equal(result.status, 200); assert.equal(result.cache, 'no-store');
  assert.deepEqual(result.body.data, { scope: 'ALL_TIME', unassigned: 1, assignedAwaitingDispatch: 1, receivedAwaitingDispatch: 2, dispatched: 2, completed: 1, exceptions: 1 });
  assert.equal(reads.length, 5); assert.equal(transactions.length, 1); assert.equal(transactions[0].isolationLevel, 'RepeatableRead');
});
test('all status groups classify correctly; CREATED/CANCELLED and non-SME orders are excluded', async () => {
  const result = await get('parcels'); assert.equal(result.status, 200); assert.equal(result.body.data.orders.length, 6);
  assert.deepEqual(result.body.data.orders.map(order => order.warehouseState).sort(), ['ASSIGNED', 'COMPLETED', 'DISPATCHED', 'DISPATCHED', 'EXCEPTION', 'UNASSIGNED']);
  for (const [status, assigned, expected] of [['CREATED', false, null], ['CANCELLED', false, null], ['PICKED_UP', false, 'UNASSIGNED'], ['PICKED_UP', true, 'ASSIGNED'], ['IN_TRANSIT', true, 'DISPATCHED'], ['OUT_FOR_DELIVERY', true, 'DISPATCHED'], ['DELIVERED', true, 'COMPLETED'], ['FAILED', true, 'EXCEPTION']]) assert.equal(deriveWarehouseState(status, assigned), expected);
  assert.equal(result.body.data.pagination.total, 6);
});
test('each warehouseState filters database rows, with assignments included and safe fields selected', async () => {
  for (const [state, count] of [['UNASSIGNED', 1], ['ASSIGNED', 1], ['DISPATCHED', 2], ['COMPLETED', 1], ['EXCEPTION', 1]]) {
    const result = await get(`parcels?warehouseState=${state}`); assert.equal(result.status, 200); assert.equal(result.body.data.pagination.total, count);
    assert.ok(result.body.data.orders.every(order => order.warehouseState === state));
    if (state === 'ASSIGNED') assert.equal(result.body.data.orders[0].assignment.rider.id, riderId);
  }
  assert.doesNotMatch(JSON.stringify(reads.filter(read => read.select).map(read => read.select)), /password|account|token|sessions/i);
  assert.equal(reads.filter(read => read.select).length, 5); // one list query per endpoint call, not one per parcel
});
test('search, township, date and state filters combine before pagination and count', async () => {
  const result = await get('parcels?warehouseState=UNASSIGNED&search=fictional&township=tamwe&createdDate=2026-10-21&page=1&pageSize=1');
  assert.equal(result.status, 200); assert.equal(result.body.data.pagination.total, 1); assert.equal(result.body.data.orders.length, 1);
  const query = reads.find(read => read.select); assert.equal(query.where.assignment.is, null); assert.equal(query.where.status, 'PICKED_UP');
  assert.deepEqual(reads[0].where, reads[1].where); assert.equal(query.skip, 0); assert.equal(query.take, 1);
  assert.equal(query.where.createdAt.gte.toISOString(), '2026-10-21T00:00:00.000Z');
  assert.equal((await get('parcels?search=not-a-match')).body.data.pagination.total, 0);
});
test('pagination uses correct total independent of the current page', async () => {
  const result = await get('parcels?page=2&pageSize=2');
  assert.equal(result.body.data.orders.length, 2); assert.deepEqual(result.body.data.pagination, { page: 2, pageSize: 2, total: 6, totalPages: 3 });
  assert.equal(reads[0].skip, 2); assert.deepEqual(reads[0].orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
});
test('each warehouse order exposes a derived hasIncident flag', async () => {
  rows.find(row => row.status === 'PICKED_UP' && !row.assignment).incidents = [{ id: randomUUID() }];
  const result = await get('parcels');
  assert.equal(result.body.data.orders.filter(order => order.hasIncident).length, 1);
  assert.ok(result.body.data.orders.every(order => typeof order.hasIncident === 'boolean'));
});
test('empty data returns zero counts and valid empty pagination', async () => {  rows = []; const overview = await get('overview'); assert.equal(overview.body.data.receivedAwaitingDispatch, 0); assert.equal(overview.body.data.completed, 0);
  assert.deepEqual((await get('parcels')).body.data, { orders: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
});
test('invalid inputs and identity/status overrides are rejected before database access', async () => {
  for (const query of ['page=0', 'pageSize=101', 'warehouseState=CREATED', 'createdDate=2026-02-30', 'ownerId=' + actorId, 'operatorId=' + actorId, 'role=OPERATOR', 'status=CREATED']) assert.equal((await get('parcels?' + query)).status, 400);
  assert.equal((await get('overview?createdDate=2026-10-21')).status, 400); assert.equal(reads.length, 0);
});
test('overview inventory sums exclude dispatched and historical delivery totals', async () => {
  rows = [row('DELIVERED', true, 1), row('IN_TRANSIT', true, 2), row('FAILED', true, 3)];
  const result = await get('overview'); assert.equal(result.body.data.receivedAwaitingDispatch, 0); assert.equal(result.body.data.completed, 1);
  const where = repository.warehouseWhere({ page: 1, pageSize: 20, warehouseState: 'ASSIGNED' });
  assert.deepEqual(where.assignment, { isNot: null });
});
test('existing detail derives receipt and failure only from recorded history, including unavailable metadata', async () => {
  const operator = require('../dist/modules/operator/operator.service');
  prisma.parcelOrder.findFirst = async () => ({ ...row('FAILED', true, 1), statusEvents: [
    { id: randomUUID(), previousStatus: 'CREATED', status: 'PICKED_UP', createdAt: new Date('2026-10-21T01:00:00Z'), actor: { id: actorId, fullName: 'Receiving Operator' }, note: null },
    { id: randomUUID(), previousStatus: 'IN_TRANSIT', status: 'FAILED', createdAt: new Date('2026-10-22T01:00:00Z'), actor: { id: riderId, fullName: 'Rider' }, note: 'Recipient unavailable' },
  ] });
  const detail = await operator.getOrder(randomUUID()); assert.equal(detail.warehouseState, 'EXCEPTION');
  assert.equal(detail.receipt.receivedAt.toISOString(), '2026-10-21T01:00:00.000Z'); assert.equal(detail.receipt.receivedBy.id, actorId); assert.equal(detail.failureNote, 'Recipient unavailable');
  prisma.parcelOrder.findFirst = async () => ({ ...row('PICKED_UP', false, 2), statusEvents: [] });
  const legacy = await operator.getOrder(randomUUID()); assert.equal(legacy.receipt, null); assert.equal(legacy.failureNote, null); assert.equal(legacy.warehouseState, 'UNASSIGNED');
});
