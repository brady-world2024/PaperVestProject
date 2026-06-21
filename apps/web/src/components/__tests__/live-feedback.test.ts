import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatRelativeRefreshTime,
  getLatestTimestamp,
  getLiveFeedbackStatus,
} from '../../lib/live-feedback';

test('formatRelativeRefreshTime returns second-scale copy for recent timestamps', () => {
  const now = Date.parse('2026-06-22T00:00:30Z');
  const label = formatRelativeRefreshTime('2026-06-22T00:00:12Z', now);

  assert.equal(label, '18s ago');
});

test('getLatestTimestamp returns the freshest valid timestamp', () => {
  const latest = getLatestTimestamp([
    '2026-06-22T00:00:12Z',
    null,
    '2026-06-22T00:00:25Z',
    'not-a-date',
  ]);

  assert.equal(latest, '2026-06-22T00:00:25Z');
});

test('getLiveFeedbackStatus reports a refreshing pulse while fetches are in flight', () => {
  const status = getLiveFeedbackStatus({
    subject: 'market board',
    timestamps: ['2026-06-22T00:00:12Z'],
    now: Date.parse('2026-06-22T00:00:30Z'),
    refreshIntervalMs: 30_000,
    isRefreshing: true,
  });

  assert.equal(status.chip, 'Refreshing');
  assert.equal(status.tone, 'positive');
  assert.equal(status.pulse, true);
});

test('getLiveFeedbackStatus reports cached state when stale snapshots are being used', () => {
  const status = getLiveFeedbackStatus({
    subject: 'watchlist quotes',
    timestamps: ['2026-06-22T00:00:12Z'],
    now: Date.parse('2026-06-22T00:02:30Z'),
    refreshIntervalMs: 30_000,
    isRefreshing: false,
    stale: true,
  });

  assert.equal(status.chip, 'Cached');
  assert.equal(status.tone, 'caution');
  assert.equal(status.relativeLabel, 'Updated 2m ago');
});

test('getLiveFeedbackStatus reports delayed state when freshness drifts beyond the usual cadence', () => {
  const status = getLiveFeedbackStatus({
    subject: 'command center',
    timestamps: ['2026-06-22T00:00:00Z'],
    now: Date.parse('2026-06-22T00:01:40Z'),
    refreshIntervalMs: 30_000,
    isRefreshing: false,
  });

  assert.equal(status.chip, 'Delayed');
  assert.equal(status.tone, 'neutral');
});
