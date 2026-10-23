const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { Prisma } = require('../dist/generated/prisma/client');
const { prisma } = require('../dist/config/prisma');
const auth = require('../dist/modules/auth/auth.service');
const users = require('../dist/modules/users/user.service');
const repo = require('../dist/modules/providers/provider.repository');
const orders = require('../dist/modules/orders/order.repository');
const service = require('../dist/modules/orders/order.service');
const providers = require('../dist/modules/providers/provider.service');
const validation = require('../dist/modules/providers/provider.validation');
const { createOrderSchema } = require('../dist/modules/orders/order.validation');
const id = randomUUID(), owner = randomUUID(), operator = randomUUID();
auth.authenticate = async token => ({ id: owner, role: token });
users.getProfile = async () => ({ id: owner, role: 'SME', fullName: 'Test Shop' });
orders.findOperator = async () => ({ id: operator });
const input = () => ({ operatorId: operator, destinationCity: ' Yangon ', deliveryProviderId: id, recipientName: 'Test', phoneNumber: '09999999999', township: 'Tamwe', deliveryAddress: 'Test address', senderName: 'Shop', parcelWeight: 1, codAmount: '5000.00' });
let fee = '3500.00', active = true, covered = true, failures = 0, writes = [];
orders.createOrder = async (data, validate) => {
  if (failures-- > 0) throw { code: 'P2034' };
  const deliveryFee = validate(covered ? { fee: new Prisma.Decimal(fee), provider: { isActive: active } } : null);
  const row = { ...data, id: randomUUID(), deliveryFee, deliveryProvider: { id, name: 'Test Express' }, parcelWeightKg: new Prisma.Decimal(data.parcelWeightKg), codAmount: new Prisma.Decimal(data.codAmount), status: 'CREATED', currency: 'MMK', createdAt: new Date(), updatedAt: new Date() };
  writes.push(row); return row;
};
after(async () => prisma.$disconnect());
test('city normalization and decimal boundaries reject malformed input and overrides', () => {
  assert.equal(validation.citySchema.parse('  YANGON  '), 'yangon');
  assert.equal(validation.citySchema.parse('Nay   Pyi Taw'), 'nay pyi taw');
  for (const bad of ['', '123', 'a/b']) assert.equal(validation.citySchema.safeParse(bad).success, false);
  for (const fee of ['-1', '1.001', '10000000000', '1e2', 'NaN']) assert.equal(validation.priceSchema.safeParse({ fee }).success, false);
  assert.equal(validation.priceSchema.parse({ fee: '9999999999.99' }).fee, '9999999999.99');
  assert.equal(createOrderSchema.safeParse({ ...input(), deliveryFee: '0' }).success, false);
  assert.equal(createOrderSchema.safeParse({ ...input(), deliveryProviderId: undefined }).success, false);
});
test('server snapshots fixed fees independently of COD and weight and retains history', async () => {
  active = covered = true; fee = '3500.00'; writes = [];
  const first = await service.createOrder(owner, createOrderSchema.parse(input()));
  const heavy = await service.createOrder(owner, createOrderSchema.parse({ ...input(), parcelWeight: 999 }));
  assert.equal(first.deliveryFee, '3500.00'); assert.equal(heavy.deliveryFee, first.deliveryFee);
  assert.equal(first.codAmount, '5000'); assert.equal(first.status, 'CREATED');
  assert.equal(first.destinationCity, 'yangon'); assert.equal(first.deliveryProviderId, id);
  fee = '4500.25';
  assert.equal((await service.createOrder(owner, createOrderSchema.parse(input()))).deliveryFee, '4500.25');
  assert.equal(writes[0].deliveryFee.toFixed(2), '3500.00');
});
test('missing SME profile name is rejected without substituting recipient identity', async () => {
  users.getProfile = async () => ({ id: owner, role: 'SME', fullName: null });
  await assert.rejects(
    () => service.createOrder(owner, createOrderSchema.parse(input())),
    error => error.code === 'VALIDATION_ERROR' && /profile name/i.test(error.message),
  );
  assert.equal(writes.length, 3);
  users.getProfile = async () => ({ id: owner, role: 'SME', fullName: 'Test Shop' });
});
test('inactive provider and unsupported city reject creation before writes', async () => {
  const count = writes.length;
  active = false; covered = true;
  await assert.rejects(() => service.createOrder(owner, createOrderSchema.parse(input())), e => e.code === 'PROVIDER_CITY_UNAVAILABLE');
  active = true; covered = false;
  await assert.rejects(() => service.createOrder(owner, createOrderSchema.parse(input())), e => e.code === 'PROVIDER_CITY_UNAVAILABLE');
  assert.equal(writes.length, count); covered = true;
});
test('serialization conflicts retry from current price with a bounded conflict response', async () => {
  const { isTransactionConflict } = require('../dist/lib/errors/transaction-conflict');
  assert.equal(isTransactionConflict({ name: 'DriverAdapterError', cause: { kind: 'TransactionWriteConflict' } }), true);
  assert.equal(isTransactionConflict(new Error('TransactionWriteConflict')), false);
  failures = 2; fee = '999.99';
  assert.equal((await service.createOrder(owner, createOrderSchema.parse(input()))).deliveryFee, fee);
  failures = 5;
  await assert.rejects(() => service.createOrder(owner, createOrderSchema.parse(input())), e => e.code === 'PRICING_CONFLICT');
  failures = 0;
});
test('SME discovery has safe fields, distinct provider fees and a real empty state', async () => {
  repo.available = async city => city === 'yangon' ? [{ id, name: 'One', cityPrices: [{ fee: new Prisma.Decimal('3500') }] }, { id: randomUUID(), name: 'Two', cityPrices: [{ fee: new Prisma.Decimal('4000.25') }] }] : [];
  const result = await providers.available({ id: owner, role: 'SME' }, 'yangon');
  assert.deepEqual(result.providers.map(p => p.deliveryFee), ['3500.00', '4000.25']);
  assert.deepEqual(Object.keys(result.providers[0]).sort(), ['currency', 'deliveryFee', 'id', 'name']);
  assert.deepEqual((await providers.available({ id: owner, role: 'SME' }, 'unknown')).providers, []);
});
