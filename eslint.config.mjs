import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Diese Website läuft auf vinext (Vite), nicht auf dem Next-Server. Die
    // Client-Navigation von `next/link` bricht dort zur Laufzeit
    // ("TypeError: e is not a function" in startTransition), deshalb verlinkt
    // das Projekt bewusst mit einfachen <a>-Elementen.
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Arbeitsordner von Conductor, u. a. Sicherungen fremder Projekte.
    ".context/**",
  ]),
]);

export default eslintConfig;
