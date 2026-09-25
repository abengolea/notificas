import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const env = process.argv[2] === "development" ? "development" : "production";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "lib", "env.js");

writeFileSync(
  target,
  `/** Build stamp. \`npm run extension:build\` writes production; \`extension:dev\` writes development. */\nexport const EXTENSION_ENV = "${env}";\n`,
  "utf8",
);

console.log(`[Notificas Extension] stamped ${env} → ${target}`);
if (env === "production") {
  console.log("[Notificas Extension] production API: https://notificas.com.ar");
}
