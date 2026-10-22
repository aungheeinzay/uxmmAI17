// HTTP/controller/service/repository behavior with in-memory doubles.
// These tests do NOT prove PostgreSQL constraints or migration behavior.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const { prisma } = require('../dist/config/prisma');
const auth = require('../dist/modules/auth/auth.repository');
const ids = { rider: randomUUID(), other: randomUUID(), sme: randomUUID(), operator: randomUUID(), provider: randomUUID(), assignment: randomUUID() };
const tokens = { RIDER: 'R'.repeat(43), OTHER: 'Q'.repeat(43), SME: 'S'.repeat(43), OPERATOR: 'O'.repeat(43) };
auth.findSession = async hash => {
  const key = Object.keys(tokens).find(key => createHash('sha256').update(tokens[key]).digest('hex') === hash);
  if (!key) return null;
  return { accessExpiresAt: new Date(Date.now() + 60000), account: {
    id: ids[{ RIDER: 'rider', OTHER: 'other', SME: 'sme', OPERATOR: 'operator' }[key]],
    emailVerifiedAt: new Date(), email: 'test@example.invalid', profile: { role: key === 'OTHER' ? 'RIDER' : key },
  } };
};
auth.revokeSession = async () => ({ count: 1 });

let profiles;
function profile(id, role, overrides = {}) {
  return { id, role, fullName: null, phone: null, providerId: ids.provider,
    provider: { id: ids.provider, name: 'Fictional Provider' },
    account: { email: `${role.toLowerCase()}@example.invalid`, emailVerifiedAt: new Date() },
    riderProfile: null, ...overrides };
}
function nextRider() {
  return profile(ids.rider, 'RIDER');
}
function fresh() {
  profiles = new Map([
    [ids.rider, nextRider()],
    [ids.other, profile(ids.other, 'RIDER', { fullName: 'Other Rider', phone: '09-000-000', riderProfile: {
      vehicleType: 'BICYCLE', vehiclePlateNumber: null, vehicleModel: null, vehicleColor: null, completedAt: new Date() } })],
    [ids.sme, profile(ids.sme, 'SME')],
    [ids.operator, profile(ids.operator, 'OPERATOR')],
  ]);
}
prisma.profile.findUnique = async args => profiles.get(args.where.id) ?? null;
prisma.$transaction = async work => {
  if (Array.isArray(work)) return Promise.all(work);
  return work({
    profile: {
      findUnique: async args => profiles.get(args.where.id) ?? null,
      update: async args => { const row = profiles.get(args.where.id); Object.assign(row, args.data); return row; },
    },
    riderProfile: {
      upsert: async args => {
        const row = profiles.get(args.where.profileId);
        row.riderProfile = { ...(row.riderProfile ?? {}), ...args.create, ...args.update };
        return row.riderProfile;
      },
    },
  });
};
prisma.riderAssignment.findMany = async () => [];
prisma.riderAssignment.count = async () => 0;
prisma.parcelOrder.groupBy = async () => [];

beforeEach(fresh);
const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
async function request(path, role = 'RIDER', method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
const getProfile = (role = 'RIDER') => request('/api/rider/profile', role);
const save = (body, role = 'RIDER') => request('/api/rider/profile', role, 'PATCH', body);
const valid = { fullName: 'Example Rider', phone: '09 123 456 789', vehicleType: 'MOTORCYCLE', vehiclePlateNumber: 'abc-123' };

test('newly activated Rider with missing fields is incomplete', async () => {
  const result = await getProfile();
  assert.equal(result.status, 200);
  assert.equal(result.cache, 'no-store');
  assert.equal(result.body.data.profileComplete, false);
  assert.deepEqual(result.body.data.missingFields, ['fullName', 'phone', 'vehicleType']);
  assert.deepEqual(result.body.data.vehicle, { type: null, plateNumber: null, model: null, color: null });
});

test('missing full name, phone or vehicle type prevents completion', async () => {
  profiles.get(ids.rider).phone = '09 123 456 789';
  profiles.get(ids.rider).riderProfile = { vehicleType: 'MOTORCYCLE', vehiclePlateNumber: 'ABC-123', vehicleModel: null, vehicleColor: null, completedAt: null };
  assert.deepEqual((await getProfile()).body.data.missingFields, ['fullName']);
  fresh();
  profiles.get(ids.rider).fullName = 'Example Rider';
  profiles.get(ids.rider).riderProfile = { vehicleType: 'MOTORCYCLE', vehiclePlateNumber: 'ABC-123', vehicleModel: null, vehicleColor: null, completedAt: null };
  assert.deepEqual((await getProfile()).body.data.missingFields, ['phone']);
  fresh();
  profiles.get(ids.rider).fullName = 'Example Rider';
  profiles.get(ids.rider).phone = '09 123 456 789';
  assert.deepEqual((await getProfile()).body.data.missingFields, ['vehicleType']);
  assert.equal((await save({ ...valid, fullName: '' })).status, 400);
  assert.equal((await save({ ...valid, phone: '   ' })).status, 400);
  assert.equal((await save({ fullName: 'Example Rider', phone: '09 123 456 789' })).status, 400);
});

test('plate is required for motor vehicles and not for bicycle or on foot', async () => {
  for (const vehicleType of ['MOTORCYCLE', 'CAR', 'VAN']) {
    assert.equal((await save({ ...valid, vehicleType, vehiclePlateNumber: undefined })).status, 400, vehicleType);
  }
  for (const vehicleType of ['BICYCLE', 'ON_FOOT']) {
    const result = await save({ ...valid, vehicleType, vehiclePlateNumber: undefined });
    assert.equal(result.status, 200, vehicleType);
    assert.equal(result.body.data.profileComplete, true);
    assert.equal(result.body.data.vehicle.plateNumber, null);
  }
});

test('optional model and color do not block completion and valid data is persisted', async () => {
  const result = await save(valid);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.profileComplete, true);
  assert.deepEqual(result.body.data.missingFields, []);
  assert.equal(result.body.data.vehicle.plateNumber, 'ABC-123');
  assert.equal(result.body.data.vehicle.model, null);
  assert.equal(result.body.data.vehicle.color, null);
  assert.ok(result.body.data.completedAt);
  assert.equal(profiles.get(ids.rider).fullName, 'Example Rider');
  assert.equal(profiles.get(ids.rider).phone, '09 123 456 789');
  assert.equal(profiles.get(ids.rider).riderProfile.vehicleType, 'MOTORCYCLE');
});

