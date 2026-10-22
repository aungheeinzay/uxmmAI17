const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const repository = require('../dist/modules/orders/order.repository');
const users = require('../dist/modules/users/user.service');
const service = require('../dist/modules/orders/order.service');
const { Prisma } = require('../dist/generated/prisma/client');
const owner = randomUUID(), id = randomUUID();
let status = 'CREATED', writes = [];
users.getProfile = async profileId => ({ id: profileId, role: 'SME' });
const row = () => ({ id, ownerId: owner, operatorId: null, orderCode: 'PODEAD000000000001', recipientName: 'Fictional Recipient', phoneNumber: 'TEST-NOT-DIALABLE', township: 'Tamwe', deliveryAddress: 'Fictional address', senderName: 'Fictional Shop', parcelWeightKg: new Prisma.Decimal('1'), codAmount: new Prisma.Decimal('0'), currency: 'MMK', status, createdAt: new Date(), updatedAt: new Date(), deliveryInstructions: null, owner: { id: owner, fullName: 'Fictional SME', phone: null }, operator: null });
repository.findOrderForOwner = async ownerId => ownerId === owner ? row() : null;
repository.updateOrderStatus = async input => { writes.push(input); status = input.status; return row(); };
test('SME cannot execute any operational transition, including from CREATED', async () => {
  writes = [];
  for (const previous of ['CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED']) {
    status = previous;
    for (const target of ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']) await assert.rejects(() => service.updateOrderStatus(owner, { kind: 'id', value: id }, { status: target }), error => error.status === 409);
  }
  assert.equal(writes.length, 0);
});
test('SME may cancel only an owned CREATED order and keeps trusted history actor', async () => {
  writes = []; status = 'CREATED';
  await assert.rejects(() => service.updateOrderStatus(randomUUID(), { kind: 'id', value: id }, { status: 'CANCELLED' }), error => error.status === 404);
  const result = await service.updateOrderStatus(owner, { kind: 'id', value: id }, { status: 'CANCELLED' });
  assert.equal(result.status, 'CANCELLED'); assert.equal(result.previousStatus, 'CREATED'); assert.equal(writes[0].actorId, owner);
  for (const previous of ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED']) {
    status = previous; await assert.rejects(() => service.updateOrderStatus(owner, { kind: 'id', value: id }, { status: 'CANCELLED' }), error => error.status === 409);
  }
  assert.equal(writes.length, 1);
});
