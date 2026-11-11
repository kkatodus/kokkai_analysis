// Design-token ratchet (specs/design-system §7): counts off-system class patterns in app/**/*.ts{,x}
// and fails if any count is above frontend/design-baseline.json. `--update` lowers the baseline to
// today's counts (never raises it). When every count reaches 0 the check becomes a plain ban.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "design-baseline.json");

// regexes from the §2 table
const PATTERNS = {
  "arbitrary-text-size": /text-\[[0-9.]+(px|rem)\]/g,
  "gray-utilities": /(text|bg|border|fill|stroke|ring|placeholder:text|decoration)-gray-[0-9]+/g,
  "blue-utilities": /(text|bg|border|ring|shadow)-blue-[0-9]+/g,
  "hex-in-class": /(bg|text|border|from|to|via)-\[#[0-9a-fA-F]+\]/g,
  "slate-with-opacity": /(bg|border|text|ring)-slate-[0-9]+\/[0-9]+/g,
  "white-black-alpha": /(bg|border|text)-(white|black)\/[0-9]+/g,
  "off-scale-radius": /rounded(-[a-z]+)?-\[[^\]]+\]|rounded(-[a-z]+)?-(md|3xl)\b/g,
  "arbitrary-shadow": /shadow-\[[^\]]+\]/g,
  "arbitrary-z-index": /z-\[[0-9]+\]/g,
  "outline-none": /outline-none/g,
  "english-aria-label": /aria-label="[A-Za-z][^"]*"/g,
};

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.tsx?$/.test(entry.name)) yield path;
  }
}

const counts = Object.fromEntries(Object.keys(PATTERNS).map((k) => [k, 0]));
for (const file of sourceFiles(join(root, "app"))) {
  const text = readFileSync(file, "utf8");
  for (const [name, re] of Object.entries(PATTERNS)) counts[name] += text.match(re)?.length ?? 0;
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

if (process.argv.includes("--update")) {
  const next = Object.fromEntries(Object.keys(PATTERNS).map((k) => [k, Math.min(counts[k], baseline[k] ?? counts[k])]));
  writeFileSync(baselinePath, JSON.stringify(next, null, 2) + "\n");
  console.log("design-baseline.json updated:", next);
  process.exit(0);
}

let failed = false;
let lowered = false;
for (const name of Object.keys(PATTERNS)) {
  const limit = baseline[name] ?? 0;
  if (counts[name] > limit) {
    failed = true;
    console.error(`design tokens: ${name} ${counts[name]} > baseline ${limit} (use the tokens in frontend/DESIGN.md)`);
  } else if (counts[name] < limit) lowered = true;
}
if (failed) process.exit(1);
if (lowered) console.log("design tokens: counts fell below the baseline; run `node scripts/check-design-tokens.mjs --update` to lock it in");
