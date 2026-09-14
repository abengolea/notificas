import { createHash } from "crypto";
import { parseCountry, type MarketingCountryCode } from "./countries";

export type ParsedContactRow = {
  email: string;
  name: string;
  company: string;
  title: string;
  country: MarketingCountryCode;
  notes: string;
};

export type CsvParseResult = {
  rows: ParsedContactRow[];
  errors: Array<{ line: number; message: string }>;
  skipped: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function contactIdForEmail(email: string): string {
  return createHash("sha256").update(`mkt:${normalizeEmail(email)}`).digest("hex").slice(0, 40);
}

export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_RE.test(email);
}

/** CSV con comillas, comas y saltos de línea entre comillas. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === "," || ch === ";" || ch === "\t") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function headerKey(raw: string): string {
  const folded = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const aliases: Record<string, string> = {
    email: "email",
    mail: "email",
    correo: "email",
    correoelectronico: "email",
    e: "email",
    nombre: "name",
    name: "name",
    contacto: "name",
    empresa: "company",
    company: "company",
    organizacion: "company",
    organisation: "company",
    cargo: "title",
    title: "title",
    puesto: "title",
    rol: "title",
    pais: "country",
    country: "country",
    nacion: "country",
    notas: "notes",
    notes: "notes",
    comentario: "notes",
    comentarios: "notes",
  };
  return aliases[folded] || folded;
}

export function parseContactCsv(text: string): CsvParseResult {
  const table = parseCsvText(text);
  const errors: CsvParseResult["errors"] = [];
  const rows: ParsedContactRow[] = [];
  if (table.length === 0) {
    return { rows, errors: [{ line: 1, message: "El archivo está vacío." }], skipped: 0 };
  }

  const header = table[0].map(headerKey);
  const emailIdx = header.indexOf("email");
  if (emailIdx < 0) {
    return {
      rows,
      errors: [{ line: 1, message: "Falta la columna email / correo." }],
      skipped: 0,
    };
  }
  const idx = (key: string) => header.indexOf(key);
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const cols = table[i];
    const email = normalizeEmail(cols[emailIdx] || "");
    if (!email) {
      skipped += 1;
      continue;
    }
    if (!isValidEmail(email)) {
      errors.push({ line, message: `Email inválido: ${cols[emailIdx] || ""}` });
      continue;
    }
    if (seen.has(email)) {
      skipped += 1;
      continue;
    }
    const countryRaw = idx("country") >= 0 ? cols[idx("country")] || "" : "";
    const country = parseCountry(countryRaw);
    if (!country) {
      errors.push({
        line,
        message: countryRaw.trim()
          ? `País no reconocido: ${countryRaw.trim()}`
          : "Falta el país (AR, BR, ES, …).",
      });
      continue;
    }
    seen.add(email);
    const pick = (key: string) => {
      const j = idx(key);
      return j >= 0 ? String(cols[j] || "").trim() : "";
    };
    rows.push({
      email,
      name: pick("name"),
      company: pick("company"),
      title: pick("title"),
      country,
      notes: pick("notes"),
    });
  }

  return { rows, errors, skipped };
}
