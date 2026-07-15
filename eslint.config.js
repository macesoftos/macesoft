import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "node_modules/**", "tmp/**", ".codex-*/**", "public/facetrack-models/**"] },
  {
    files: ["src/**/*.{js,jsx}"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "no-unused-vars": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["server/**/*.js", "scripts/**/*.mjs", "*.js"],
    ...js.configs.recommended,
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
    rules: { "no-unused-vars": "off" },
  },
  {
    files: ["server/**/*.test.js", "server/api-smoke-test.js", "e2e/**/*.js", "playwright.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
