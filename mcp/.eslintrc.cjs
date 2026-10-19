module.exports = {
  root: true,
  env: { node: true, es2020: true, jest: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['ts-built', 'logs', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // The server speaks the protocol on stdout: a stray print would corrupt it
    'no-console': 'error'
  },
  overrides: [{ files: ['**/*.test.ts'], rules: { 'no-console': 'off' } }]
}
