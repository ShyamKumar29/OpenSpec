import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // INV-7: document content is data, never instruction — never rendered as markup.
    // INV-4: `Unknown` is first-class; the literal "N/A" is banned everywhere.
    rules: {
      "react/no-danger": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value='N/A']",
          message:
            "INV-4: never render the literal 'N/A'. Use <UnknownValue reason=... /> with a machine-readable reason code.",
        },
        {
          selector: "JSXText[value=/N\\/A/]",
          message:
            "INV-4: never render the literal 'N/A'. Use <UnknownValue reason=... /> with a machine-readable reason code.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
