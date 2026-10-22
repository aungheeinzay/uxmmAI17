const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

// Explicit, target-specific opt-in. This never applies migrations or deletes pre-existing records.
test('full delivery workflow on the explicitly confirmed development database', {
  skip: process.env.PARCELOPS_WORKFLOW_DB_TEST !== 'confirmed', timeout: 120000,
}, async () => {
  require('dotenv').config({ quiet: true });
  const target = new URL(process.env.DATABASE_URL);
  assert.equal(target.hostname, process.env.PARCELOPS_WORKFLOW_DB_HOST, 'Confirm the exact development host');
  assert.equal(target.pathname, '/postgres');
  process.env.NODE_ENV = 'test';
  const { prisma } = require('../dist/config/prisma');
  const { hashPassword } = require('../dist/modules/auth/auth.password');
  const repository = require('../dist/modules/assignments/assignment.repository');
  const { app } = require('../dist/app');
  const ids = { SME: randomUUID(), OPERATOR: randomUUID(), RIDER: randomUUID(), OTHER: randomUUID(), INELIGIBLE: randomUUID() };
  const password = `test-only-${randomUUID()}`;
  const passwordHash = await hashPassword(password);
  const orders = [];
  const providerId = randomUUID();
  let server;
  try {
    for (const [role, id] of Object.entries(ids)) {
      await prisma.account.create({ data: { email: `workflow-${id}@example.test`, passwordHash, emailVerifiedAt: role === 'INELIGIBLE' ? null : new Date(), profile: { create: { id, role: ['OTHER', 'INELIGIBLE'].includes(role) ? 'RIDER' : role, fullName: `Fictional Workflow ${role}` } } } });
    }
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.on('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const tokens = {};
    async function call(method, path, role, body) {
      const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, body: await response.json() };
    }
    for (const [role, id] of Object.entries(ids)) {
      if (role === 'INELIGIBLE') continue;
      const login = await call('POST', '/api/auth/login', undefined, { email: `workflow-${id}@example.test`, password });
      assert.equal(login.status, 200); tokens[role] = login.body.data.accessToken;
    }
    const migration = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE migration_name = '20261021130000_rider_assignments' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    assert.equal(migration.length, 1);
    const statuses = await prisma.$queryRaw`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'OrderStatus' ORDER BY e.enumsortorder`;
    assert.deepEqual(statuses.map(row => row.enumlabel), ['CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED'], 'Applied migration history must agree with the actual database enum');
    const indexes = await prisma.$queryRaw`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'rider_assignments'`;
    assert.ok(indexes.some(index => index.indexname === 'rider_assignments_order_id_key' && index.indexdef.includes('UNIQUE')));
    assert.ok(indexes.some(index => index.indexname === 'rider_assignments_rider_id_assigned_at_idx'));
    const constraints = await prisma.$queryRaw`SELECT conname FROM pg_constraint WHERE conrelid = 'public.rider_assignments'::regclass AND contype = 'f'`;
    assert.equal(constraints.length, 3);
    const rls = await prisma.$queryRaw`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rider_assignments'::regclass`;
    assert.equal(rls[0].relrowsecurity, true);
    await prisma.deliveryProvider.create({ data: { id: providerId, name: `Workflow fixture ${providerId}`, cityPrices: { create: { city: "yangon", fee: "3500" } } } });
    await prisma.profile.updateMany({ where: { id: { in: [ids.OPERATOR, ids.RIDER, ids.OTHER, ids.INELIGIBLE] } }, data: { providerId } });
    const created = await call('POST', '/api/orders', 'SME', { deliveryProviderId: providerId, destinationCity: "Yangon", operatorId: ids.OPERATOR, recipientName: 'Fictional Workflow Recipient', phoneNumber: '09999999999', township: 'Tamwe', deliveryAddress: 'Fictional workflow test address', senderName: 'Fictional Workflow Shop', parcelWeight: 1, codAmount: '25000.50' });
    assert.equal(created.status, 201); const orderId = created.body.data.id; orders.push(orderId);
    assert.equal(created.body.data.status, 'CREATED');
    async function warehouseState(expected) {
      const result = await call('GET', `/api/operator/warehouse/parcels?search=${created.body.data.orderCode}`, 'OPERATOR');
      assert.equal(result.status, 200);
      assert.equal(result.body.data.pagination.total, expected ? 1 : 0);
      if (expected) {
        assert.equal(result.body.data.orders[0].warehouseState, expected);
        const filtered = await call('GET', `/api/operator/warehouse/parcels?warehouseState=${expected}&search=${created.body.data.orderCode}`, 'OPERATOR');
        assert.equal(filtered.body.data.pagination.total, 1);
      }
    }
    await warehouseState(null); // CREATED is not received inventory.
    const initialInventory = (await call('GET', '/api/operator/warehouse/overview', 'OPERATOR')).body.data;
    assert.equal((await call('PATCH', `/api/orders/${orderId}/status`, 'SME', { status: 'PICKED_UP' })).status, 409);
    const received = await call('PATCH', `/api/operator/orders/${orderId}/receive`, 'OPERATOR', {});
    assert.equal(received.status, 200); assert.equal(received.body.data.status, 'PICKED_UP');
    await warehouseState('UNASSIGNED');
    const missingSelection = await call('POST', '/api/operator/assignments', 'OPERATOR', { orderId });
    assert.equal(missingSelection.status, 400);
    const unavailableRider = await call('POST', '/api/operator/assignments', 'OPERATOR', { orderId, riderId: ids.INELIGIBLE });
    assert.equal(unavailableRider.status, 404); assert.equal(unavailableRider.body.error.code, 'RIDER_NOT_ELIGIBLE');
    assert.equal(await prisma.riderAssignment.count({ where: { orderId } }), 0);
    assert.equal((await prisma.parcelOrder.findUnique({ where: { id: orderId } })).status, 'PICKED_UP');
    await warehouseState('UNASSIGNED'); // Failed assignment must not remove it from this queue.
    const afterReceipt = (await call('GET', '/api/operator/warehouse/overview', 'OPERATOR')).body.data;
    assert.equal(afterReceipt.receivedAwaitingDispatch, initialInventory.receivedAwaitingDispatch + 1);
    const assign = () => call('POST', '/api/operator/assignments', 'OPERATOR', { orderId, riderId: ids.RIDER });
    const concurrent = await Promise.all([assign(), assign()]);
    assert.deepEqual(concurrent.map(result => result.status).sort(), [201, 409]);
    const assignment = concurrent.find(result => result.status === 201).body.data;
    assert.equal(assignment.order.status, 'PICKED_UP');
    await warehouseState('ASSIGNED');
    assert.equal(await prisma.riderAssignment.count({ where: { orderId } }), 1);
    await assert.rejects(() => prisma.riderAssignment.create({ data: { orderId, riderId: ids.RIDER, assignedById: ids.OPERATOR } }), error => error.code === 'P2002');
    const list = await call('GET', '/api/rider/assignments', 'RIDER');
    assert.ok(list.body.data.assignments.some(item => item.id === assignment.id));
    assert.equal((await call('GET', `/api/rider/assignments/${assignment.id}`, 'OTHER')).status, 404);
    assert.equal((await call('PATCH', `/api/rider/assignments/${assignment.id}/status`, 'OTHER', { status: 'IN_TRANSIT' })).status, 404);
    assert.equal((await call('GET', `/api/operator/orders?status=PICKED_UP&unassigned=true&search=${created.body.data.orderCode}`, 'OPERATOR')).body.data.pagination.total, 0);
    // Deliberate abort after both writes validates real transaction rollback.
    await assert.rejects(() => repository.transaction(async tx => {
      assert.equal(await repository.changeStatus(tx, { id: assignment.id, orderId, riderId: ids.RIDER, previousStatus: 'PICKED_UP', status: 'IN_TRANSIT', note: null }), true);
      throw new Error('intentional fixture rollback');
    }));
    assert.equal((await prisma.parcelOrder.findUnique({ where: { id: orderId } })).status, 'PICKED_UP');
    assert.equal(await prisma.orderStatusEvent.count({ where: { orderId } }), 1);
    const transition = status => call('PATCH', `/api/rider/assignments/${assignment.id}/status`, 'RIDER', { status });
    assert.equal((await transition('DELIVERED')).status, 409);
    const starts = await Promise.all([transition('IN_TRANSIT'), transition('IN_TRANSIT')]);
    assert.deepEqual(starts.map(result => result.status).sort(), [200, 409]);
    await warehouseState('DISPATCHED');
    assert.equal((await transition('OUT_FOR_DELIVERY')).status, 200);
    await warehouseState('DISPATCHED');
    assert.equal((await transition('DELIVERED')).status, 200);
    await warehouseState('COMPLETED');
    const finalOverview = (await call('GET', '/api/operator/warehouse/overview', 'OPERATOR')).body.data;
    assert.equal(finalOverview.receivedAwaitingDispatch, initialInventory.receivedAwaitingDispatch);
    assert.equal(finalOverview.completed, initialInventory.completed + 1);
    const persistedUnassigned = await prisma.parcelOrder.count({ where: { owner: { role: 'SME' }, status: 'PICKED_UP', assignment: { is: null } } });
    const persistedAssigned = await prisma.parcelOrder.count({ where: { owner: { role: 'SME' }, status: 'PICKED_UP', assignment: { isNot: null } } });
    assert.equal(finalOverview.unassigned, persistedUnassigned); assert.equal(finalOverview.assignedAwaitingDispatch, persistedAssigned);
    assert.equal((await transition('IN_TRANSIT')).status, 409);
    const detail = await call('GET', `/api/operator/orders/${orderId}`, 'OPERATOR');
    assert.equal(detail.body.data.status, 'DELIVERED'); assert.equal(detail.body.data.assignment.riderId, ids.RIDER);
    assert.deepEqual(detail.body.data.statusEvents.map(event => event.status), ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']);
    assert.deepEqual(detail.body.data.statusEvents.map(event => event.actor.id), [ids.OPERATOR, ids.RIDER, ids.RIDER, ids.RIDER]);
    assert.equal((await call('GET', `/api/orders/${orderId}`, 'SME')).body.data.status, 'DELIVERED');
    const monitoring = await call('GET', '/api/operator/assignments', 'OPERATOR');
    assert.equal(monitoring.body.data.assignments.find(item => item.id === assignment.id).order.status, 'DELIVERED');
    const cancelOrder = await call('POST', '/api/orders', 'SME', { deliveryProviderId: providerId, destinationCity: "Yangon", operatorId: ids.OPERATOR, recipientName: 'Fictional Cancellation', phoneNumber: '09999999999', township: 'Tamwe', deliveryAddress: 'Fictional address', senderName: 'Fictional Shop', parcelWeight: 1, codAmount: '0' });
    assert.equal(cancelOrder.status, 201); orders.push(cancelOrder.body.data.id);
    assert.equal((await call('PATCH', `/api/orders/${cancelOrder.body.data.id}/status`, 'SME', { status: 'CANCELLED' })).status, 200);
    const cancelled = await call('GET', `/api/operator/warehouse/parcels?search=${cancelOrder.body.data.orderCode}`, 'OPERATOR');
    assert.equal(cancelled.body.data.pagination.total, 0);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    // Restrict cleanup to UUIDs created by this invocation, additionally scoped to fixture owner.
    const createdOrders = await prisma.parcelOrder.findMany({ where: { id: { in: orders }, ownerId: ids.SME }, select: { id: true } });
    const createdIds = createdOrders.map(order => order.id);
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: { in: createdIds } } });
    await prisma.riderAssignment.deleteMany({ where: { orderId: { in: createdIds } } });
    await prisma.parcelOrder.deleteMany({ where: { id: { in: createdIds }, ownerId: ids.SME } });
    await prisma.deliveryCityPrice.deleteMany({ where: { providerId } });
    await prisma.profile.updateMany({ where: { id: { in: Object.values(ids) }, providerId }, data: { providerId: null } });
    await prisma.deliveryProvider.deleteMany({ where: { id: providerId } });
    const fixtureIds = Object.values(ids);
    await prisma.account.deleteMany({ where: { id: { in: fixtureIds }, email: { startsWith: 'workflow-' } } });
    await prisma.profile.deleteMany({ where: { id: { in: fixtureIds } } });
    await prisma.$disconnect();
  }
});
