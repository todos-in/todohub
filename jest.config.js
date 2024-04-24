/** @type {import('jest').Config} */

const config = {
  // preset: 'ts-jest/presets/js-with-ts-esm',
  verbose: true,
  clearMocks: true,
  testEnvironment: 'node',
  moduleFileExtensions: [
    'js',
    'ts',
  ],
  extensionsToTreatAsEsm: [
    '.ts',
  ],
  testMatch: [
    '**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  moduleNameMapper: {
    '^(\\.\\.?\\/.+)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        useESM: true,
      },
    ],
  },
  coverageReporters: [
    'json-summary',
    'text',
    'lcov',
  ],
  collectCoverage: false,
  collectCoverageFrom: [
    './src/**',
  ],
  // These are either mocked or not tested test environment, so it does not make sense do collect coverage on these
  coveragePathIgnorePatterns: [
    './src/index.ts',
    './src/service/logger.ts',
    './src/service/octokit.ts',
    './src/service/config.ts',
  ],
}


export default config
