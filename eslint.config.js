import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import typescriptParser from '@typescript-eslint/parser';
import typescript from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**', 'out/**', '.turbo/**'],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      '@next/next': nextPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];
