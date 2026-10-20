const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');

// Explicit opt-in prevents ordinary npm test from touching a developer's database.
const databaseUrl = process.env.TEST_DATABASE_URL;
test('verification and password recovery transactions against a test database', { skip: !databaseUrl, timeout: 60000 }, async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.FRONTEND_URL = 'https://frontend.example.com';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test-user';
  process.env.SMTP_PASSWORD = 'test-password';
  process.env.SMTP_FROM = 'test@example.com';
  let failMail = false, transportOptions;
  const sent = [];
  require('nodemailer').createTransport = options => {
    transportOptions = options;
    return { sendMail: async message => {
      if (failMail) throw new Error('private SMTP credentials');
      sent.push(message);
      return { accepted: [message.to] };
    } };
  };
  const service = require('../dist/modules/auth/auth.service');
  const email = require('../dist/modules/auth/auth.email.service');
  const { prisma } = require('../dist/config/prisma');
  const repository = require('../dist/modules/auth/auth.repository');
  const createdIds = [];
  const address = () => 'auth-test-' + randomUUID() + '@example.com';
  const digest = token => createHash('sha256').update(token).digest('hex');
  const tokenFrom = message => {
    const link = new URL(message.text.match(/https:\/\/\S+/)[0]);
    assert.equal(link.origin, 'https://frontend.example.com');
    assert.equal(link.search, '');
    return new URLSearchParams(link.hash.slice(1)).get('token');
  };
  async function rejectsCode(action, code) {
    await assert.rejects(action, error => error.code === code);
  }
  async function age(purpose, accountId) {
    const table = purpose === 'verification' ? prisma.emailVerificationToken : prisma.passwordResetToken;
    await table.updateMany({ where: { accountId }, data: { createdAt: new Date(Date.now() - 61000) } });
  }
  try {
    const credentials = { email: address(), password: 'initial-password' };
    const registration = await service.register(credentials);
    const account = await prisma.account.findUniqueOrThrow({ where: { email: credentials.email }, include: { profile: true } });
    createdIds.push(account.id);
    assert.equal(registration.confirmationRequired, true);
    assert.equal(registration.accessToken, undefined);
    assert.equal(account.emailVerifiedAt, null);
    assert.equal(account.profile.role, 'SME');
    assert.equal(await prisma.authSession.count({ where: { accountId: account.id } }), 0);
    assert.equal(sent.length, 1);
    assert.match(sent[0].html, /Verify Email/);
    assert.doesNotMatch(sent[0].text, /initial-password/);
    assert.equal(transportOptions.requireTLS, true);
    let token = tokenFrom(sent[0]);
    const record = await prisma.emailVerificationToken.findUniqueOrThrow({ where: { accountId: account.id } });
    assert.equal(record.tokenHash, digest(token));
    assert.notEqual(record.tokenHash, token);
    assert.ok(Math.abs(record.expiresAt - record.createdAt - 900000) < 1000);
    await rejectsCode(() => service.login(credentials), 'EMAIL_NOT_VERIFIED');
    await rejectsCode(() => email.verifyEmail('X'.repeat(43)), 'INVALID_VERIFICATION_TOKEN');
    await prisma.emailVerificationToken.update({ where: { accountId: account.id }, data: { expiresAt: new Date(0) } });
    await rejectsCode(() => email.verifyEmail(token), 'INVALID_VERIFICATION_TOKEN');
    const generic = await email.resendVerification(address());
    assert.deepEqual(await email.resendVerification(credentials.email), generic);
    assert.equal(sent.length, 1, 'cooldown does not send another email');
    await age('verification', account.id);
    await Promise.all([email.resendVerification(credentials.email), email.resendVerification(credentials.email)]);
    assert.equal(sent.length, 2, 'concurrent resends create one active token and email');
    await rejectsCode(() => email.verifyEmail(token), 'INVALID_VERIFICATION_TOKEN');
    token = tokenFrom(sent[1]);
    const confirmations = await Promise.allSettled([email.verifyEmail(token), email.verifyEmail(token)]);
    assert.equal(confirmations.filter(r => r.status === 'fulfilled').length, 1);
    await rejectsCode(() => email.verifyEmail(token), 'INVALID_VERIFICATION_TOKEN');
    assert.ok((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).emailVerifiedAt);
    await email.resendVerification(credentials.email);
    assert.equal(sent.length, 2, 'verified account does not receive another verification email');
    const first = await service.login(credentials), second = await service.login(credentials);
    assert.equal((await service.authenticate(first.accessToken)).id, account.id);

    // Simulate an existing pre-migration account/session: guard it without deleting it.
    await prisma.account.update({ where: { id: account.id }, data: { emailVerifiedAt: null } });
    await rejectsCode(() => service.authenticate(first.accessToken), 'UNAUTHORIZED');
    await rejectsCode(() => service.refresh(first.refreshToken), 'INVALID_REFRESH_TOKEN');
    assert.equal(await prisma.authSession.count({ where: { accountId: account.id } }), 2);
    await prisma.account.update({ where: { id: account.id }, data: { emailVerifiedAt: new Date() } });

    const unknown = await email.forgotPassword(address());
    assert.deepEqual(await email.forgotPassword(credentials.email), unknown);
    const resetMailCount = sent.length;
    let resetToken = tokenFrom(sent.at(-1));
    assert.match(sent.at(-1).html, /Reset Password/);
    assert.equal((await prisma.passwordResetToken.findUniqueOrThrow({ where: { accountId: account.id } })).tokenHash, digest(resetToken));
    await email.forgotPassword(credentials.email);
    assert.equal(sent.length, resetMailCount);
    await rejectsCode(() => service.resetPassword({ token: 'X'.repeat(43), newPassword: 'new-password' }), 'INVALID_RESET_TOKEN');
    await prisma.passwordResetToken.update({ where: { accountId: account.id }, data: { expiresAt: new Date(0) } });
    await rejectsCode(() => service.resetPassword({ token: resetToken, newPassword: 'new-password' }), 'INVALID_RESET_TOKEN');
    await age('password-reset', account.id);
    await email.forgotPassword(credentials.email);
    const obsoleteToken = resetToken;
    resetToken = tokenFrom(sent.at(-1));
    await rejectsCode(() => service.resetPassword({ token: obsoleteToken, newPassword: 'new-password' }), 'INVALID_RESET_TOKEN');
    const resets = await Promise.allSettled([
      service.resetPassword({ token: resetToken, newPassword: 'new-password' }),
      service.resetPassword({ token: resetToken, newPassword: 'new-password' }),
    ]);
    assert.equal(resets.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await prisma.authSession.count({ where: { accountId: account.id } }), 0);
    assert.equal(await prisma.passwordResetToken.count({ where: { accountId: account.id } }), 0);
    await rejectsCode(() => service.authenticate(first.accessToken), 'UNAUTHORIZED');
    await rejectsCode(() => service.refresh(second.refreshToken), 'INVALID_REFRESH_TOKEN');
    await rejectsCode(() => service.login(credentials), 'LOGIN_FAILED');
    await rejectsCode(() => service.resetPassword({ token: resetToken, newPassword: 'other-password' }), 'INVALID_RESET_TOKEN');
    const newSession = await service.login({ ...credentials, password: 'new-password' });
    assert.equal((await service.authenticate(newSession.accessToken)).id, account.id);
    // Session issuance using the old pre-reset credential snapshot must also fail.
    assert.equal(await repository.createSession({ accountId: account.id, accessHash: digest(randomUUID()), refreshHash: digest(randomUUID()), accessExpiresAt: new Date(Date.now() + 900000), refreshExpiresAt: new Date(Date.now() + 900000) }, account.passwordHash), null);

    failMail = true;
    const failedCredentials = { email: address(), password: 'initial-password' };
    await rejectsCode(() => service.register(failedCredentials), 'EMAIL_DELIVERY_FAILED');
    const failed = await prisma.account.findUniqueOrThrow({ where: { email: failedCredentials.email } });
    createdIds.push(failed.id);
    assert.equal(failed.emailVerifiedAt, null);
    assert.equal(await prisma.authSession.count({ where: { accountId: failed.id } }), 0);
    assert.ok((await prisma.emailVerificationToken.findUniqueOrThrow({ where: { accountId: failed.id } })).expiresAt < new Date());
    await age('verification', failed.id);
    assert.deepEqual(await email.resendVerification(failed.email), generic);
    await email.forgotPassword(failed.email);
    const failedReset = await prisma.passwordResetToken.findUniqueOrThrow({ where: { accountId: failed.id } });
    assert.ok(failedReset.expiresAt < new Date());
    failMail = false;
    await age('verification', failed.id);
    await email.resendVerification(failed.email);
    await email.verifyEmail(tokenFrom(sent.at(-1)));
    assert.ok((await service.login(failedCredentials)).accessToken);
  } finally {
    // Only records created by this test are removed; other application data is untouched.
    await prisma.profile.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  }
});
