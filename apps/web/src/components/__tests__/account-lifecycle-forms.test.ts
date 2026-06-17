import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
