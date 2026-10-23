const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const repository = require('../dist/modules/operator/reports/report.repository');
const service = require('../dist/modules/operator/reports/report.service');

const operatorId = randomUUID();
const providerId = randomUUID();
let grouped;
let created;
let deliveredRows;

beforeEach(() => {
  grouped = [
    { status: 'CREATED', _count: { _all: 2 } },
    { status: 'DELIVERED', _count: { _all: 2 } },
    { status: 'FAILED', _count: { _all: 1 } },
  ];
  created = [{ createdAt: new Date('2026-10-01T00:00:00Z') }, { createdAt: new Date('2026-10-02T00:00:00Z') }];
  deliveredRows = [{ statusEvents: [{ status: 'PICKED_UP', createdAt: new Date('2026-10-01T02:00:00Z') }, { status: 'DELIVERED', createdAt: new Date('2026-10-02T02:00:00Z') }] }];
  repository.findOperatorMembership = async id => id === operatorId ? { role: 'OPERATOR', providerId } : null;
  repository.getProviderCohort = async () => [5, grouped, created, deliveredRows];
});

test('operator reports calculate provider-scoped metrics and duration', async () => {
  const result = await service.overview({ id: operatorId, role: 'OPERATOR' }, { startDate: '2026-10-01', endDate: '2026-10-02' });
  assert.equal(result.metrics.totalParcels, 5);
  assert.equal(result.metrics.failed, 1);
  assert.equal(result.metrics.successRate, 66.67);
  assert.equal(result.metrics.averageDeliveryHours, 24);
  assert.deepEqual(result.volume.map(item => item.count), [1, 1]);
  assert.equal(result.period.timezone, 'Asia/Yangon');
});

test('operator reports reject wrong role and missing membership', async () => {
  await assert.rejects(() => service.overview({ id: operatorId, role: 'SME' }, { startDate: '2026-10-01', endDate: '2026-10-02' }), error => error.status === 403);
  repository.findOperatorMembership = async () => ({ role: 'OPERATOR', providerId: null });
  await assert.rejects(() => service.overview({ id: operatorId, role: 'OPERATOR' }, { startDate: '2026-10-01', endDate: '2026-10-02' }), error => error.code === 'PROVIDER_MEMBERSHIP_REQUIRED');
});

test('operator reports validate bounded date ranges', async () => {
  await assert.rejects(() => service.overview({ id: operatorId, role: 'OPERATOR' }, { startDate: '2026-10-03', endDate: '2026-10-02' }), error => error.status === 400);
  await assert.rejects(() => service.overview({ id: operatorId, role: 'OPERATOR' }, { startDate: '2025-01-01', endDate: '2026-10-02' }), error => error.status === 400);
});
