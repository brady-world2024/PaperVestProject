import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatProductAnalyticsEventName,
  formatProductAnalyticsPath,
  formatProductAnalyticsWindowLabel,
} from '../../lib/product-analytics';

test('formats analytics event names into readable labels', () => {
  assert.equal(formatProductAnalyticsEventName('CONDITIONAL_ORDER_CREATED'), 'Conditional Order Created');
});

test('formats analytics paths into navigation-friendly labels', () => {
  assert.equal(formatProductAnalyticsPath('/stocks/AAPL'), 'Stocks / AAPL');
  assert.equal(formatProductAnalyticsPath('/admin/support'), 'Admin / Support');
});

test('formats analytics windows into compact labels', () => {
  assert.equal(formatProductAnalyticsWindowLabel(30), 'Last 30 days');
});
