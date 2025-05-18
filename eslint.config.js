import js from "@eslint/js";
import globals from "globals";
import markdown from "@eslint/markdown";
import { defineConfig } from "eslint/config";


export default defineConfig([
  { ignores: ['web/**/*.js'] },
  { files: ["**/*.js"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.node }  },
  { files: ["**/*.md"], plugins: { markdown }, language: "markdown/gfm", extends: ["markdown/recommended"] }
]);
