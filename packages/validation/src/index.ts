import { z } from 'zod';

const CASH_FLOW_AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const CASH_FLOW_MAX_AMOUNT = 999_999_999_999.99;

export const emailSchema = z.string().email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Add at least one uppercase letter')
  .regex(/[a-z]/, 'Add at least one lowercase letter')
  .regex(/[0-9]/, 'Add at least one number');

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const registerFormSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });

export const forgotPasswordFormSchema = z.object({
  email: emailSchema,
});

export const resetPasswordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.newPassword === values.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'Passwords must match',
  });

export const deleteAccountFormSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
});

export const cashFlowFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Enter an amount')
    .refine((value) => !Number.isNaN(Number(value)), 'Enter a valid amount')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero')
    .refine(
      (value) => CASH_FLOW_AMOUNT_PATTERN.test(value),
      'Use dollars and cents with no more than two decimal places'
    )
    .refine(
      (value) => Number(value) <= CASH_FLOW_MAX_AMOUNT,
      'Amount must be 999,999,999,999.99 or less'
    ),
  memo: z
    .string()
    .trim()
    .max(120, 'Memo must be 120 characters or fewer')
    .optional()
    .default(''),
});

export const tradeFormSchema = z.object({
  quantity: z
    .string()
    .min(1, 'Enter the quantity to trade')
    .refine((value) => !Number.isNaN(Number(value)), 'Enter a valid number')
    .refine((value) => Number(value) > 0, 'Quantity must be greater than zero'),
});

export const stockSearchSchema = z
  .string()
  .trim()
  .min(1, 'Enter a ticker or company name')
  .max(32, 'Search must be 32 characters or fewer');

export const conditionalOrderFormSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, 'Enter a stock symbol')
    .max(16, 'Symbol must be 16 characters or fewer'),
  side: z.enum(['BUY', 'SELL']),
  targetPrice: z
    .string()
    .min(1, 'Enter a target price')
    .refine((value) => !Number.isNaN(Number(value)), 'Enter a valid price')
    .refine((value) => Number(value) > 0, 'Target price must be greater than zero'),
  quantity: z
    .string()
    .min(1, 'Enter the quantity to trade')
    .refine((value) => !Number.isNaN(Number(value)), 'Enter a valid quantity')
    .refine((value) => Number(value) > 0, 'Quantity must be greater than zero'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
export type DeleteAccountFormValues = z.infer<typeof deleteAccountFormSchema>;
export type CashFlowFormValues = z.infer<typeof cashFlowFormSchema>;
export type TradeFormValues = z.infer<typeof tradeFormSchema>;
export type ConditionalOrderFormValues = z.infer<typeof conditionalOrderFormSchema>;

export function normalizeTradeQuantity(quantity: string) {
  return Number(quantity);
}

export function normalizeConditionalOrderNumber(value: string) {
  return Number(value);
}

export function normalizeCashFlowAmount(amount: string) {
  return Number(amount);
}
