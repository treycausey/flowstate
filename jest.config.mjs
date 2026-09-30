import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: import.meta.dirname })

/** @type {import('jest').Config} */
const customJestConfig = {
  rootDir: import.meta.dirname,
  roots: ['<rootDir>'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
  modulePathIgnorePatterns: [
    '<rootDir>/src-tauri/target/',
    '<rootDir>/out/',
    '<rootDir>/.next/',
    '<rootDir>/.claude/worktrees/',
  ],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/worktrees/'],
}

export default createJestConfig(customJestConfig)
