const nextJest = require('next/jest')

const createJestConfig = nextJest({ dir: __dirname })

const customJestConfig = {
  rootDir: __dirname,
  roots: ['<rootDir>'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
}

module.exports = createJestConfig(customJestConfig)
