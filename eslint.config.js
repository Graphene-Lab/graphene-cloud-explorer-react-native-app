const eslint = require('@eslint/js');
const reactPlugin = require('eslint-plugin-react');
const reactNativePlugin = require('eslint-plugin-react-native');

module.exports = [
  eslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['node_modules/**', 'build/**', 'dist/**'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      react: reactPlugin,
      'react-native': reactNativePlugin
    },
    rules: {
      'space-before-function-paren': 'error',
      'semi': ['error', 'always'],
      'no-undef': 'error',
      'no-unused-vars': 'warn',
      'react/react-in-jsx-scope': 'off'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['jest.config.js', 'tests/screens/**/*.js'],
    languageOptions: {
      globals: {
        jest: 'readonly', expect: 'readonly', test: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly',
        require: 'readonly', module: 'readonly', global: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly', AbortSignal: 'readonly',
      },
    },
    rules: {
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
    },
  },
];
