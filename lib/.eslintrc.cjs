module.exports = {
  root: true,
  env: { es2020: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  rules: { 'no-console': 'error' },
  overrides: [
    {
      // The game rules in lib are pure: the clock and the generator are passed in (design §12.4)
      files: ['utils/**/*.ts'],
      excludedFiles: ['**/*.test.ts'],
      rules: {
        'no-restricted-properties': [
          'error',
          { object: 'Date', property: 'now', message: 'Pass the time in; do not read Date.now().' },
          { object: 'Math', property: 'random', message: 'Pass a seeded generator in; do not call Math.random().' }
        ]
      }
    },
    { files: ['**/*.test.ts'], rules: { 'no-console': 'off' } }
  ]
}
