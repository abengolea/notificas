/**
 * Escribe el HTML institucional de Vaca Muerta para verificar preview
 * de escritorio y móvil. No envía nada.
 *
 *   npx tsx scripts/marketing/write-campaign-preview.ts
 */
import fs from "fs";
import path from "path";
import { previewCampaignEmail, VACA_MUERTA_OILFIELD_CONTENT } from "../../src/lib/marketing/campaign-email";

const outDir = path.join(process.cwd(), ".impeccable", "review");
fs.mkdirSync(outDir, { recursive: true });
const { html, text } = previewCampaignEmail(VACA_MUERTA_OILFIELD_CONTENT);
fs.writeFileSync(path.join(outDir, "campaign-email-preview.html"), html, "utf8");
fs.writeFileSync(path.join(outDir, "campaign-email-preview.txt"), text, "utf8");
console.log("html", path.join(outDir, "campaign-email-preview.html"));
console.log("textBytes", text.length);
console.log("htmlBytes", html.length);
console.log("sent", false);
