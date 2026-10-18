module.exports = {
  preset: 'jest-expo',
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  testMatch: ['<rootDir>/tests/screens/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/screens/setup.js'],
  moduleNameMapper: {
    '\\.svg$': '<rootDir>/tests/screens/svg-mock.js',
  },
  clearMocks: true,
  restoreMocks: true,
};
