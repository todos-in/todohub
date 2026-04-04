import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import jest from 'eslint-plugin-jest'
import todohub from 'eslint-plugin-todohub'

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      'git_tests/',
      'jest.config.js',
      'script/**',
      'ignore-wrapper/',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.test.ts', '**/*.test.js', '__tests__/**/*.ts'],
    ...jest.configs['flat/recommended'],
  },
  {
    plugins: { todohub },
    rules: {
      ...todohub.configs.recommended.rules,
    },
  },
  {
    files: ['**/*.ts', '**/*.js'],
    plugins: {
      '@stylistic': stylistic,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly',
      },
    },
    rules: {
      // Stylistic rules
      '@stylistic/indent': ['error', 2],
      '@stylistic/quote-props': ['error', 'consistent-as-needed'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/function-call-spacing': ['error', 'never'],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/space-before-function-paren': 'off',
      '@stylistic/type-annotation-spacing': 'error',

      // TypeScript rules
      '@typescript-eslint/array-type': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/explicit-member-accessibility':
        ['error', { accessibility: 'no-public' }],
      '@typescript-eslint/no-array-constructor': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-useless-constructor': 'error',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-function-type': 'warn',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/unbound-method': 'error',
    },
  },
)
