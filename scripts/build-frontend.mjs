// Assembles the integration's frontend files from their ES modules: every src/<stem>/index.js becomes
// custom_components/<domain>/frontend/<stem>.js, the classic script Home Assistant loads (scripts/bundle.mjs: the
// modules concatenated in the entry's order, imports removed, the translation table rebuilt as one literal).
// Those files are build output, not committed (.gitignore): run this before the tests, the screenshots,
// scripts/split-frontend.mjs and the release zip. Needs acorn (npm install --no-save --no-package-lock acorn@8.19.0).
// Usage: node scripts/build-frontend.mjs
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "./bundle.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const [domain] = readdirSync(`${root}custom_components`);
const out = `${root}custom_components/${domain}/frontend`;

const stems = readdirSync(`${root}src`).filter((d) => existsSync(`${root}src/${d}/index.js`));
if (!stems.length) throw new Error("no src/<stem>/index.js to assemble");
for (const stem of stems) {
  const code = bundle(`src/${stem}/index.js`);
  writeFileSync(`${out}/${stem}.js`, code);
  console.log(`src/${stem}/ → custom_components/${domain}/frontend/${stem}.js (${(code.length / 1024).toFixed(1)} KB)`);
}
