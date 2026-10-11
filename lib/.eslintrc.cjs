module.exports = {
  root: true,
  env: { es2020: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['.eslintrc.cjs'],
  parser: '@typescript-eslint/parser'
}
