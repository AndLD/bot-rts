module.exports = {
  root: true,
  env: { node: true, es2020: true, jest: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['ts-built', 'logs', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      // Legacy Express code that the NestJS migration (Phase 1) replaces; remove entries as the files are rewritten
      files: [
        'controllers/private/statistics.ts',
        'middlewares/decorators.ts',
        'middlewares/validation.ts',
        'routers/private/auth.ts',
        'services/map.ts',
        'utils/api.ts',
        'utils/decorators.ts',
        'utils/types.ts',
        'utils/utils.ts'
      ],
      rules: { '@typescript-eslint/no-explicit-any': 'off' }
    }
  ]
}
