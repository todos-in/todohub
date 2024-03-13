import type { Config } from 'jest'

const config: Config = {
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
        tsconfig: 'tsconfig.test.json',
        useESM: true,
      },
    ],
  },
  coverageReporters: [
    'json-summary',
    'text',
    'lcov',
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    './src/**',
  ],
}


export default config
