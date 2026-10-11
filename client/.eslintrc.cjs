module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      // Legacy Vite client that the Next.js migration (Phase 1, task 1.18) rewrites; remove entries as files are rewritten
      files: [
        'src/components/Auth/SigninForm.tsx',
        'src/components/Auth/SignupForm.tsx',
        'src/components/Game/FileEditor/CodeEditor.tsx',
        'src/hooks/auth.ts',
        'src/hooks/pages/Game.ts',
        'src/hooks/store/auth.api.ts',
        'src/hooks/store/users.api.ts',
        'src/store/app.reducer.ts',
        'src/store/auth.api.ts'
      ],
      rules: { '@typescript-eslint/no-explicit-any': 'off', 'react-hooks/exhaustive-deps': 'off' }
    }
  ]
}
