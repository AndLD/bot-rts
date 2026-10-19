module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['.next', 'coverage', 'next-env.d.ts', 'next.config.ts', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'error'
  },
  overrides: [{ files: ['**/*.test.ts', '**/*.test.tsx', 'cypress/**/*.ts'], rules: { 'no-console': 'off' } }]
}
