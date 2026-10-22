const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');

const databaseUrl = process.env.TEST_DATABASE_URL;
test('rider invitations and concurrent activation against PostgreSQL', { skip: !databaseUrl, timeout: 180000 }, async t => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.FRONTEND_URL = 'https://frontend.example.com';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_USER = 'test'; process.env.SMTP_PASSWORD = 'test'; process.env.SMTP_FROM = 'test@example.com';
  const sent = [];
  let failEmail = false;
  require('nodemailer').createTransport = () => ({ sendMail: async message => {
    if (failEmail) throw new Error('mock provider failure');
    sent.push(message); return { accepted: [message.to] };
  } });
  const { prisma } = require('../dist/config/prisma');
  const service = require('../dist/modules/riders/rider.service');
  const repository = require('../dist/modules/riders/rider.repository');
  const auth = require('../dist/modules/auth/auth.service');
  const { hashPassword, verifyPassword } = require('../dist/modules/auth/auth.password');
  const prefix = `rider-test-${randomUUID()}-`;
  const providerId = randomUUID();
  const address = name => `${prefix}${name.toLowerCase()}@example.test`;
  const digest = token => createHash('sha256').update(token).digest('hex');
  const tokenFrom = message => {
    const url = new URL(message.text.match(/https:\/\/\S+/)[0]);
    assert.equal(url.origin, 'https://frontend.example.com');
    assert.equal(url.pathname, '/activate-rider'); assert.equal(url.search, '');
    return new URLSearchParams(url.hash.slice(1)).get('token');
  };
  const rejectsCode = (fn, code) => assert.rejects(fn, e => e.code === code);
  const password = 'rider-chosen-password';
  const passwordHash = await hashPassword(password);
  async function createAccount(name, role) {
    const id = randomUUID();
    return prisma.account.create({ data: {
      email: address(name), passwordHash, emailVerifiedAt: new Date(),
      profile: { create: { id, role, providerId: role === 'OPERATOR' ? providerId : null } },
    }, include: { profile: true } });
  }
  try {
    await prisma.deliveryProvider.create({ data: { id: providerId, name: `Invitation fixture ${providerId}` } });
    const operator = await createAccount('operator', 'OPERATOR');
    const actor = { id: operator.id, role: 'OPERATOR' };
    await t.test('pending invitation is persisted as a hash, with no active account', async () => {
      const result = await service.inviteRider(actor, { email: address('first').toUpperCase(), fullName: 'Invited Rider' });
      const invitation = await prisma.riderInvitation.findUnique({ where: { email: address('first') } });
      assert.equal(invitation.tokenHash, digest(tokenFrom(sent.at(-1))));
      assert.equal(invitation.invitedById, operator.id); assert.equal(invitation.acceptedAt, null);
      assert.ok(Math.abs(invitation.expiresAt.getTime() - Date.now() - 86400000) < 10000);
      assert.equal(await prisma.account.count({ where: { email: address('first') } }), 0);
      assert.ok(!JSON.stringify(result).includes(tokenFrom(sent.at(-1))));
      await rejectsCode(() => service.inviteRider(actor, { email: address('first') }), 'RIDER_INVITATION_CONFLICT');
    });
    await t.test('two concurrent invitations yield one pending invitation and one email', async () => {
      const before = sent.length;
      const results = await Promise.allSettled([service.inviteRider(actor, { email: address('concurrent') }), service.inviteRider(actor, { email: address('concurrent') })]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.code, 'RIDER_INVITATION_CONFLICT');
      assert.equal(sent.length, before + 1);
      assert.equal(await prisma.riderInvitation.count({ where: { email: address('concurrent') } }), 1);
    });
    await t.test('two concurrent activations create exactly one verified RIDER and no session', async () => {
      const token = tokenFrom(sent.find(m => m.to === address('first')));
      const results = await Promise.allSettled([service.activateRider({ token, password }), service.activateRider({ token, password })]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.code, 'INVALID_INVITATION_TOKEN');
      assert.deepEqual(Object.keys(results.find(r => r.status === 'fulfilled').value), ['message']);
      const rider = await prisma.account.findUnique({ where: { email: address('first') }, include: { profile: true } });
      assert.equal(rider.id, rider.profile.id); assert.equal(rider.profile.role, 'RIDER');
      assert.equal(rider.profile.fullName, 'Invited Rider'); assert.ok(rider.emailVerifiedAt);
      assert.ok(await verifyPassword(password, rider.passwordHash));
      assert.equal(await prisma.authSession.count({ where: { accountId: rider.id } }), 0);
      await rejectsCode(() => service.activateRider({ token, password }), 'INVALID_INVITATION_TOKEN');
      const session = await auth.login({ email: rider.email, password });
      assert.equal(session.user.profile.role, 'RIDER');
      assert.doesNotMatch(JSON.stringify(session), /passwordHash|password_hash/);
      const current = await auth.authenticate(session.accessToken);
      assert.equal(current.id, rider.id); assert.equal(current.role, 'RIDER');
      await auth.logout(session.accessToken);
      await rejectsCode(() => auth.authenticate(session.accessToken), 'UNAUTHORIZED');
    });
    await t.test('expired and revoked invitations reject activation; replacement invalidates old token', async () => {
      for (const name of ['expired', 'revoked']) {
        await service.inviteRider(actor, { email: address(name) });
        const token = tokenFrom(sent.at(-1));
        await prisma.riderInvitation.update({ where: { email: address(name) }, data: name === 'expired' ? { expiresAt: new Date(0) } : { revokedAt: new Date() } });
        await rejectsCode(() => service.activateRider({ token, password }), 'INVALID_INVITATION_TOKEN');
        await service.inviteRider(actor, { email: address(name) });
        assert.notEqual(tokenFrom(sent.at(-1)), token);
        await rejectsCode(() => service.activateRider({ token, password }), 'INVALID_INVITATION_TOKEN');
      }
      await rejectsCode(() => service.activateRider({ token: 'X'.repeat(43), password }), 'INVALID_INVITATION_TOKEN');
    });
    await t.test('existing accounts and a registration race cannot change roles', async () => {
      for (const role of ['SME', 'OPERATOR', 'RIDER']) {
        const account = await createAccount(`existing-${role}`, role);
        await rejectsCode(() => service.inviteRider(actor, { email: account.email }), 'RIDER_INVITATION_CONFLICT');
        assert.equal((await prisma.profile.findUnique({ where: { id: account.id } })).role, role);
      }
      await service.inviteRider(actor, { email: address('race') });
      const token = tokenFrom(sent.at(-1));
      const account = await createAccount('race', 'SME');
      await rejectsCode(() => service.activateRider({ token, password }), 'RIDER_INVITATION_CONFLICT');
      assert.equal((await prisma.profile.findUnique({ where: { id: account.id } })).role, 'SME');
      assert.equal((await prisma.riderInvitation.findUnique({ where: { email: account.email } })).acceptedAt, null, 'claim rolled back');
    });
    await t.test('current operator role is checked and failed email revokes only its token', async () => {
      await prisma.profile.update({ where: { id: operator.id }, data: { role: 'SME', providerId: null } });
      await rejectsCode(() => service.inviteRider(actor, { email: address('forbidden') }), 'FORBIDDEN');
      await prisma.profile.update({ where: { id: operator.id }, data: { role: 'OPERATOR', providerId } });
      failEmail = true;
      await rejectsCode(() => service.inviteRider(actor, { email: address('delivery') }), 'EMAIL_DELIVERY_FAILED');
      failEmail = false;
      const old = await prisma.riderInvitation.findUnique({ where: { email: address('delivery') } });
      assert.ok(old.revokedAt);
      await service.inviteRider(actor, { email: address('delivery') });
      await repository.invalidateInvitation(old.tokenHash);
      assert.equal((await prisma.riderInvitation.findUnique({ where: { email: address('delivery') } })).revokedAt, null);
    });
  } finally {
    // Delete only this run's fixtures; invitations must precede their inviting operator.
    await prisma.riderInvitation.deleteMany({ where: { email: { startsWith: prefix } } });
    const accounts = await prisma.account.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } });
    await prisma.profile.deleteMany({ where: { id: { in: accounts.map(a => a.id) } } });
    await prisma.deliveryProvider.deleteMany({ where: { id: providerId } });
    await prisma.$disconnect();
  }
});
