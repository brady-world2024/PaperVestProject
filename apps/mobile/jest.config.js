module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.tsx'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
};
