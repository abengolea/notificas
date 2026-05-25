/**
 * En Windows, el CLI de Firebase invoca `sh` al analizar functions; sin Git en PATH falla.
 * Este script antepone Git\usr\bin (o Git\bin) y ejecuta firebase deploy.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const roots = [
  path.join(process.env.ProgramFiles || "C:\\Program Files", "Git"),
  path.join(process.env["ProgramFiles(x86)"] || "", "Git"),
].filter(Boolean);

const shDirs = ["usr\\bin", "bin"]
  .map((sub) => roots.map((root) => path.join(root, sub)))
  .flat()
  .filter((dir) => {
    try {
      return fs.existsSync(path.join(dir, "sh.exe"));
    } catch {
      return false;
    }
  });

if (shDirs.length) {
  const prepend = shDirs[0];
  process.env.PATH = `${prepend};${process.env.PATH || ""}`;
}

const projectRoot = path.join(__dirname, "..");
const r = spawnSync("firebase", ["deploy", "--only", "functions", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  cwd: projectRoot,
  env: process.env,
});

process.exit(r.status === null ? 1 : r.status);
