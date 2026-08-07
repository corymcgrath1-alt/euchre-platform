import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: dirname(require.resolve("eslint-config-next/package.json"))
});

const eslintConfig = [
  {
    ignores: [".data/**", ".next/**", ".next-stale-*/**", ".tools/**", "node_modules/**", "dist-mobile/**", "ios/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript")
];

export default eslintConfig;
