const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { Prisma } = require('../dist/generated/prisma/client');
const { prisma } = require('../dist/config/prisma');
const auth = require('../dist/modules/auth/auth.service');
const repo = require('../dist/modules/providers/provider.repository');
const service = require('../dist/modules/providers/provider.service');
const userRepo = require('../dist/modules/users/user.repository');
const userService = require('../dist/modules/users/user.service');
const id = randomUUID(), other = randomUUID(), operator = randomUUID(), priceId = randomUUID();
const actor = { id: operator, role: 'OPERATOR' };
const row = () => ({ id: priceId, providerId: id, city: 'yangon', fee: new Prisma.Decimal('3500'), isActive: true, createdAt: new Date(), updatedAt: new Date() });
let configured = true, persistedRole = 'OPERATOR', written = [], duplicate = false;
repo.transaction = async work => work({});
repo.membership = async (_tx, profileId) => { assert.equal(profileId, operator); return { role: persistedRole, providerId: configured ? id : null, provider: configured ? { id, name: 'Flash Deliver', isActive: true, cityPrices: [row()] } : null }; };
repo.createPrice = async (_tx, providerId, input) => {
  if (duplicate) throw { code: 'P2002' };
  written.push({ providerId, input }); return { ...row(), ...input, providerId, fee: new Prisma.Decimal(input.fee) };
};
repo.updatePrice = async (_tx, providerId, targetId, input) => {
  written.push({ providerId, priceId: targetId, input });
  if (targetId !== priceId) return null;
  return { ...row(), ...input, fee: new Prisma.Decimal(input.fee ?? '3500') };
};
auth.authenticate = async role => ({ id: operator, role });
const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(r => server.close(r)); await prisma.$disconnect(); });
async function call(method, path, role = 'OPERATOR', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${role}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
test('new routes require authentication and OPERATOR roles', async () => {
  for (const [method, path, body] of [['GET', '/api/operator/my-provider'], ['GET', '/api/operator/my-provider/city-prices'], ['POST', '/api/operator/my-provider/city-prices', { city: 'Yangon', fee: '1' }], ['PATCH', `/api/operator/my-provider/city-prices/${priceId}`, { isActive: false }]]) {
    assert.equal((await call(method, path, null, body)).status, 401);
    for (const role of ['SME', 'RIDER']) assert.equal((await call(method, path, role, body)).status, 403);
  }
});
test('Operator cannot create, rename or deactivate providers through old routes', async () => {
  for (const [method, path, body] of [['POST', '/api/operator/delivery-providers', { name: 'Bad' }], ['PATCH', `/api/operator/delivery-providers/${other}`, { name: 'Bad', isActive: false }], ['PUT', `/api/operator/delivery-providers/${other}/city-prices/yangon`, { fee: '0' }]]) {
    assert.equal((await call(method, path, 'OPERATOR', body)).status, 404);
  }
  assert.equal(service.create, undefined); assert.equal(service.update, undefined);
});
test('membership is persisted, missing membership is actionable and never mutates', async () => {
  const result = await call('GET', '/api/operator/my-provider');
  assert.equal(result.body.data.provider.name, 'Flash Deliver');
  assert.equal(result.body.data.provider.cityPrices[0].fee, '3500.00');
  configured = false; const count = written.length;
  assert.deepEqual((await call('GET', '/api/operator/my-provider')).body.data, { provider: null });
  for (const work of [() => service.createPrice(actor, { city: 'yangon', fee: '1' }), () => service.updatePrice(actor, priceId, { isActive: false }), () => service.cityPrices(actor)]) {
    await assert.rejects(work, e => e.status === 409 && e.code === 'PROVIDER_MEMBERSHIP_REQUIRED');
  }
  assert.equal(written.length, count); configured = true;
  persistedRole = 'SME'; await assert.rejects(() => service.myProvider(actor), e => e.status === 403); persistedRole = 'OPERATOR';
});
test('add, edit and toggle pricing only for persisted provider; cross-provider ids are hidden', async () => {
  const created = await call('POST', '/api/operator/my-provider/city-prices', 'OPERATOR', { city: ' YANGON ', fee: '4000.25' });
  assert.equal(created.status, 201); assert.equal(created.body.data.providerId, id); assert.equal(created.body.data.city, 'yangon');
  assert.equal(written.at(-1).providerId, id);
  for (const input of [{ fee: '4500.25' }, { isActive: false }, { isActive: true }]) {
    const changed = await call('PATCH', `/api/operator/my-provider/city-prices/${priceId}`, 'OPERATOR', input);
    assert.equal(changed.status, 200); assert.equal(written.at(-1).providerId, id);
  }
  assert.equal((await call('PATCH', `/api/operator/my-provider/city-prices/${other}`, 'OPERATOR', { fee: '0' })).status, 404);
  for (const body of [{ city: 'Yangon', fee: '1', providerId: other }, { city: 'Yangon', fee: '-1' }]) assert.equal((await call('POST', '/api/operator/my-provider/city-prices', 'OPERATOR', body)).status, 400);
  assert.equal((await call('PATCH', `/api/operator/my-provider/city-prices/${priceId}`, 'OPERATOR', {})).status, 400);
  duplicate = true;
  const conflict = await call('POST', '/api/operator/my-provider/city-prices', 'OPERATOR', { city: 'Yangon', fee: '1' });
  assert.equal(conflict.status, 409); assert.equal(conflict.body.error.code, 'CITY_PRICE_CONFLICT'); duplicate = false;
});
test('profile exposes safe read-only membership and rejects membership escalation', async () => {
  const profile = { id: operator, role: 'OPERATOR', providerId: id, fullName: 'Operator', phone: '123', provider: { id, name: 'Flash Deliver', isActive: true }, account: { email: 'operator@example.test' } };
  userRepo.findProfile = async () => profile;
  userRepo.updateProfile = async (_id, data) => ({ ...profile, ...data });
  const me = await call('GET', '/api/users/me');
  assert.equal(me.body.data.provider.name, 'Flash Deliver'); assert.equal(me.body.data.email, 'operator@example.test'); assert.equal(me.body.data.account, undefined);
  for (const input of [{ providerId: other }, { role: 'OPERATOR', fullName: 'X' }, { provider: { id: other } }]) assert.equal((await call('PATCH', '/api/users/me', 'OPERATOR', input)).status, 400);
  const saved = await userService.updateProfile(operator, { fullName: 'Changed', providerId: other });
  assert.equal(saved.providerId, id); assert.equal(saved.fullName, 'Changed');
});
test('repository updates filter by both price and provider IDs and Swagger has no catalog mutations', async () => {
  // Exercise real repository through its compiled export in a fresh module instance.
  const modulePath = require.resolve('../dist/modules/providers/provider.repository');
  delete require.cache[modulePath]; const actual = require(modulePath);
  let where, data;
  await actual.updatePrice({ deliveryCityPrice: { updateMany: async args => { where = args.where; data = args.data; return { count: 0 }; } } }, id, other, { isActive: false, providerId: other });
  assert.deepEqual(where, { id: other, providerId: id });
  assert.deepEqual(data, { isActive: false });
  const { openApiDocument: spec } = require('../dist/config/swagger');
  assert.equal(spec.paths['/api/operator/delivery-providers'], undefined);
  for (const obsolete of ['CreateProviderInput', 'UpdateProviderInput', 'DeliveryProviderAdmin']) assert.equal(spec.components.schemas[obsolete], undefined);
  const discoveryResponses = spec.paths['/api/delivery-providers'].get.responses;
  assert.equal(discoveryResponses[404], undefined);
  assert.equal(discoveryResponses[409], undefined);
  const pricingPaths = spec.paths['/api/operator/my-provider/city-prices'];
  assert.ok(pricingPaths.get.responses[409]);
  assert.ok(pricingPaths.post.responses[409]);
  assert.equal(pricingPaths.post.responses[404], undefined);
  assert.ok(spec.paths['/api/operator/my-provider/city-prices/{priceId}'].patch.responses[404]);
  for (const [path, method] of [['/api/operator/my-provider', 'get'], ['/api/operator/my-provider/city-prices', 'get'], ['/api/operator/my-provider/city-prices', 'post'], ['/api/operator/my-provider/city-prices/{priceId}', 'patch']]) assert.deepEqual(spec.paths[path][method].security, [{ bearerAuth: [] }]);
  assert.equal(spec.components.schemas.ProfileUpdate.additionalProperties, false);
});
