import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cashFlowFormSchema,
  changePasswordFormSchema,
  forgotPasswordFormSchema,
  resetPasswordFormSchema,
} from '@papervest/validation';

test('forgot-password form accepts a valid email address', () => {
  const parsed = forgotPasswordFormSchema.parse({
    email: 'person@example.com',
  });

  assert.equal(parsed.email, 'person@example.com');
});

test('reset-password form rejects mismatched confirmation', () => {
  const result = resetPasswordFormSchema.safeParse({
    password: 'SecurePass1',
    confirmPassword: 'SecurePass2',
  });

  assert.equal(result.success, false);
  if (result.success) {
    return;
  }

  assert.equal(result.error.flatten().fieldErrors.confirmPassword?.[0], 'Passwords must match');
});

test('change-password form enforces current password and strong replacement password', () => {
  const result = changePasswordFormSchema.safeParse({
    currentPassword: '',
    newPassword: 'weak',
    confirmNewPassword: 'weak',
  });

  assert.equal(result.success, false);
  if (result.success) {
    return;
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  assert.equal(fieldErrors.currentPassword?.[0], 'Enter your current password');
  assert.ok(fieldErrors.newPassword?.length);
});

test('cash flow form accepts positive amounts and trims memo', () => {
  const parsed = cashFlowFormSchema.parse({
    amount: '1250.55',
    memo: '  biweekly simulation deposit  ',
  });

  assert.equal(parsed.amount, '1250.55');
  assert.equal(parsed.memo, 'biweekly simulation deposit');
});

test('cash flow form rejects non-positive amounts and long memo', () => {
  const result = cashFlowFormSchema.safeParse({
    amount: '0',
    memo: 'x'.repeat(121),
  });

  assert.equal(result.success, false);
  if (result.success) {
    return;
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  assert.equal(fieldErrors.amount?.[0], 'Amount must be greater than zero');
  assert.equal(fieldErrors.memo?.[0], 'Memo must be 120 characters or fewer');
});

test('cash flow form rejects sub-cent precision and backend amount overflow', () => {
  const subCentResult = cashFlowFormSchema.safeParse({
    amount: '1.234',
    memo: '',
  });

  assert.equal(subCentResult.success, false);
  if (!subCentResult.success) {
    assert.equal(
      subCentResult.error.flatten().fieldErrors.amount?.[0],
      'Use dollars and cents with no more than two decimal places'
    );
  }

  const overflowResult = cashFlowFormSchema.safeParse({
    amount: '1000000000000.00',
    memo: '',
  });

  assert.equal(overflowResult.success, false);
  if (!overflowResult.success) {
    assert.equal(
      overflowResult.error.flatten().fieldErrors.amount?.[0],
      'Amount must be 999,999,999,999.99 or less'
    );
  }
});
