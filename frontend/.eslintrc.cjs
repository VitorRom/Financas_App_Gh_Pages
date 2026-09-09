module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
  rules: {
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Erros engolidos foram a causa de telas em branco na revisão — bloco catch
    // vazio volta a ser erro.
    'no-empty': ['error', { allowEmptyCatch: false }],
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      // Provider + hook de consumo moram no mesmo arquivo de propósito; a regra
      // de fast refresh não se aplica bem a esse padrão.
      files: ['src/context/**/*.jsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
};
