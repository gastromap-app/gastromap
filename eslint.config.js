import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.claude']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      react,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        vi: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  // Architecture boundary: features may NOT import from other features.
  // Each feature is isolated; shared code lives in src/shared/ or src/lib/.
  {
    files: ['src/features/admin/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [{
          group: ['@/features/auth/**', '@/features/dashboard/**', '@/features/public/**'],
          message: 'Cross-feature imports are forbidden. Move shared code to src/shared/ or src/lib/.',
        }],
      }],
    },
  },
  {
    files: ['src/features/auth/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [{
          group: ['@/features/admin/**', '@/features/dashboard/**', '@/features/public/**'],
          message: 'Cross-feature imports are forbidden. Move shared code to src/shared/ or src/lib/.',
        }],
      }],
    },
  },
  {
    files: ['src/features/dashboard/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [{
          group: ['@/features/admin/**', '@/features/auth/**', '@/features/public/**'],
          message: 'Cross-feature imports are forbidden. Move shared code to src/shared/ or src/lib/.',
        }],
      }],
    },
  },
  {
    files: ['src/features/public/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [{
          group: ['@/features/admin/**', '@/features/auth/**', '@/features/dashboard/**'],
          message: 'Cross-feature imports are forbidden. Move shared code to src/shared/ or src/lib/.',
        }],
      }],
    },
  },
  // Test files: relax certain rules that are common patterns in tests
  {
    files: ['**/*.test.{js,jsx}', '**/__tests__/**/*.{js,jsx}'],
    rules: {
      'no-unused-vars': 'warn',
      'no-global-assign': 'warn',
    },
  },
])
