const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { Prisma } = require('../dist/generated/prisma/client');
const repository = require('../dist/modules/assignments/assignment.repository');
const service = require('../dist/modules/assignments/assignment.service');

const riderId = randomUUID();
const providerId = randomUUID();
const orderId = randomUUID();
const assignmentId = randomUUID();
const qrIdentifier = 'a1b2c3d4e5f678901234567890abcdefa1b2c3d4e5f678901234567890abcdef';
const orderCode = 'POAABBCCDDEEFF0011';
const person = id => ({ id, fullName: 'Test Person', phone: null });
const row = {
  id: assignmentId, orderId, riderId, assignedById: randomUUID(), assignedAt: new Date(),
  rider: person(riderId), assignedBy: person(randomUUID()),
  order: {
    id: orderId, orderCode, recipientName: 'Recipient', phoneNumber: '09999999999',
    deliveryAddress: 'Test address', township: 'Tamwe', deliveryInstructions: null,
    destinationCity: 'yangon', deliveryProviderId: providerId,
    deliveryProvider: { id: providerId, name: 'Test Provider' }, deliveryFee: new Prisma.Decimal('2000'),
    parcelWeightKg: new Prisma.Decimal('1'), codAmount: new Prisma.Decimal('200000'), currency: 'MMK',
    status: 'PICKED_UP', hasIncident: false, statusEvents: [],
  },
};
let membership;
let found;

beforeEach(() => {
  membership = { role: 'RIDER', providerId, deactivatedAt: null };
  found = row;
  repository.findRiderMembership = async () => membership;
  repository.findRiderAssignmentByParcelReference = async (id, provider, reference) => {
    if (id !== riderId || provider !== providerId) return null;
    if ((reference.kind === 'qr' && reference.value === qrIdentifier) || (reference.kind === 'orderCode' && reference.value === orderCode)) return found;
    return null;
  };
});

test('existing SME QR identifier verifies only the assigned Rider parcel', async () => {
  const result = await service.verifyParcelScan({ id: riderId, role: 'RIDER' }, { qrData: qrIdentifier });
  assert.equal(result.id, assignmentId);
  assert.equal(result.riderId, riderId);
  assert.equal(result.order.recipientName, 'Recipient');
  assert.equal(result.order.status, 'PICKED_UP');
});

test('manual order-code fallback resolves through the same assignment authorization', async () => {
  const result = await service.verifyParcelScan({ id: riderId, role: 'RIDER' }, { qrData: orderCode.toLowerCase() });
  assert.equal(result.order.orderCode, orderCode);
});

test('malformed, cross-provider and unassigned references are rejected', async () => {
  await assert.rejects(() => service.verifyParcelScan({ id: riderId, role: 'RIDER' }, { qrData: 'https://evil.example/parcel' }), error => error.status === 400);
  found = null;
  await assert.rejects(() => service.verifyParcelScan({ id: riderId, role: 'RIDER' }, { qrData: qrIdentifier }), error => error.status === 404);
  membership = { role: 'RIDER', providerId: randomUUID(), deactivatedAt: null };
  await assert.rejects(() => service.verifyParcelScan({ id: riderId, role: 'RIDER' }, { qrData: qrIdentifier }), error => error.status === 404);
});

test('deactivated or incomplete membership cannot scan', async () => {
  membership = { role: 'RIDER', providerId, deactivatedAt: new Date() };
  await assert.rejects(() => service.verifyParcelScan({ id: riderId, role: 'RIDER' }, { qrData: qrIdentifier }), error => error.code === 'RIDER_DEACTIVATED');
  membership = { role: 'RIDER', providerId: null, deactivatedAt: null };
  await assert.rejects(() => service.verifyParcelScan({ id: riderId, role: 'RIDER' }, { qrData: qrIdentifier }), error => error.code === 'RIDER_PROVIDER_MEMBERSHIP_REQUIRED');
});
