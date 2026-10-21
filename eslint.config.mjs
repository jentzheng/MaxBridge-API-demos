import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import perfectionist from "eslint-plugin-perfectionist";
import pluginRouter from "@tanstack/eslint-plugin-router";

export default defineConfig([
  globalIgnores(["dist", "examples"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    plugins: {
      "@tanstack/router": pluginRouter,
    },
    rules: {
      "@tanstack/router/create-route-property-order": "error",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [],
    plugins: {
      perfectionist,
    },
    rules: {
      "perfectionist/sort-imports": "error",
      "react-refresh/only-export-components": [
        "error",
        {
          allowCompoundComponents: true,
          extraHOCs: [
            "observer",
            "withAuth",
            "createFileRoute",
            "createLazyFileRoute",
            "createRootRoute",
            "createRootRouteWithContext",
            "createLink",
            "createRoute",
            "createLazyRoute",
          ],
        },
      ],
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
