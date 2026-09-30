import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import testingLibrary from 'eslint-plugin-testing-library'
import jestDom from 'eslint-plugin-jest-dom'

const config = [
  {
    ignores: [
      '.claude/worktrees/**',
      '.next/**',
      'node_modules/**',
      'out/**',
      'dist/**',
      'coverage/**',
      'src-tauri/target/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['**/*.test.{ts,tsx,js,jsx}'],
    ...testingLibrary.configs['flat/react'],
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}'],
    ...jestDom.configs['flat/recommended'],
  },
  {
    files: ['**/*.test.{ts,tsx,js,jsx}'],
    rules: {
      'testing-library/no-node-access': 'off',
    },
  },
]

export default config
