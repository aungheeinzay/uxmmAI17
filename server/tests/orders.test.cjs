const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
const digest = value => createHash('sha256').update(value).digest('hex');
const authRepo = require('../dist/modules/auth/auth.repository');
const userRepo = require('../dist/modules/users/user.repository');
const orderRepo = require('../dist/modules/orders/order.repository');

const tokens = { SME: 'S'.repeat(43), OPERATOR: 'O'.repeat(43), expired: 'E'.repeat(43) };
const smeId = randomUUID();
const sessions = new Map();
for (const role of ['SME', 'OPERATOR']) {
  sessions.set(digest(tokens[role]), {
    accessExpiresAt: new Date(Date.now() + 60000),
    account: { id: smeId, email: `${role.toLowerCase()}@example.com`, emailVerifiedAt: new Date(), profile: { role } },
  });
}
sessions.set(digest(tokens.expired), { ...sessions.get(digest(tokens.SME)), accessExpiresAt: new Date(0) });
authRepo.findSession = async hash => sessions.get(hash) || null;
userRepo.findProfile = async id => ({ id, fullName: 'Shop Owner', role: 'SME' });

function listedOrder(code, status) {
  return {
    id: randomUUID(), orderCode: code, recipientName: 'Aye Chan', phoneNumber: '09123456789',
    township: 'Hlaing', deliveryAddress: 'No. 12 Main Road', parcelWeightKg: { toString: () => '2.5' },
    codAmount: { toString: () => '15000' }, currency: 'MMK', senderName: 'Example Shop',
    status, createdAt: new Date('2026-10-20T08:30:00.000Z'), operatorId: null, operator: null,
  };
}

const capturedFilters = [];
orderRepo.listOrdersWithCount = async filters => {
  capturedFilters.push(filters);
  const rows = statusesFor(filters).map((status, index) => listedOrder(`POAABBCCDDEEFF00${String(index).padStart(2, '0')}`, status));
  const total = rows.length;
  return [
    rows,
    total,
    [
      { status: 'CREATED', _count: { _all: 5 } },
      { status: 'IN_TRANSIT', _count: { _all: 2 } },
      { status: 'DELIVERED', _count: { _all: 14 } },
      { status: 'FAILED', _count: { _all: 3 } },
    ],
  ];
};

// Mirrors the tab -> statuses mapping on the server for the stubbed repository.
function statusesFor(filters) {
  if (filters.statuses && filters.statuses.length > 0) return filters.statuses;
  return ['CREATED', 'IN_TRANSIT', 'DELIVERED', 'FAILED'];
}

const statusRecords = new Map();
statusRecords.set('POAABBCCDDEEFF0011', {
  id: '3d0f2b7c-8a51-4c62-9f10-5b6c7d8e9f00',
  orderCode: 'POAABBCCDDEEFF0011',
  status: 'IN_TRANSIT',
  createdAt: new Date('2026-10-20T00:00:00.000Z'),
  statusEvents: [
    { status: 'PICKED_UP', previousStatus: 'CREATED', note: 'Handed to operator', createdAt: new Date('2026-10-20T02:15:00.000Z') },
    { status: 'IN_TRANSIT', previousStatus: 'PICKED_UP', note: null, createdAt: new Date('2026-10-20T05:40:00.000Z') },
  ],
});
orderRepo.findStatusByIdentifier = async (ownerId, identifier) => {
  const code = identifier.kind === 'orderCode' ? identifier.value : identifier.value.toUpperCase();
  return statusRecords.get(code) ?? null;
};

function detailOrder(status) {
  return {
    id: '3d0f2b7c-8a51-4c62-9f10-5b6c7d8e9f00', orderCode: 'POAABBCCDDEEFF0011', ownerId: smeId, operatorId: null,
    recipientName: 'Aye Chan', phoneNumber: '09123456789', township: 'Hlaing', deliveryAddress: 'No. 12 Main Road',
    parcelWeightKg: { toString: () => '2.5' }, codAmount: { toString: () => '15000' }, currency: 'MMK',
    senderName: 'Example Shop', deliveryInstructions: null, status,
    createdAt: new Date('2026-10-20T08:30:00.000Z'), updatedAt: new Date('2026-10-20T08:30:00.000Z'),
    owner: { id: smeId, fullName: 'Shop Owner', phone: null }, operator: null,
  };
}
let currentStatus = 'IN_TRANSIT';
orderRepo.findOrderForOwner = async () => detailOrder(currentStatus);
orderRepo.updateOrderStatus = async data => {
  if (data.previousStatus !== currentStatus) return null;
  currentStatus = data.status;
  return detailOrder(currentStatus);
};

