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
users.getProfile = async () => ({ id: owner, role: 'SME' });
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
test('Swagger documents provider operations, authorization, required pricing and legacy nullability', () => {
  const { openApiDocument: spec } = require('../dist/config/swagger');
  assert.ok(spec.tags.some(tag => tag.name === 'Delivery Providers'));
  for (const [path, method] of [
    ['/api/delivery-providers', 'get'], ['/api/operator/delivery-providers', 'get'],
    ['/api/operator/delivery-providers', 'post'], ['/api/operator/delivery-providers/{id}', 'patch'],
    ['/api/operator/delivery-providers/{id}/city-prices/{city}', 'put'],
  ]) {
    const operation = spec.paths[path][method];
    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    for (const status of ['400', '401', '403']) assert.ok(operation.responses[status]);
  }
  const schemas = spec.components.schemas;
  for (const name of ['CreatedOrder', 'ListedOrder', 'OrderDetail', 'DashboardRecentOrder', 'OperatorOrder', 'AssignmentOrder']) {
    for (const field of ['destinationCity', 'deliveryProviderId', 'deliveryProvider', 'deliveryFee']) {
      assert.ok(schemas[name].required.includes(field), `${name}.${field} must be present`);
      assert.equal(schemas[name].properties[field].nullable, name !== 'CreatedOrder');
    }
  }
  assert.equal(schemas.UpdateProviderInput.minProperties, 1);
  assert.match(schemas.CityPriceInput.description, /9999999999\.99/);
  for (const field of ['destinationCity', 'deliveryProviderId']) assert.ok(schemas.CreateOrderInput.required.includes(field));
  assert.equal(schemas.CreateOrderInput.additionalProperties, false);
});
test('HTTP routes enforce authentication and SME/RIDER cannot manage pricing', async () => {
  const { app } = require('../dist/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const row = { id, name: 'Test Express', isActive: true, cityPrices: [], createdAt: new Date(), updatedAt: new Date() };
  repo.create = async data => ({ ...row, ...data }); repo.list = async () => [row];
  repo.putPrice = async (providerId, city, data) => ({ id: randomUUID(), providerId, city, ...data, fee: new Prisma.Decimal(data.fee) });
  async function call(path, method, role, body) {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${role}` } : {}) }, ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, body: await r.json() };
  }
  try {
    const routes = [['GET', '/api/operator/delivery-providers'], ['POST', '/api/operator/delivery-providers'], ['PATCH', `/api/operator/delivery-providers/${id}`], ['PUT', `/api/operator/delivery-providers/${id}/city-prices/Yangon`]];
    for (const [method, path] of routes) {
      assert.equal((await call(path, method)).status, 401);
      for (const role of ['SME', 'RIDER']) assert.equal((await call(path, method, role, {})).status, 403);
    }
    const created = await call('/api/operator/delivery-providers', 'POST', 'OPERATOR', { name: 'New Express' });
    assert.equal(created.status, 201); assert.equal(created.body.data.name, 'New Express');
    const price = await call(`/api/operator/delivery-providers/${id}/city-prices/%20YANGON%20`, 'PUT', 'OPERATOR', { fee: '3500.00' });
    assert.equal(price.status, 200); assert.equal(price.body.data.city, 'yangon'); assert.equal(price.body.data.fee, '3500.00');
    assert.equal((await call('/api/delivery-providers?city=Yangon', 'GET')).status, 401);
    for (const role of ['OPERATOR', 'RIDER']) assert.equal((await call('/api/delivery-providers?city=Yangon', 'GET', role)).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
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
test('service management permissions and uniqueness errors are stable', async () => {
  for (const role of ['SME', 'RIDER']) {
    const actor = { id: owner, role };
    for (const work of [() => providers.list(actor), () => providers.create(actor, { name: 'X' }), () => providers.update(actor, id, { isActive: false }), () => providers.putPrice(actor, id, 'yangon', { fee: '1' })]) await assert.rejects(work, e => e.status === 403);
  }
  repo.create = async () => { throw { code: 'P2002' }; };
  await assert.rejects(() => providers.create({ id: owner, role: 'OPERATOR' }, { name: 'X' }), e => e.status === 409);
});
test('SME discovery has safe fields, distinct provider fees and a real empty state', async () => {
  repo.available = async city => city === 'yangon' ? [{ id, name: 'One', cityPrices: [{ fee: new Prisma.Decimal('3500') }] }, { id: randomUUID(), name: 'Two', cityPrices: [{ fee: new Prisma.Decimal('4000.25') }] }] : [];
  const result = await providers.available({ id: owner, role: 'SME' }, 'yangon');
  assert.deepEqual(result.providers.map(p => p.deliveryFee), ['3500.00', '4000.25']);
  assert.deepEqual(Object.keys(result.providers[0]).sort(), ['currency', 'deliveryFee', 'id', 'name']);
  assert.deepEqual((await providers.available({ id: owner, role: 'SME' }, 'unknown')).providers, []);
});
