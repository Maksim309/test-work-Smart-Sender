import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "public/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      curly: ["error", "all"],
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
        {
          blankLine: "always",
          prev: ["function", "class", "block-like"],
          next: "*",
        },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
        { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
      ],
      "lines-between-class-members": [
        "error",
        "always",
        { exceptAfterSingleLine: true },
      ],
    },
  },
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute > JSXExpressionContainer > :matches(ArrowFunctionExpression, FunctionExpression)",
          message: "Define a named handler before JSX and pass its reference.",
        },
      ],
    },
  },
);
