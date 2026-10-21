const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { seedSettings, seedOrders } = require('../dist/seed/orders.seed');
const safe = { NODE_ENV: 'test', SEED_DATABASE_URL: 'postgresql://test:test@localhost:5432/parcelops_test',
  ALLOW_DEV_SEED: 'true', SEED_CONFIRM_TARGET: 'localhost:5432/parcelops_test',
  SEED_SME_ID: randomUUID(), SEED_OPERATOR_ID: randomUUID() };
test('seed refuses production, remote and ambiguous targets and requires explicit confirmation', () => {
  for (const override of [{ NODE_ENV: 'production' }, { NODE_ENV: undefined }, { ALLOW_DEV_SEED: undefined },
    { SEED_CONFIRM_TARGET: 'wrong' }, { SEED_DATABASE_URL: undefined }, { SEED_SME_ID: 'invalid' },
    { SEED_DATABASE_URL: 'postgresql://x:x@db.example.com/parcelops_test' },
    { SEED_DATABASE_URL: 'postgresql://x:x@localhost/production' },
    { SEED_DATABASE_URL: 'postgresql://x:x@localhost/parcelops_test?host=production.example.com' }]) {
    assert.throws(() => seedSettings({ ...safe, ...override }));
  }
  assert.equal(seedSettings(safe).target, safe.SEED_DATABASE_URL);
});
function fixture(role = 'SME', verified = true, active = true) {
  const records = new Map();
  const db = {
    profile: { findUnique: async args => { assert.equal(args.where.id, safe.SEED_SME_ID); return { role, account: verified ? { emailVerifiedAt: new Date() } : null }; } },
    account: { findUnique: async args => { assert.equal(args.where.id, safe.SEED_OPERATOR_ID); return { emailVerifiedAt: active ? new Date() : null, profile: { role: 'OPERATOR' } }; } },
    parcelOrder: { findUnique: async ({ where }) => records.get(where.orderCode) ?? null,
      create: async ({ data }) => { assert.ok(!records.has(data.orderCode)); records.set(data.orderCode, { id: randomUUID(), ...data }); } },
  };
  return { db, records };
}
test('seed requires a verified SME and verified Operator, never creates auth records or changes roles', async () => {
  for (const args of [['OPERATOR', true], ['RIDER', true], ['SME', false], ['SME', true, false]]) {
    const { db, records } = fixture(...args);
    await assert.rejects(seedOrders(db, seedSettings(safe)));
    assert.equal(records.size, 0);
  }
});
test('ten fictional valid fixtures are idempotent and modified operational records stay untouched', async () => {
  const { db, records } = fixture();
  assert.deepEqual(await seedOrders(db, seedSettings(safe)), { created: 10, skipped: 0 });
  for (const row of records.values()) {
    assert.equal(row.ownerId, safe.SEED_SME_ID);
    assert.equal(row.operatorId, safe.SEED_OPERATOR_ID);
    assert.match(row.orderCode, /^PO[0-9A-F]{16}$/);
    assert.match(row.qrIdentifier, /^[a-f0-9]{64}$/);
    assert.match(row.phoneNumber, /^TEST-NOT-DIALABLE/);
    assert.ok(Number(row.parcelWeightKg) > 0); assert.ok(Number(row.codAmount) >= 0);
    assert.ok(['CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED'].includes(row.status));
  }
  const first = records.values().next().value;
  first.status = 'DELIVERED'; first.deliveryInstructions = 'Modified during testing';
  const snapshot = JSON.stringify([...records]);
  assert.deepEqual(await seedOrders(db, seedSettings(safe)), { created: 0, skipped: 10 });
  assert.equal(JSON.stringify([...records]), snapshot);
});
