import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      // `export const ElectionStatus = {...}` + `export type ElectionStatus = ...` is the repo's
      // numeric-enum pattern (walfare-web does the same). A value and a type may share a name in
      // TypeScript; both this rule and its @typescript-eslint version flag it anyway — the TS-aware
      // one only exempts interface/namespace merging, not value+type. `tsc` still reports a real
      // duplicate as "Duplicate identifier", so nothing is lost by switching it off.
      "no-redeclare": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["*.config.{js,ts}", "*.config.node.{js,ts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  prettier,
];
