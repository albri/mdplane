import assert from 'node:assert/strict';
import test from 'node:test';

import {
  apiPresentationFromOverallStatus,
  componentPresentation,
  isStale,
  overallStatusClass,
  overallStatusHeadline,
} from '../src/status-view-model.ts';

test('overall status mapping returns expected headline and class', () => {
  assert.equal(overallStatusHeadline('operational'), 'All systems operational');
  assert.equal(overallStatusClass('operational'), 'status-operational');

  assert.equal(overallStatusHeadline('degraded'), 'Some systems degraded');
  assert.equal(overallStatusClass('degraded'), 'status-degraded');

  assert.equal(overallStatusHeadline('partial_outage'), 'Partial service outage');
  assert.equal(overallStatusClass('partial_outage'), 'status-down');

  assert.equal(overallStatusHeadline('major_outage'), 'Major service outage');
  assert.equal(overallStatusClass('major_outage'), 'status-down');
});

test('api presentation follows overall status severity', () => {
  assert.deepEqual(
    apiPresentationFromOverallStatus('operational'),
    { className: 'status-operational', label: 'Operational' },
  );
  assert.deepEqual(
    apiPresentationFromOverallStatus('degraded'),
    { className: 'status-degraded', label: 'Degraded' },
  );
  assert.deepEqual(
    apiPresentationFromOverallStatus('partial_outage'),
    { className: 'status-down', label: 'Unavailable' },
  );
});

test('component presentation maps component status to pill data', () => {
  assert.deepEqual(
    componentPresentation('operational'),
    { className: 'status-operational', label: 'Operational' },
  );
  assert.deepEqual(
    componentPresentation('degraded'),
    { className: 'status-degraded', label: 'Degraded' },
  );
  assert.deepEqual(
    componentPresentation('down'),
    { className: 'status-down', label: 'Unavailable' },
  );
});

test('stale indicator trips only after threshold', () => {
  const nowMs = 1_000_000;

  assert.equal(isStale(undefined, nowMs, 60_000), false);
  assert.equal(isStale(nowMs - 60_000, nowMs, 60_000), false);
  assert.equal(isStale(nowMs - 60_001, nowMs, 60_000), true);
});
