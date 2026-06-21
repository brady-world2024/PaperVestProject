import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyDashboardWorkspacePreset,
  getDashboardModulesForColumn,
  getDefaultDashboardWorkspace,
  getHiddenDashboardModules,
  moveDashboardModuleToColumn,
  moveDashboardModuleWithinColumn,
  sanitizeDashboardWorkspace,
  toggleDashboardModuleCollapsed,
  toggleDashboardModuleVisibility,
} from '../../lib/dashboard-workspace';

test('dashboard workspace returns ordered visible modules by column', () => {
  const workspace = getDefaultDashboardWorkspace();
  const primary = getDashboardModulesForColumn(workspace, 'primary');
  const secondary = getDashboardModulesForColumn(workspace, 'secondary');

  assert.deepEqual(primary.map((module) => module.id), ['history', 'watchlist', 'activity', 'marketBoard']);
  assert.deepEqual(secondary.map((module) => module.id), ['nextActions', 'exposure', 'activeOrders', 'holdingsPulse']);
});

test('dashboard workspace can hide and restore modules', () => {
  const hidden = toggleDashboardModuleVisibility(getDefaultDashboardWorkspace(), 'marketBoard', false);

  assert.deepEqual(getHiddenDashboardModules(hidden).map((module) => module.id), ['marketBoard']);
  assert.equal(
    getDashboardModulesForColumn(hidden, 'primary').some((module) => module.id === 'marketBoard'),
    false
  );

  const restored = toggleDashboardModuleVisibility(hidden, 'marketBoard', true);
  assert.equal(
    getDashboardModulesForColumn(restored, 'primary').some((module) => module.id === 'marketBoard'),
    true
  );
});

test('dashboard workspace can reorder within a column and move across columns', () => {
  const movedUp = moveDashboardModuleWithinColumn(getDefaultDashboardWorkspace(), 'marketBoard', 'up');
  assert.deepEqual(
    getDashboardModulesForColumn(movedUp, 'primary').map((module) => module.id),
    ['history', 'watchlist', 'marketBoard', 'activity']
  );

  const movedAcross = moveDashboardModuleToColumn(movedUp, 'marketBoard', 'secondary');
  assert.deepEqual(
    getDashboardModulesForColumn(movedAcross, 'secondary').map((module) => module.id),
    ['nextActions', 'exposure', 'activeOrders', 'holdingsPulse', 'marketBoard']
  );
});

test('dashboard workspace presets keep current visibility but change order and collapse defaults', () => {
  const hidden = toggleDashboardModuleVisibility(getDefaultDashboardWorkspace(), 'history', false);
  const execution = applyDashboardWorkspacePreset(hidden, 'execution');

  assert.equal(execution.find((module) => module.id === 'history')?.visible, false);
  assert.equal(execution.find((module) => module.id === 'exposure')?.collapsed, true);
  assert.equal(execution.find((module) => module.id === 'history')?.collapsed, true);
  assert.deepEqual(
    getDashboardModulesForColumn(execution, 'secondary').map((module) => module.id),
    ['nextActions', 'activeOrders', 'holdingsPulse', 'exposure']
  );
});

test('dashboard workspace sanitize restores missing modules and removes duplicates', () => {
  const sanitized = sanitizeDashboardWorkspace([
    { id: 'history', column: 'primary', visible: true, collapsed: false },
    { id: 'history', column: 'secondary', visible: false, collapsed: true },
  ]);

  assert.equal(sanitized.filter((module) => module.id === 'history').length, 1);
  assert.equal(sanitized.length, getDefaultDashboardWorkspace().length);
});

test('dashboard workspace can collapse a visible module', () => {
  const workspace = toggleDashboardModuleCollapsed(getDefaultDashboardWorkspace(), 'watchlist');
  assert.equal(workspace.find((module) => module.id === 'watchlist')?.collapsed, true);
});
