const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { seedProviders, assignProvider, assignRiderProvider, setupTarget } = require('../dist/seed/providers.setup');
const operatorId = randomUUID(), providerId = randomUUID();

test('provider setup refuses production, unconfirmed and unapproved remote targets', () => {
  const env = { NODE_ENV: 'development', DATABASE_URL: 'postgresql://test:test@db.example:5432/postgres' };
  assert.throws(() => setupTarget({ ...env, NODE_ENV: 'production' }, 'db.example:5432/postgres', true));
  assert.throws(() => setupTarget(env, undefined, true));
  assert.throws(() => setupTarget(env, 'db.example:5432/postgres', false));
  assert.deepEqual(setupTarget(env, 'db.example:5432/postgres', true), { identity: 'db.example:5432/postgres' });
});
test('provider seed runs twice without duplicates or changes to existing provider data', async () => {
  const records = new Map([['Flash Deliver', { id: providerId, name: 'Flash Deliver', isActive: false, fee: '3500' }]]);
  const db = { deliveryProvider: { upsert: async args => {
    assert.deepEqual(args.update, {});
    if (!records.has(args.where.name)) records.set(args.where.name, { id: randomUUID(), name: args.create.name });
    const row = records.get(args.where.name); return { id: row.id, name: row.name };
  } } };
  for (let i = 0; i < 2; i++) await seedProviders(db, ['Flash Deliver', ' Ghost Deliver ', 'Flash Deliver']);
  assert.equal(records.size, 2); assert.equal(records.get('Flash Deliver').isActive, false); assert.equal(records.get('Flash Deliver').fee, '3500');
  await assert.rejects(() => seedProviders(db, []));
});
function fixture(role = 'OPERATOR', membership = null, exists = true, verified = true) {
  let writes = 0;
  const db = { $transaction: async (work, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    return work({
      profile: { findUnique: async args => { assert.equal(args.where.id, operatorId); return { id: operatorId, role, providerId: membership, account: { emailVerifiedAt: verified ? new Date() : null } }; },
        updateMany: async args => { assert.deepEqual(args.where, { id: operatorId, role, providerId: null }); assert.deepEqual(args.data, { providerId }); membership = providerId; writes++; return { count: 1 }; } },
      deliveryProvider: { findUnique: async () => exists ? { id: providerId, name: 'Flash Deliver' } : null },
    });
  } };
  return { db, writes: () => writes };
}
test('provisioning requires exact IDs, verified OPERATOR and an existing Provider', async () => {
  for (const role of ['SME', 'RIDER']) { const f = fixture(role); await assert.rejects(() => assignProvider(f.db, operatorId, providerId)); assert.equal(f.writes(), 0); }
  for (const f of [fixture('OPERATOR', null, false), fixture('OPERATOR', null, true, false)]) { await assert.rejects(() => assignProvider(f.db, operatorId, providerId)); assert.equal(f.writes(), 0); }
  await assert.rejects(() => assignProvider(fixture().db, '', providerId));
});
test('provisioning changes only selected membership and same-ID repeat is safe', async () => {
  const f = fixture();
  assert.equal((await assignProvider(f.db, operatorId, providerId)).changed, true);
  assert.equal((await assignProvider(f.db, operatorId, providerId)).changed, false);
  assert.equal(f.writes(), 1);
});
test('provisioning refuses existing membership reassignment', async () => {
  const f = fixture('OPERATOR', randomUUID());
  await assert.rejects(() => assignProvider(f.db, operatorId, providerId), /reassignment is refused/);
  assert.equal(f.writes(), 0);
});
test('Rider provisioning requires verified existing RIDER and explicit IDs and preserves repeat safety', async () => {
  const f = fixture('RIDER');
  assert.equal((await assignRiderProvider(f.db, operatorId, providerId)).changed, true);
  assert.equal((await assignRiderProvider(f.db, operatorId, providerId)).changed, false);
  await assert.rejects(() => assignRiderProvider(fixture('SME').db, operatorId, providerId));
  await assert.rejects(() => assignRiderProvider(fixture('OPERATOR').db, operatorId, providerId));
});