// Dashboard stubs: the monthly breakdown is grouped per calendar month, oldest first.
const monthlyTotals = [
  { _sum: { deliveryFee: { toString: () => '1260000' } }, _count: { _all: 4 } },
  { _sum: { deliveryFee: { toString: () => '1450000' } }, _count: { _all: 5 } },
  { _sum: { deliveryFee: { toString: () => '1360000' } }, _count: { _all: 3 } },
  { _sum: { deliveryFee: { toString: () => '1620000' } }, _count: { _all: 6 } },
  { _sum: { deliveryFee: { toString: () => '1840000' } }, _count: { _all: 8 } },
  { _sum: { deliveryFee: { toString: () => '1710000' } }, _count: { _all: 7 } },
];
const capturedMonthRanges = [];
let capturedDashboardOwnerId = null;
orderRepo.getDashboardData = async () => [
  24,
  [
    { status: 'CREATED', _count: { _all: 5 } },
    { status: 'IN_TRANSIT', _count: { _all: 2 } },
    { status: 'DELIVERED', _count: { _all: 14 } },
    { status: 'FAILED', _count: { _all: 3 } },
  ],
  12, 9, 30, 21,
  [{
    id: '3d0f2b7c-8a51-4c62-9f10-5b6c7d8e9f00', orderCode: 'POAABBCCDDEEFF0011',
    recipientName: 'Aye Chan', phoneNumber: '09123456789', township: 'Hlaing', deliveryAddress: 'No. 12 Main Road',
    parcelWeightKg: { toString: () => '2.5' }, codAmount: { toString: () => '15000' }, currency: 'MMK',
    deliveryInstructions: null, status: 'DELIVERED', createdAt: new Date('2026-10-20T08:30:00.000Z'),
    qrIdentifier: 'a'.repeat(64), owner: { id: smeId, fullName: 'Shop Owner', phone: null },
    operator: null, statusEvents: [],
  }],
];
orderRepo.getMonthlyDeliveryTotals = async (ownerId, ranges) => {
  capturedDashboardOwnerId = ownerId;
  capturedMonthRanges.length = 0;
  capturedMonthRanges.push(...ranges);
  return ranges.map((range, index) => monthlyTotals[index] ?? { _sum: { deliveryFee: null }, _count: { _all: 0 } });
};

const { app } = require('../dist/app');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.on('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(r => server.close(r)); await require('../dist/config/prisma').prisma.$disconnect(); });
async function list(query, token = tokens.SME) {
  const response = await fetch(base + '/api/orders' + query, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: response.status, body: await response.json() };
}

test('authentication and SME role are required to list parcels', async () => {
  for (const token of ['', 'invalid', tokens.expired]) assert.equal((await list('', token)).status, 401);
  assert.equal((await list('', tokens.OPERATOR)).status, 403);
});

test('the list returns pagination and tab counts for every view', async () => {
  capturedFilters.length = 0;
  const r = await list('?page=1&pageSize=10');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.tabCounts, { all: 24, needsPickup: 5, exceptions: 3 });
  assert.deepEqual(r.body.data.pagination, { page: 1, pageSize: 10, total: 4, totalPages: 1 });
  assert.ok(Array.isArray(r.body.data.orders));
  assert.equal(r.body.data.orders[0].orderCode.startsWith('PO'), true);
});

test('the needs_pickup and exceptions tabs map to the expected status sets', async () => {
  capturedFilters.length = 0;
  await list('?tab=needs_pickup');
  assert.deepEqual(capturedFilters.at(-1).statuses, ['CREATED']);
  await list('?tab=exceptions');
  assert.deepEqual(capturedFilters.at(-1).statuses, ['FAILED', 'CANCELLED']);
  await list('?tab=all');
  assert.deepEqual(capturedFilters.at(-1).statuses, []);
});

test('an explicit status filter takes precedence and invalid values are rejected', async () => {
  capturedFilters.length = 0;
  await list('?status=DELIVERED&tab=needs_pickup');
  assert.deepEqual(capturedFilters.at(-1).statuses, ['DELIVERED']);
  assert.equal((await list('?status=PENDING')).status, 400);
  assert.equal((await list('?tab=trash')).status, 400);
  assert.equal((await list('?pageSize=1000')).status, 400);
});

test('search text is passed through and client-supplied owner ids are rejected', async () => {
  capturedFilters.length = 0;
  await list('?search=aye');
  assert.equal(capturedFilters.at(-1).search, 'aye');
  // Unknown parameters (e.g. a spoofed owner id) are rejected by the strict query schema.
  assert.equal((await list('?ownerId=' + randomUUID())).status, 400);
  // Ownership is never taken from the query; the repository is always scoped to the authenticated SME.
  assert.equal(capturedFilters.every(filters => filters.ownerId === smeId), true);
});

async function readStatus(identifier, token = tokens.SME) {
  const response = await fetch(base + '/api/orders/' + identifier + '/status', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: response.status, body: await response.json() };
}

test('reading the parcel status requires authentication and the SME role', async () => {
  assert.equal((await readStatus('POAABBCCDDEEFF0011', '')).status, 401);
  assert.equal((await readStatus('POAABBCCDDEEFF0011', tokens.OPERATOR)).status, 403);
});

