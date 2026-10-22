const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
test('provider pricing, snapshots and concurrency against confirmed development PostgreSQL', {
  skip: process.env.PARCELOPS_PRICING_DB_TEST !== 'confirmed', timeout: 120000,
}, async () => {
  require('dotenv').config({ quiet: true });
  assert.equal(new URL(process.env.DATABASE_URL).hostname, process.env.PARCELOPS_PRICING_DB_HOST);
  assert.notEqual(process.env.NODE_ENV, 'production');
  const { prisma } = require('../dist/config/prisma');
  const providers = require('../dist/modules/providers/provider.service');
  const orders = require('../dist/modules/orders/order.service');
  const { createOrderSchema } = require('../dist/modules/orders/order.validation');
  const operator = { id: randomUUID(), role: 'OPERATOR' }, sme = { id: randomUUID(), role: 'SME' };
  const providerIds = [randomUUID(), randomUUID()];
  const input = (providerId, city = 'Yangon', weight = 1) => createOrderSchema.parse({ operatorId: operator.id, deliveryProviderId: providerId, destinationCity: city, recipientName: 'Fictional Pricing Test', phoneNumber: '09999999999', township: 'Tamwe', deliveryAddress: 'Fictional address', senderName: 'Fictional Shop', parcelWeight: weight, codAmount: '10000' });
  try {
    await prisma.profile.createMany({ data: [operator, sme] });
    for (const id of providerIds) await prisma.deliveryProvider.create({ data: { id, name: `Pricing fixture ${id}` } });
    const [one, two] = providerIds;
    await providers.putPrice(operator, one, 'yangon', { fee: '3500' });
    await providers.putPrice(operator, two, 'yangon', { fee: '4000' });
    await providers.putPrice(operator, one, 'mandalay', { fee: '6000' });
    const eligible = await providers.available(sme, 'yangon');
    assert.deepEqual(eligible.providers.filter(p => providerIds.includes(p.id)).map(p => p.deliveryFee).sort(), ['3500.00', '4000.00']);
    assert.equal((await orders.createOrder(sme.id, input(one))).deliveryFee, '3500.00');
    assert.equal((await orders.createOrder(sme.id, input(one, 'Yangon', 999))).deliveryFee, '3500.00');
    assert.equal((await orders.createOrder(sme.id, input(one, 'Mandalay'))).deliveryFee, '6000.00');
    const first = await orders.createOrder(sme.id, input(one));
    await providers.putPrice(operator, one, 'yangon', { fee: '4500.25' });
    assert.equal((await orders.getOrder(sme.id, { kind: 'id', value: first.id })).deliveryFee, '3500.00');
    await assert.rejects(() => orders.getOrder(operator.id, { kind: 'id', value: first.id }), e => e.status === 404);
    await assert.rejects(() => orders.createOrder(sme.id, input(one, 'Unsupported')), e => e.code === 'PROVIDER_CITY_UNAVAILABLE');
    await providers.update(operator, one, { isActive: false });
    await assert.rejects(() => orders.createOrder(sme.id, input(one)), e => e.code === 'PROVIDER_CITY_UNAVAILABLE');
    assert.equal((await providers.available(sme, 'yangon')).providers.some(p => p.id === one), false);
    await providers.update(operator, one, { isActive: true });
    await providers.putPrice(operator, one, 'yangon', { fee: '4500.25', isActive: false });
    assert.equal((await providers.available(sme, 'yangon')).providers.some(p => p.id === one), false);
    await assert.rejects(() => orders.createOrder(sme.id, input(one)), e => e.code === 'PROVIDER_CITY_UNAVAILABLE');
    await providers.putPrice(operator, one, 'yangon', { fee: '4500.25', isActive: true });
    await Promise.all([providers.putPrice(operator, one, 'yangon', { fee: '4500.25' }), providers.putPrice(operator, one, 'yangon', { fee: '4500.25' })]);
    assert.equal(await prisma.deliveryCityPrice.count({ where: { providerId: one, city: 'yangon' } }), 1);
    // A concurrent write can serialize before or after creation, but cannot produce a mixed/unknown fee.
    const results = await Promise.allSettled([
      ...Array.from({ length: 4 }, () => orders.createOrder(sme.id, input(one))),
      providers.putPrice(operator, one, 'yangon', { fee: '5500.50' }),
    ]);
    for (const result of results.slice(0, 4)) {
      assert.equal(result.status, 'fulfilled', result.status === 'rejected' ? `${result.reason.code}: ${result.reason.message}` : undefined);
      assert.ok(['4500.25', '5500.50'].includes(result.value.deliveryFee));
      assert.equal(result.value.status, 'CREATED');
    }
    assert.equal(results[4].status, 'fulfilled');
    assert.equal((await prisma.parcelOrder.findUnique({ where: { id: first.id } })).deliveryFee.toFixed(2), '3500.00');
    console.log('Development pricing checks verified with isolated UUID fixtures; original business records untouched.');
  } finally {
    await prisma.parcelOrder.deleteMany({ where: { ownerId: sme.id, deliveryProviderId: { in: providerIds } } });
    await prisma.deliveryCityPrice.deleteMany({ where: { providerId: { in: providerIds } } });
    await prisma.deliveryProvider.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.profile.deleteMany({ where: { id: { in: [sme.id, operator.id] } } });
    await prisma.$disconnect();
  }
});
