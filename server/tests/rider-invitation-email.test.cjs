const { test, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://user:password@localhost:5432/test';
process.env.FRONTEND_URL ??= 'https://frontend.example.test';
process.env.SMTP_FROM ??= 'test@example.test';

const mail = require('../dist/config/mail');
const { env } = require('../dist/config/env');
const email = require('../dist/lib/email/email.service');
const originalTransport = mail.getMailTransport;
const messages = [];

mail.getMailTransport = () => ({
  sendMail: async message => {
    messages.push(message);
  },
});

after(() => {
  mail.getMailTransport = originalTransport;
});

test('Rider invitation uses the activation route and keeps its token in the fragment', async () => {
  const token = 'a'.repeat(43);
  await email.sendRiderInvitationEmail('rider@example.test', token);

  assert.equal(messages.length, 1);
  const [message] = messages;
  assert.equal(message.from, env.SMTP_FROM);
  assert.equal(message.to, 'rider@example.test');
  assert.equal(message.subject, 'ParcelOps AI — Rider Invitation');

  const link = new URL(message.text.match(/Activate Account: (.+)/)[1]);
  assert.equal(link.origin, new URL(env.FRONTEND_URL).origin);
  assert.equal(link.pathname, '/activate-rider');
  assert.equal(link.search, '');
  assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'), token);
  assert.match(message.html, /Activate Account/);
  assert.match(message.html, /#token=/);
  assert.doesNotMatch(message.text + message.html, /password=/i);
});

test('Account verification email remains separate and uses its existing route', async () => {
  messages.length = 0;
  const token = 'b'.repeat(43);
  await email.sendAccountEmail('user@example.test', 'verification', token);

  assert.equal(messages.length, 1);
  const link = new URL(messages[0].text.match(/Verify Email: (.+)/)[1]);
  assert.equal(link.pathname, '/verify-email');
  assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'), token);
  assert.equal(messages[0].subject, 'ParcelOps AI — Verify Email');
});
