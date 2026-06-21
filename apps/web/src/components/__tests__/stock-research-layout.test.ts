import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getStockResearchViewMeta,
  getStockResearchViewModes,
  sanitizeStockResearchViewMode,
} from '../../lib/stock-research-layout';

test('stock research layout exposes the expected presets in order', () => {
  const modes = getStockResearchViewModes();

  assert.deepEqual(
    modes.map((mode) => mode.id),
    ['focus', 'split', 'desk']
  );
  assert.equal(modes[1]?.label, 'Balanced split');
});

test('stock research layout sanitizes unknown values to the balanced split default', () => {
  assert.equal(sanitizeStockResearchViewMode('focus'), 'focus');
  assert.equal(sanitizeStockResearchViewMode('nope'), 'split');
  assert.equal(sanitizeStockResearchViewMode(null), 'split');
});

test('stock research layout metadata returns signature copy for the selected view', () => {
  const meta = getStockResearchViewMeta('desk');

  assert.match(meta.signature, /execution/i);
});
