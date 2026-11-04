// Build the static export served by GitHub Pages at /cc/.
// Route handlers (src/app/api/**) cannot exist in an export, so they are
// moved aside for the duration of the build and restored afterwards.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "src", "app", "api");
const apiStash = path.join(root, "src", "_api_disabled");
const outDir = path.join(root, "out");

// Server actions cannot exist in an export, so the two action modules are
// swapped for the localStorage-backed stand-in while the build runs.
const lib = path.join(root, "src", "lib");
const stub = path.join(lib, "actions.static.ts");
const swaps = [
  ["actions.ts", "actions.server.ts"],
  ["admin-actions.ts", "admin-actions.server.ts"],
];

const run = (cmd, env = {}) =>
  execSync(cmd, { stdio: "inherit", cwd: root, env: { ...process.env, ...env } });

// The server needs dynamic session-dependent layouts. Static Pages export
// replaces this directive temporarily so seeded demo routes are prerendered.
const dynamicLayouts = ["patient", "clinician"].map((zone) => path.join(root, "src", "app", zone, "layout.tsx"));
const restoredLayouts = [];
const stashed = [];
let apiStashed = false;
try {
  if (fs.existsSync(apiStash)) fs.rmSync(apiStash, { recursive: true, force: true });
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, apiStash);
    apiStashed = true;
  }
  for (const [live, parked] of swaps) {
    const livePath = path.join(lib, live);
    const parkPath = path.join(lib, parked);
    if (!fs.existsSync(livePath)) continue;
    fs.renameSync(livePath, parkPath);
    fs.copyFileSync(stub, livePath);
    stashed.push([live, parked]);
  }
  for (const filename of dynamicLayouts) {
    const original = fs.readFileSync(filename, "utf8");
    const directive = 'export const dynamic = "force-dynamic";';
    if (!original.includes(directive)) throw new Error(`Missing dynamic directive: ${filename}`);
    restoredLayouts.push([filename, original]);
    fs.writeFileSync(filename, original.replace(directive, 'export const dynamic = "force-static";'));
  }
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });

  run("npx next build", {
    BUILD_TARGET: "static",
    NEXT_PUBLIC_STATIC_EXPORT: "1",
    DATABASE_URL: "file:./dev.db",
  });
 } finally {
  for (const [filename, original] of restoredLayouts) fs.writeFileSync(filename, original);
  for (const [live, parked] of stashed) {
    const livePath = path.join(lib, live);
    const parkPath = path.join(lib, parked);
    if (fs.existsSync(parkPath)) {
      fs.rmSync(livePath, { force: true });
      fs.renameSync(parkPath, livePath);
    }
  }
  if (apiStashed) fs.renameSync(apiStash, apiDir);
}

if (!fs.existsSync(outDir)) {
  console.error("build:static — no out/ directory produced");
  process.exit(1);
}

fs.writeFileSync(path.join(outDir, ".nojekyll"), "");

const count = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
    const p = path.join(dir, e.name);
    return n + (e.isDirectory() ? count(p) : 1);
  }, 0);

console.log(`build:static — out/ ready (${count(outDir)} files)`);
