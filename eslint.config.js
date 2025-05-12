import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  {
    ignores: ["dist/**"],
  },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ...pluginReactConfig,
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "no-unused-vars": [
        "error",
        { "varsIgnorePattern": "^_", "argsIgnorePattern": "^_" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "varsIgnorePattern": "^_", "argsIgnorePattern": "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: "readonly",
      },
    },
  },
  {
    files: ["tailwind.config.js", "postcss.config.js", "vite.config.js", "eslint.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
