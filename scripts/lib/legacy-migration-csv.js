"use strict";

const fs = require("fs");

/**
 * Parser CSV mínimo (comillas RFC básicas).
 */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Normaliza email del CSV.
 * Importante: NO usar String.replace(/@/, ...) devolviendo el email completo — solo reemplaza
 * el carácter @ y duplica local + dominio (p. ej. useruser@dom.comdom.com).
 */
function normalizeLegacyEmail(raw) {
  if (!raw || typeof raw !== "string") return "";
  let e = raw.trim().replace(/^<|>$/g, "").toLowerCase();
  e = e.replace(/\s+/g, "");
  const at = e.indexOf("@");
  if (at === -1) return "";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  return `${local}@${domain}`.trim();
}

function buildLegacyDisplayName(first, last, email) {
  const a = (first || "").trim();
  const b = (last || "").trim();
  const combined = [a, b].filter(Boolean).join(" ").trim();
  if (combined) return combined.slice(0, 100);
  const local = (email || "").split("@")[0] || "Usuario";
  return local.slice(0, 100);
}

function isPlausibleEmail(e) {
  if (!e || e.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  if (e.includes("..")) return false;
  return true;
}

function readLegacyCsvRows(csvPath) {
  const raw = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV vacío o sin datos.");
  }
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = (name) => header.indexOf(name);

  const iId = idx("id");
  const iEmail = idx("email");
  if (iEmail < 0) throw new Error('CSV debe incluir columna "email".');

  const rows = [];
  for (let n = 1; n < lines.length; n++) {
    const cells = parseCsvLine(lines[n]);
    if (cells.length < header.length && cells.every((c) => !c)) continue;
    const email = normalizeLegacyEmail(cells[iEmail] ?? "");
    const legacyId = iId >= 0 ? parseInt(String(cells[iId] ?? "").trim(), 10) : NaN;
    rows.push({
      line: n + 1,
      legacyUserId: Number.isFinite(legacyId) ? legacyId : null,
      email,
      firstname: cells[idx("firstname")] ?? "",
      lastname: cells[idx("lastname")] ?? "",
      phonenumber: cells[idx("phonenumber")] ?? "",
      creditos: parseInt(String(cells[idx("creditos_en_haber")] ?? "0").trim(), 10) || 0,
      cantidadComprobantes:
        parseInt(String(cells[idx("cantidad_comprobantes")] ?? "0").trim(), 10) || 0,
    });
  }
  return rows;
}

module.exports = {
  parseCsvLine,
  normalizeLegacyEmail,
  buildLegacyDisplayName,
  isPlausibleEmail,
  readLegacyCsvRows,
};
