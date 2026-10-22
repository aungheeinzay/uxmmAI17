const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const databaseUrl = process.env.TEST_DATABASE_URL;
const enabled = Boolean(databaseUrl && process.env.PARCELOPS_ASSIGNMENTS_DB_TEST === 'confirmed');

test('assignment uniqueness, concurrency and delivery atomicity against dedicated PostgreSQL', { skip: !enabled, timeout: 60000 }, async () => {
  const target = new URL(databaseUrl);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Only a dedicated local test database is permitted');
  assert.match(decodeURIComponent(target.pathname), /\/[^/]*_test$/, 'Database name must end in _test');
  process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = databaseUrl;
  const { prisma } = require('../dist/config/prisma');
  const service = require('../dist/modules/assignments/assignment.service');
  const repository = require('../dist/modules/assignments/assignment.repository');
  const ids = { operator: randomUUID(), rider: randomUUID(), sme: randomUUID(), order: randomUUID(), provider: randomUUID() };
  const operator = { id: ids.operator, role: 'OPERATOR' }, rider = { id: ids.rider, role: 'RIDER' };
  try {
    await prisma.deliveryProvider.create({ data: { id: ids.provider, name: `Assignment fixture ${ids.provider}` } });
    // No migrations/reset/truncate: target must already have the reviewed migration applied.
    await prisma.account.create({ data: { email: `assignment-${ids.rider}@example.test`, passwordHash: 'unusable-test-fixture', emailVerifiedAt: new Date(), profile: { create: { id: ids.rider, role: 'RIDER', providerId: ids.provider } } } });
    await prisma.profile.create({ data: { id: ids.operator, role: 'OPERATOR', providerId: ids.provider } });
    await prisma.profile.create({ data: { id: ids.sme, role: 'SME' } });
    await prisma.parcelOrder.create({ data: { id: ids.order, orderCode: `PO${ids.order.replaceAll('-', '').slice(0, 16)}`, qrIdentifier: ids.order.replaceAll('-', '').repeat(2), ownerId: ids.sme, operatorId: ids.operator,
      deliveryProviderId: ids.provider, recipientName: 'Fictional Test', phoneNumber: 'TEST-NOT-DIALABLE', township: 'Tamwe', deliveryAddress: 'Fictional test lane', senderName: 'Test Shop', parcelWeightKg: '1', codAmount: '0', status: 'PICKED_UP' } });
    const assignments = await Promise.allSettled([service.assignParcel(operator, { orderId: ids.order, riderId: ids.rider }), service.assignParcel(operator, { orderId: ids.order, riderId: ids.rider })]);
    assert.equal(assignments.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(assignments.find(result => result.status === 'rejected').reason.status, 409);
    assert.equal(await prisma.riderAssignment.count({ where: { orderId: ids.order } }), 1);
    assert.equal((await prisma.parcelOrder.findUnique({ where: { id: ids.order } })).status, 'PICKED_UP');
    await assert.rejects(() => prisma.riderAssignment.create({ data: { orderId: ids.order, riderId: ids.rider, assignedById: ids.operator } }), error => error.code === 'P2002');
    const assignment = await prisma.riderAssignment.findUnique({ where: { orderId: ids.order } });
    // Throw after status + event writes to demonstrate rollback on this real database.
    await assert.rejects(() => repository.transaction(async tx => {
      assert.equal(await repository.changeStatus(tx, { id: assignment.id, orderId: ids.order, riderId: ids.rider, previousStatus: 'PICKED_UP', status: 'IN_TRANSIT', note: null }), true);
      throw new Error('intentional rollback');
    }));
    assert.equal((await prisma.parcelOrder.findUnique({ where: { id: ids.order } })).status, 'PICKED_UP');
    assert.equal(await prisma.orderStatusEvent.count({ where: { orderId: ids.order } }), 0);
    const transitions = await Promise.allSettled([service.updateDeliveryStatus(rider, assignment.id, { status: 'IN_TRANSIT' }), service.updateDeliveryStatus(rider, assignment.id, { status: 'IN_TRANSIT' })]);
    assert.equal(transitions.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(transitions.find(result => result.status === 'rejected').reason.status, 409);
    assert.equal(await prisma.orderStatusEvent.count({ where: { orderId: ids.order } }), 1);
    assert.equal((await prisma.orderStatusEvent.findFirst({ where: { orderId: ids.order } })).actorId, ids.rider);
  } finally {
    // Only fixture UUIDs allocated by this test; never delete unrelated data.
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: ids.order } });
    await prisma.riderAssignment.deleteMany({ where: { orderId: ids.order } });
    await prisma.parcelOrder.deleteMany({ where: { id: ids.order } });
    await prisma.account.deleteMany({ where: { id: ids.rider } });
    await prisma.profile.deleteMany({ where: { id: { in: [ids.operator, ids.rider, ids.sme] } } });
    await prisma.deliveryProvider.deleteMany({ where: { id: ids.provider } });
    await prisma.$disconnect();
  }
});
