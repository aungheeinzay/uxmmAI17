const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash, randomBytes } = require('node:crypto');
test('provider Rider management, invitation activation, workload and assignment isolation on development PostgreSQL', {
  skip: process.env.PARCELOPS_RIDER_MANAGEMENT_DB_TEST !== 'confirmed', timeout: 120000,
}, async () => {
  require('dotenv').config({ quiet: true });
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.equal(new URL(process.env.DATABASE_URL).hostname, process.env.PARCELOPS_RIDER_MANAGEMENT_DB_HOST);
  const { prisma } = require('../dist/config/prisma');
  const management = require('../dist/modules/riders/management/rider-management.service');
  const assignments = require('../dist/modules/assignments/assignment.service');
  const auth = require('../dist/modules/auth/auth.service');
  const authPassword = require('../dist/modules/auth/auth.password');
  const riderProfile = require('../dist/modules/riders/profile/rider-profile.service');
  const sent = [];
  require('../dist/lib/email/email.service').sendRiderInvitationEmail = async (email, token) => sent.push({ email, token });
  const invitations = require('../dist/modules/riders/rider.service');
  const prefix = `rider-management-${randomUUID()}`;
  const providerA = randomUUID(), providerB = randomUUID();
  const ids = { operator: randomUUID(), otherOperator: randomUUID(), unconfigured: randomUUID(), rider: randomUUID(), waiting: randomUUID(), available: randomUUID(), otherRider: randomUUID(), legacyRider: randomUUID(), unverified: randomUUID(), sme: randomUUID() };
  const actor = { id: ids.operator, role: 'OPERATOR' };
  const query = { page: 1, pageSize: 100 };
  const orderIds = [];
  async function order(status, riderId, providerId = providerA) {
    const id = randomUUID(); orderIds.push(id);
    await prisma.parcelOrder.create({ data: { id, orderCode: `PO${id.replaceAll('-', '').slice(0, 16).toUpperCase()}`, qrIdentifier: id.replaceAll('-', '').repeat(2), ownerId: ids.sme, operatorId: ids.operator,
      deliveryProviderId: providerId, destinationCity: 'yangon', deliveryFee: '3500', recipientName: 'Fictional Management Recipient', phoneNumber: '09999999999', township: 'Tamwe', deliveryAddress: 'Fictional test address', senderName: 'Fictional Shop', parcelWeightKg: '1', codAmount: '0', status } });
    if (riderId) await prisma.riderAssignment.create({ data: { orderId: id, riderId, assignedById: ids.operator } });
    return id;
  }
  try {
    await prisma.deliveryProvider.createMany({ data: [{ id: providerA, name: `${prefix}-A` }, { id: providerB, name: `${prefix}-B` }] });
    for (const [name, id] of Object.entries(ids)) {
      const role = name === 'sme' ? 'SME' : ['operator', 'otherOperator', 'unconfigured'].includes(name) ? 'OPERATOR' : 'RIDER';
      const providerId = role === 'SME' || ['unconfigured', 'legacyRider'].includes(name) ? null : ['otherOperator', 'otherRider'].includes(name) ? providerB : providerA;
      await prisma.account.create({ data: { email: `${prefix}-${name.toLowerCase()}@example.test`, passwordHash: 'unusable-fixture-hash', emailVerifiedAt: name === 'unverified' ? null : new Date(), profile: { create: { id, role, providerId, fullName: `Fictional ${name}` } } } });
    }
    for (const status of ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED']) await order(status, ids.rider);
    await order('PICKED_UP', ids.waiting);
    await order('IN_TRANSIT', ids.otherRider, providerB);
    // A historical cross-provider assignment is deliberately excluded from management counts.
    await order('DELIVERED', ids.rider, providerB);
    const list = await management.list(actor, query);
    assert.equal(list.pagination.total, 4);
    assert.equal(list.riders.some(row => [ids.otherRider, ids.legacyRider].includes(row.id)), false);
    const rider = list.riders.find(row => row.id === ids.rider);
    assert.equal(rider.workload, 'DELIVERING'); assert.equal(rider.assignedTaskCount, 1); assert.equal(rider.inProgressDeliveryCount, 2); assert.equal(rider.activeAssignedTaskCount, 3); assert.equal(rider.completedDeliveryCount, 1);
    assert.equal(list.riders.find(row => row.id === ids.waiting).workload, 'HAS_ASSIGNED_TASKS');
    assert.equal(list.riders.find(row => row.id === ids.available).workload, 'AVAILABLE');
    assert.equal(list.riders.find(row => row.id === ids.unverified).accountStatus, 'UNVERIFIED');
    assert.equal((await management.list(actor, { ...query, eligible: 'true' })).pagination.total, 3);
    assert.deepEqual(await management.overview(actor), { totalRiders: 4, available: 2, assigned: 1, delivering: 1, inactive: 0 });
    assert.equal((await management.list(actor, { ...query, workload: 'DELIVERING' })).riders.length, 1);
    assert.equal((await management.list(actor, { ...query, search: 'waiting' })).riders[0].id, ids.waiting);
    const detail = await management.detail(actor, ids.rider, query);
    assert.equal(detail.pagination.total, 6);
    await assert.rejects(() => management.detail(actor, ids.otherRider, query), error => error.status === 404);
    await assert.rejects(() => management.list({ id: ids.unconfigured, role: 'OPERATOR' }, query), error => error.code === 'PROVIDER_MEMBERSHIP_REQUIRED');
    const availableOrder = await order('PICKED_UP');
    await assert.rejects(() => assignments.assignParcel(actor, { orderId: availableOrder, riderId: ids.otherRider }), error => error.code === 'RIDER_NOT_ELIGIBLE');
    await assert.rejects(() => assignments.assignParcel(actor, { orderId: availableOrder, riderId: ids.legacyRider }), error => error.code === 'RIDER_NOT_ELIGIBLE');
    const foreignOrder = await order('PICKED_UP', null, providerB);
    await assert.rejects(() => assignments.assignParcel(actor, { orderId: foreignOrder, riderId: ids.rider }), error => error.code === 'ORDER_NOT_FOUND');
    // Delivering is not a capacity restriction.
    const assigned = await assignments.assignParcel(actor, { orderId: availableOrder, riderId: ids.rider });
    await assert.rejects(() => assignments.riderAssignment({ id: ids.otherRider, role: 'RIDER' }, assigned.id), error => error.status === 404);
    const email = `${prefix}-invited@example.test`;
    await invitations.inviteRider(actor, { email, fullName: 'Fictional Invited' });
    assert.equal((await management.invitations(actor, query)).pagination.total, 1);
    assert.equal((await prisma.riderInvitation.findUnique({ where: { email } })).providerId, providerA);
    await prisma.riderInvitation.update({ where: { email }, data: { expiresAt: new Date(0) } });
    await assert.rejects(() => invitations.inviteRider({ id: ids.otherOperator, role: 'OPERATOR' }, { email }), error => error.code === 'RIDER_INVITATION_CONFLICT');
    assert.equal((await prisma.riderInvitation.findUnique({ where: { email } })).providerId, providerA);
    await prisma.riderInvitation.update({ where: { email }, data: { expiresAt: new Date(Date.now() + 86400000) } });
    await prisma.profile.update({ where: { id: ids.operator }, data: { providerId: providerB } });
    await invitations.activateRider({ token: sent[0].token, password: 'fictional-activation-password' });
    const activated = await prisma.account.findUnique({ where: { email }, include: { profile: true } });
    assert.equal(activated.profile.providerId, providerA); assert.equal(activated.profile.role, 'RIDER');
    await prisma.profile.update({ where: { id: ids.operator }, data: { providerId: providerA } });
    assert.equal((await management.invitations(actor, query)).pagination.total, 0);
    assert.equal((await management.overview(actor)).totalRiders, 5);
    await assert.rejects(() => invitations.inviteRider({ id: ids.unconfigured, role: 'OPERATOR' }, { email: `${prefix}-missing@example.test` }), error => error.code === 'PROVIDER_MEMBERSHIP_REQUIRED');
    // Active work blocks deactivation without changing assignments or order status.
    await assert.rejects(() => management.deactivate(actor, ids.rider), error => error.code === 'RIDER_HAS_ACTIVE_ASSIGNMENTS');
    assert.equal(await prisma.riderAssignment.count({ where: { riderId: ids.rider } }), 8);
    assert.equal(await prisma.parcelOrder.count({ where: { id: { in: orderIds }, status: { in: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] } } }), 7);
    // A completed delivery is retained through deactivation and reactivation.
    const historyOrder = await order('DELIVERED', ids.available);
    const historyBefore = await management.detail(actor, ids.available, query);
    assert.equal(historyBefore.pagination.total, 1);
    const access = randomBytes(32).toString('base64url');
    await prisma.authSession.create({ data: { accountId: ids.available,
      accessHash: createHash('sha256').update(access).digest('hex'), refreshHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      accessExpiresAt: new Date(Date.now() + 900000), refreshExpiresAt: new Date(Date.now() + 86400000) } });
    assert.equal((await auth.authenticate(access)).id, ids.available);
    const deactivated = await management.deactivate(actor, ids.available);
    assert.equal(deactivated.rider.isActive, false); assert.ok(deactivated.rider.deactivatedAt);
    assert.equal(await prisma.profile.findUnique({ where: { id: ids.available } }).then(row => row.deactivatedAt !== null), true);
    assert.equal(await prisma.authSession.count({ where: { accountId: ids.available } }), 0);
    await assert.rejects(() => auth.authenticate(access), error => error.status === 401);
    const password = 'fictional-lifecycle-password';
    await prisma.account.update({ where: { id: ids.available }, data: { passwordHash: await authPassword.hashPassword(password) } });
    await assert.rejects(() => auth.login({ email: `${prefix}-available@example.test`, password }), error => error.code === 'ACCOUNT_DEACTIVATED');
    await assert.rejects(() => management.deactivate({ id: ids.otherOperator, role: 'OPERATOR' }, ids.available), error => error.status === 404);
    const repeated = await management.deactivate(actor, ids.available);
    assert.equal(repeated.rider.deactivatedAt, deactivated.rider.deactivatedAt);
    const inactive = await management.list(actor, { ...query, status: 'INACTIVE' });
    assert.deepEqual(inactive.riders.map(row => row.id), [ids.available]);
    assert.equal((await management.list(actor, { ...query, workload: 'AVAILABLE' })).riders.some(row => row.id === ids.available), false);
    assert.equal((await management.overview(actor)).inactive, 1);
    const historyDuring = await management.detail(actor, ids.available, query);
    assert.equal(historyDuring.pagination.total, 1); assert.equal(historyDuring.assignments[0].id, historyBefore.assignments[0].id);
    assert.equal(await prisma.parcelOrder.findUnique({ where: { id: historyOrder } }).then(row => row.status), 'DELIVERED');
    // Reactivation restores login/eligibility without bypassing profile completion.
    const reactivated = await management.reactivate(actor, ids.available);
    assert.equal(reactivated.rider.isActive, true); assert.equal(reactivated.rider.deactivatedAt, null);
    assert.equal((await management.overview(actor)).inactive, 0);
    assert.equal(await prisma.profile.findUnique({ where: { id: ids.available } }).then(row => row.deactivatedAt), null);
    await assert.rejects(() => riderProfile.assertRiderProfileComplete(ids.available), error => error.code === 'RIDER_PROFILE_INCOMPLETE');
    const login = await auth.login({ email: `${prefix}-available@example.test`, password });
    assert.ok(login.accessToken);
    const reactivatedOrder = await order('PICKED_UP');
    await assignments.assignParcel(actor, { orderId: reactivatedOrder, riderId: ids.available });
    const historyAfter = await management.detail(actor, ids.available, query);
    assert.equal(historyAfter.assignments.some(task => task.orderId === historyOrder), true);
    const repeatedReactivate = await management.reactivate(actor, ids.available);
    assert.equal(repeatedReactivate.rider.deactivatedAt, null);
    await assert.rejects(() => management.reactivate({ id: ids.otherOperator, role: 'OPERATOR' }, ids.available), error => error.status === 404);
  } finally {
    await prisma.orderStatusEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.riderAssignment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.parcelOrder.deleteMany({ where: { id: { in: orderIds }, ownerId: ids.sme } });
    await prisma.riderInvitation.deleteMany({ where: { email: { startsWith: prefix } } });
    const fixtureAccounts = await prisma.account.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } });
    const profileIds = fixtureAccounts.map(row => row.id);
    await prisma.account.deleteMany({ where: { id: { in: profileIds } } });
    await prisma.profile.deleteMany({ where: { id: { in: profileIds } } });
    await prisma.deliveryProvider.deleteMany({ where: { id: { in: [providerA, providerB] } } });
    await prisma.$disconnect();
  }
});