test('completedAt is server-managed, stable while complete and cleared when provider membership is missing', async () => {
  const first = await save(valid);
  const completedAt = first.body.data.completedAt;
  const second = await save({ ...valid, vehicleModel: 'Honda Wave', vehicleColor: 'Blue' });
  assert.equal(second.body.data.completedAt, completedAt);
  assert.equal(second.body.data.vehicle.model, 'Honda Wave');
  assert.equal(second.body.data.vehicle.color, 'Blue');
  profiles.get(ids.rider).providerId = null;
  const incomplete = await save(valid);
  assert.equal(incomplete.body.data.profileComplete, false);
  assert.equal(incomplete.body.data.completedAt, null);
  assert.deepEqual(incomplete.body.data.missingFields, ['provider']);
});

test('Rider can update their own profile but cannot submit identity, role or provider overrides', async () => {
  assert.equal((await save(valid)).status, 200);
  assert.equal((await save({ ...valid, fullName: 'Updated Rider' })).body.data.fullName, 'Updated Rider');
  for (const extra of [{ id: ids.other }, { profileId: ids.other }, { riderId: ids.other }, { role: 'OPERATOR' }, { providerId: randomUUID() }, { completedAt: new Date().toISOString() }, { profileComplete: true }]) {
    assert.equal((await save({ ...valid, ...extra })).status, 400, JSON.stringify(extra));
  }
  assert.equal(profiles.get(ids.rider).fullName, 'Updated Rider');
});

test('missing provider membership is a distinct actionable setup state', async () => {
  profiles.get(ids.rider).providerId = null;
  profiles.get(ids.rider).provider = null;
  profiles.get(ids.rider).fullName = 'Example Rider';
  profiles.get(ids.rider).phone = '09 123 456 789';
  profiles.get(ids.rider).riderProfile = { vehicleType: 'BICYCLE', vehiclePlateNumber: null, vehicleModel: null, vehicleColor: null, completedAt: null };
  const result = await getProfile();
  assert.equal(result.body.data.profileComplete, false);
  assert.deepEqual(result.body.data.missingFields, ['provider']);
  assert.equal(result.body.data.provider, null);
  const blocked = await request('/api/rider/assignments');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, 'RIDER_PROVIDER_MEMBERSHIP_REQUIRED');
});

test('incomplete Rider can read/save profile and log out but cannot use delivery APIs', async () => {
  assert.equal((await getProfile()).status, 200);
  assert.equal((await request('/api/auth/logout', 'RIDER', 'POST', {})).status, 200);
  for (const [path, method, body] of [
    ['/api/rider/assignments', 'GET', undefined],
    [`/api/rider/assignments/${ids.assignment}`, 'GET', undefined],
    [`/api/rider/assignments/${ids.assignment}/status`, 'PATCH', { status: 'IN_TRANSIT' }],
  ]) {
    const result = await request(path, 'RIDER', method, body);
    assert.equal(result.status, 403, path);
    assert.equal(result.body.error.code, 'RIDER_PROFILE_INCOMPLETE', path);
    assert.match(result.body.error.message, /Complete your Rider profile/);
  }
});

test('completed Rider can access delivery APIs and ownership still applies', async () => {
  assert.equal((await save(valid)).status, 200);
  const list = await request('/api/rider/assignments');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data.assignments, []);
  const other = await save({ ...valid, fullName: 'Other Updated' }, 'OTHER');
  assert.equal(other.status, 200);
  assert.equal(other.body.data.fullName, 'Other Updated');
  assert.equal(profiles.get(ids.other).fullName, 'Other Updated');
  assert.equal(profiles.get(ids.rider).fullName, 'Example Rider');
});

test('SME and OPERATOR cannot use Rider profile APIs', async () => {
  for (const role of ['SME', 'OPERATOR']) {
    assert.equal((await getProfile(role)).status, 403);
    assert.equal((await save(valid, role)).status, 403);
  }
  assert.equal((await getProfile('NONE')).status, 401);
});

test('profile update rejects untrusted or malformed values', async () => {
  for (const body of [
    { ...valid, fullName: 'x'.repeat(121) },
    { ...valid, phone: 'x'.repeat(33) },
    { ...valid, vehicleType: 'TRUCK' },
    { ...valid, vehicleModel: 'x'.repeat(121) },
    { ...valid, vehicleColor: 'x'.repeat(65) },
    { ...valid, vehiclePlateNumber: 'x'.repeat(33) },
    {},
  ]) assert.equal((await save(body)).status, 400);
  assert.equal((await request('/api/rider/profile', 'RIDER', 'GET')).body.data.fullName, null);
});
