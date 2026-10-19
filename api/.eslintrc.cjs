module.exports = {
  root: true,
  env: { node: true, es2020: true, jest: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['ts-built', 'logs', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'error'
  },
  overrides: [
    {
      // Game logic reads the injected clock and the seeded generator, never the system's (design §12.4). The adapters that
      // wrap the system clock and the generator live in src/shared/infrastructure, outside this scope.
      files: ['src/**/domain/**/*.ts', 'src/engine/**/*.ts'],
      // The supervisor of the engine thread times stalls and stamps the kill of a stalled script on the real clock, by design: it
      // supervises a thread, not the game
      excludedFiles: [
        '**/*.test.ts',
        'src/engine/infrastructure/engine-process.ts',
        'src/engine/infrastructure/kill-stalled.ts'
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "NewExpression[callee.name='Date'][arguments.length=0]",
            message: 'Game logic reads the injected clock (Clock, GAME_CLOCK), not new Date().'
          }
        ],
        'no-restricted-properties': [
          'error',
          {
            object: 'Date',
            property: 'now',
            message: 'Game logic reads the injected clock (Clock, GAME_CLOCK), not Date.now().'
          },
          {
            object: 'Math',
            property: 'random',
            message: 'Game logic draws from the seeded generator (Rng), not Math.random().'
          }
        ]
      }
    },
    {
      // Tests and command-line scripts may print
      files: ['**/*.test.ts', 'tests/**/*.ts', 'scripts/**/*.ts', 'prisma/**/*.ts'],
      rules: { 'no-console': 'off' }
    }
  ]
}
