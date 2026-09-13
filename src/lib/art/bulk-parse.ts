import { toWhatsAppPhone } from "@/lib/parse-campaign-csv";
import { digitsOnly, normalizeCuil, normalizeDni, normalizeEmail } from "@/lib/art/ids";

export type ArtBulkRowInput = {
  cuil?: string;
  dni?: string;
  nombre?: string;
  apellido?: string;
  fullName?: string;
  telefono?: string;
  phone?: string;
  email?: string;
  externalId?: string;
};

export type ArtBulkRowParsed = {
  cuil: string;
  dni: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string;
  externalId: string | null;
};

export type ArtBulkRowError = {
  row: number;
  message: string;
};

const HEADER_MAP: Record<string, keyof ArtBulkRowInput> = {
  cuil: "cuil",
  cuit: "cuil",
  dni: "dni",
  documento: "dni",
  nombre: "nombre",
  apellido: "apellido",
  fullname: "fullName",
  "nombre y apellido": "fullName",
  telefono: "telefono",
  teléfono: "telefono",
  phone: "phone",
  celular: "telefono",
  email: "email",
  mail: "email",
  correo: "email",
  externalid: "externalId",
  external_id: "externalId",
  idexterno: "externalId",
  legajo: "externalId",
};

export function normalizeHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseArtBulkRow(raw: ArtBulkRowInput, rowNumber: number): { ok: true; value: ArtBulkRowParsed } | { ok: false; error: ArtBulkRowError } {
  const cuil = normalizeCuil(raw.cuil);
  const dni = normalizeDni(raw.dni);
  if (cuil.length !== 11) {
    return { ok: false, error: { row: rowNumber, message: "CUIL inválido (11 dígitos)" } };
  }
  if (dni.length < 7 || dni.length > 9) {
    return { ok: false, error: { row: rowNumber, message: "DNI inválido" } };
  }
  const firstName = String(raw.nombre || "").trim();
  const lastName = String(raw.apellido || "").trim();
  const fullName = String(raw.fullName || `${firstName} ${lastName}`).trim();
  if (fullName.length < 2) {
    return { ok: false, error: { row: rowNumber, message: "Nombre requerido" } };
  }
  const phoneRaw = String(raw.telefono || raw.phone || "").trim();
  const phone = toWhatsAppPhone(phoneRaw) || "";
  if (!phone) {
    return { ok: false, error: { row: rowNumber, message: "Teléfono inválido" } };
  }
  const email = normalizeEmail(raw.email);
  return {
    ok: true,
    value: {
      cuil,
      dni,
      firstName: firstName || fullName.split(/\s+/)[0] || "",
      lastName: lastName || fullName.split(/\s+/).slice(1).join(" "),
      fullName,
      phone,
      email,
      externalId: raw.externalId?.trim() || null,
    },
  };
}

export function parseCsvArtBulk(text: string): { rows: ArtBulkRowParsed[]; errors: ArtBulkRowError[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: [{ row: 0, message: "Archivo vacío" }] };
  const header = splitCsvLine(lines[0]).map(normalizeHeader);
  const mapped = header.map((h) => HEADER_MAP[h] || null);
  if (!mapped.includes("cuil") || !mapped.includes("dni")) {
    return { rows: [], errors: [{ row: 1, message: "El CSV debe incluir columnas CUIL y DNI" }] };
  }
  const rows: ArtBulkRowParsed[] = [];
  const errors: ArtBulkRowError[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const raw: ArtBulkRowInput = {};
    mapped.forEach((key, idx) => {
      if (!key) return;
      (raw as Record<string, string>)[key] = cells[idx] || "";
    });
    const parsed = parseArtBulkRow(raw, i + 1);
    if (parsed.ok) rows.push(parsed.value);
    else errors.push(parsed.error);
  }
  return { rows, errors };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function lookupKey(orgId: string, cuil: string): string {
  return `${orgId}_${digitsOnly(cuil)}`;
}