test('the status view returns status and a timestamped timeline without contact or financial data', async () => {
  const r = await readStatus('poaabbccddeeff0011');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.id, '3d0f2b7c-8a51-4c62-9f10-5b6c7d8e9f00');
  assert.equal(r.body.data.orderCode, 'POAABBCCDDEEFF0011');
  assert.equal(r.body.data.status, 'IN_TRANSIT');
  assert.equal(r.body.data.timeline.length, 3);
  assert.deepEqual(r.body.data.timeline[0], {
    status: 'CREATED', previousStatus: null, note: null, createdAt: '2026-10-20T00:00:00.000Z',
  });
  assert.equal(r.body.data.timeline.at(-1).status, 'IN_TRANSIT');
  assert.doesNotMatch(JSON.stringify(r.body), /recipientName|phoneNumber|deliveryAddress|codAmount|senderName|township/);
});

test('the status view rejects invalid identifiers and unknown parcels', async () => {
  assert.equal((await readStatus('not-a-code')).status, 400);
  assert.equal((await readStatus('POFFFFFFFFFFFFFFFF')).status, 404);
});

async function setStatus(status, token = tokens.SME) {
  const response = await fetch(base + '/api/orders/POAABBCCDDEEFF0011/status', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return { status: response.status, body: await response.json() };
}

test('SME cannot advance an order to OUT_FOR_DELIVERY', async () => {
  const r = await setStatus('OUT_FOR_DELIVERY');
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'STATUS_TRANSITION_NOT_ALLOWED');
});

test('SME cannot mark an in-transit parcel delivered', async () => {
  currentStatus = 'IN_TRANSIT';
  const r = await setStatus('DELIVERED');
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'STATUS_TRANSITION_NOT_ALLOWED');
});

test('a status change that is not reachable from the current one is rejected', async () => {
  currentStatus = 'CREATED';
  const r = await setStatus('DELIVERED');
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'STATUS_TRANSITION_NOT_ALLOWED');
});

test('a delivered parcel is terminal', async () => {
  currentStatus = 'DELIVERED';
  const r = await setStatus('FAILED');
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'ORDER_IS_TERMINAL');
});

async function readDashboard(token = tokens.SME) {
  const response = await fetch(base + '/api/sme/dashboard', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: response.status, body: await response.json() };
}

// The six calendar months the service is expected to report, oldest first.
function expectedMonthKeys(count) {
  const now = new Date();
  const keys = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    keys.push(`${startsAt.getUTCFullYear()}-${String(startsAt.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

test('reading the dashboard requires authentication and the SME role', async () => {
  assert.equal((await readDashboard('')).status, 401);
  assert.equal((await readDashboard(tokens.expired)).status, 401);
  assert.equal((await readDashboard(tokens.OPERATOR)).status, 403);
});

test('the dashboard reports monthly costs for the last six calendar months', async () => {
  const r = await readDashboard();
  assert.equal(r.status, 200);
  assert.equal(r.body.data.totalParcels, 24);
  assert.equal(r.body.data.statusCounts.DELIVERED, 14);
  assert.equal(r.body.data.deliveryOverview.thisMonth.totalShipments, 30);
  assert.equal(r.body.data.recentOrders.length, 1);

  const costs = r.body.data.monthlyCosts;
  assert.equal(costs.length, 6);
  assert.deepEqual(costs.map(entry => entry.month), expectedMonthKeys(6));
  assert.deepEqual(costs.map(entry => entry.cost), ['1260000', '1450000', '1360000', '1620000', '1840000', '1710000']);
  assert.deepEqual(costs.map(entry => entry.parcels), [4, 5, 3, 6, 8, 7]);
  assert.equal(costs.every(entry => entry.currency === 'MMK'), true);
});

test('the monthly breakdown is scoped to the authenticated SME', async () => {
  capturedMonthRanges.length = 0;
  await readDashboard();
  assert.equal(capturedDashboardOwnerId, smeId);
  assert.equal(capturedMonthRanges.length, 6);
  for (const range of capturedMonthRanges) {
    assert.equal(range.month, `${range.startsAt.getUTCFullYear()}-${String(range.startsAt.getUTCMonth() + 1).padStart(2, '0')}`);
    // Each range covers exactly one calendar month and ends where the next one starts.
    assert.equal(range.startsAt.getUTCDate(), 1);
    assert.equal(range.endsAt.getTime(), new Date(Date.UTC(range.startsAt.getUTCFullYear(), range.startsAt.getUTCMonth() + 1, 1)).getTime());
  }
  for (let index = 1; index < capturedMonthRanges.length; index += 1) {
    assert.equal(capturedMonthRanges[index].startsAt.getTime(), capturedMonthRanges[index - 1].endsAt.getTime());
  }
});
