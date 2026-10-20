const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const digest = value => createHash('sha256').update(value).digest('hex');
const authRepo = require('../dist/modules/auth/auth.repository');
const repo = require('../dist/modules/riders/rider.repository');
const email = require('../dist/lib/email/email.service');
const { verifyPassword } = require('../dist/modules/auth/auth.password');
const sessions = new Map(), invitations = new Map(), accounts = new Map(), sent = [];
const operatorId = randomUUID();
let failEmail = false;
const tokens = { OPERATOR: 'O'.repeat(43), SME: 'S'.repeat(43), RIDER: 'R'.repeat(43), expired: 'E'.repeat(43) };
for (const role of ['OPERATOR', 'SME', 'RIDER']) sessions.set(digest(tokens[role]), {
  accessExpiresAt: new Date(Date.now() + 60000), account: {
    id: role === 'OPERATOR' ? operatorId : randomUUID(), email: `${role.toLowerCase()}@example.com`,
    emailVerifiedAt: new Date(), profile: { role },
  },
});
sessions.set(digest(tokens.expired), { ...sessions.get(digest(tokens.SME)), accessExpiresAt: new Date(0) });
authRepo.findSession = async hash => sessions.get(hash) || null;
repo.reserveInvitation = async input => {
  if (accounts.has(input.email)) return { status: 'conflict' };
  const previous = invitations.get(input.email);
  if (previous && (previous.acceptedAt || (!previous.revokedAt && previous.expiresAt > new Date()))) return { status: 'conflict' };
  const invitation = { id: previous?.id ?? randomUUID(), ...input, acceptedAt: null, revokedAt: null };
  invitations.set(input.email, invitation);
  return { status: 'created', id: invitation.id };
};
repo.invalidateInvitation = async hash => {
  const invitation = [...invitations.values()].find(i => i.tokenHash === hash);
  if (invitation && !invitation.acceptedAt) invitation.revokedAt = new Date();
};
repo.activateInvitation = async (hash, passwordHash) => {
  const invitation = [...invitations.values()].find(i => i.tokenHash === hash);
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) return 'invalid';
  if (accounts.has(invitation.email)) throw { code: 'P2002' };
  invitation.acceptedAt = new Date();
  accounts.set(invitation.email, { id: randomUUID(), email: invitation.email, passwordHash, emailVerifiedAt: new Date(), profile: { role: 'RIDER' } });
  return 'activated';
};
email.sendRiderInvitationEmail = async (address, token) => {
  if (failEmail) throw new Error('private provider details');
  sent.push({ address, token });
};
const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(r => server.close(r)); await require('../dist/config/prisma').prisma.$disconnect(); });
async function request(path, body, token, extra = {}) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const invite = (email, token = tokens.OPERATOR, extra) => request('/api/riders/invitations', { email, fullName: 'Rider One' }, token, extra);
const activate = token => request('/api/riders/activate', { token, password: 'chosen-password' });

test('authentication and trusted database roles protect invitation creation', async () => {
  for (const token of [undefined, 'invalid', 'Z'.repeat(43), tokens.expired]) assert.equal((await invite('auth@example.com', token === undefined ? '' : token)).status, 401);
  for (const role of ['SME', 'RIDER']) assert.equal((await invite('auth@example.com', tokens[role], { 'X-Role': 'OPERATOR' })).status, 403);
  const session = sessions.get(digest(tokens.OPERATOR));
  session.account.profile.role = 'SME';
  assert.equal((await invite('auth@example.com')).status, 403);
  session.account.profile.role = 'OPERATOR';
  const revoked = 'V'.repeat(43);
  sessions.set(digest(revoked), session); sessions.delete(digest(revoked));
  assert.equal((await invite('auth@example.com', revoked)).status, 401);
});

