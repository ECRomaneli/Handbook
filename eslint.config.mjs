import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'web/**', '*.js', '*.mjs'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    },
  },
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/indent': ['error', 2],                    // 2-space indentation
      '@stylistic/quotes': ['error', 'single'],             // Single quotes
      '@stylistic/semi': ['error', 'always'],               // Require semicolons
      '@stylistic/comma-dangle': ['error', 'always-multiline'], // Trailing comma on multiline
      '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }], // Braces on the same line allowed
      '@stylistic/arrow-parens': ['error', 'always'],       // (x) => x
      '@stylistic/object-curly-spacing': ['error', 'always'], // { foo: bar }
      '@stylistic/array-bracket-spacing': ['error', 'never'], // [1, 2, 3]
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }], // Space before/after if, for, while, etc
      '@stylistic/space-before-blocks': ['error', { functions: 'always', keywords: 'always', classes: 'always' }], // Space before {
      '@stylistic/max-len': ['warn', {
        code: 120,
        ignorePattern: '^import ',
        ignoreUrls: true,
        ignoreStrings: false,
        ignoreComments: false
      }],
      '@stylistic/eol-last': ['error', 'always'],           // Ensure blank line at EOF
      '@stylistic/no-trailing-spaces': 'error',             // Disallow trailing spaces
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1 }], // Max one empty line
    },
  },
];