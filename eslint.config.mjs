import { FlatCompat } from '@eslint/eslintrc'
import testingLibrary from 'eslint-plugin-testing-library'
import jestDom from 'eslint-plugin-jest-dom'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'dist/**', 'coverage/**']
  },
  ...compat.extends('next/core-web-vitals'),
  {
    files: ['**/*.test.{ts,tsx,js,jsx}'],
    plugins: { 'testing-library': testingLibrary, 'jest-dom': jestDom },
    rules: {
      'testing-library/no-node-access': 'off'
    }
  }
]