test('operator invitation is pending, normalized, hashed and never creates an account', async () => {
  const r = await invite(' Rider@example.com ');
  assert.equal(r.status, 201);
  const invitation = invitations.get('rider@example.com');
  assert.equal(invitation.invitedById, operatorId);
  assert.equal(invitation.fullName, 'Rider One');
  assert.equal(invitation.acceptedAt, null);
  assert.ok(Math.abs(invitation.expiresAt.getTime() - Date.now() - 86400000) < 5000);
  assert.equal(sent.at(-1).address, 'rider@example.com');
  assert.match(sent.at(-1).token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(invitation.tokenHash, digest(sent.at(-1).token));
  assert.ok(!JSON.stringify(r.body).includes(sent.at(-1).token));
  assert.equal(accounts.has('rider@example.com'), false);
  assert.equal((await invite('rider@example.com')).status, 409);
});

test('activation creates only a verified RIDER with a hashed password and no session', async () => {
  const token = sent.find(s => s.address === 'rider@example.com').token;
  const r = await activate(token);
  assert.equal(r.status, 200);
  const account = accounts.get('rider@example.com');
  assert.equal(account.profile.role, 'RIDER');
  assert.ok(account.emailVerifiedAt);
  assert.ok(await verifyPassword('chosen-password', account.passwordHash));
  assert.deepEqual(Object.keys(r.body.data), ['message']);
  assert.doesNotMatch(JSON.stringify(r.body), /password|token|Hash/);
  assert.equal((await activate(token)).status, 400);
});

test('expired, revoked and unknown invitations cannot activate', async () => {
  assert.equal((await activate('X'.repeat(43))).status, 400);
  for (const [address, field] of [['expired@example.com', 'expiresAt'], ['revoked@example.com', 'revokedAt']]) {
    assert.equal((await invite(address)).status, 201);
    invitations.get(address)[field] = field === 'expiresAt' ? new Date(0) : new Date();
    assert.equal((await activate(sent.at(-1).token)).status, 400);
  }
});

test('existing SME and OPERATOR accounts remain unchanged', async () => {
  for (const role of ['SME', 'OPERATOR']) {
    const address = `${role}@existing.example.com`;
    accounts.set(address.toLowerCase(), { profile: { role } });
    assert.equal((await invite(address)).status, 409);
    assert.equal(accounts.get(address.toLowerCase()).profile.role, role);
  }
});

test('invalid input and privilege fields are rejected', async () => {
  for (const body of [{ email: 'bad' }, { email: 'new@example.com', role: 'RIDER' }, { email: 'new@example.com', password: 'operator-chosen' }]) {
    const r = await request('/api/riders/invitations', body, tokens.OPERATOR);
    assert.equal(r.status, 400); assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  }
  for (const body of [{}, { token: 'bad', password: 'chosen-password' }, { token: 'A'.repeat(43), password: 'short' }, { token: 'A'.repeat(43), password: 'chosen-password', role: 'OPERATOR' }]) {
    assert.equal((await request('/api/riders/activate', body)).status, 400);
  }
  const { registerSchema } = require('../dist/modules/auth/auth.validation');
  const { profileUpdateSchema } = require('../dist/modules/users/user.validation');
  for (const role of ['RIDER', 'OPERATOR']) {
    assert.equal(registerSchema.safeParse({ email: 'new@example.com', password: 'chosen-password', role }).success, false);
    assert.equal(profileUpdateSchema.safeParse({ role }).success, false);
  }
});

test('email templates use trusted origin, fragment tokens and both alternatives', () => {
  const { riderInvitationEmail } = require('../dist/lib/email/email.templates');
  const message = riderInvitationEmail('https://frontend.example.com/activate-rider#token=test');
  assert.match(message.text, /24 hours/); assert.match(message.text, /Operator/);
  assert.match(message.html, /Activate Account/); assert.match(message.html, /ignore this email/);
});

test('email delivery failures revoke the undelivered invitation and allow retry', async () => {
  // Separate operator identity avoids spending the original operator's invitation quota.
  sessions.get(digest(tokens.OPERATOR)).account.id = randomUUID();
  failEmail = true;
  const r = await invite('delivery@example.com');
  assert.equal(r.status, 503); assert.equal(r.body.error.code, 'EMAIL_DELIVERY_FAILED');
  assert.doesNotMatch(JSON.stringify(r.body), /private provider/);
  assert.ok(invitations.get('delivery@example.com').revokedAt);
  failEmail = false;
  assert.equal((await invite('delivery@example.com')).status, 201);
});

test('operator and activation request quotas reject repeated abuse', async () => {
  let r;
  for (let i = 0; i < 11; i++) { r = await invite(`limit${i}@example.com`); if (r.status === 429) break; }
  assert.equal(r.status, 429);
  for (let i = 0; i < 21; i++) { r = await request('/api/riders/activate', {}); if (r.status === 429) break; }
  assert.equal(r.status, 429); assert.equal(r.body.error.code, 'RATE_LIMITED');
});
