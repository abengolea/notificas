import { maskDocument, maskEmail, maskPhone } from "@/lib/public-api/mask";

export function maskCuil(value: string | undefined | null): string | undefined {
  return maskDocument(value);
}

export function maskFullName(name: string | undefined | null): string {
  const raw = String(name || "").trim();
  if (!raw) return "";
  const parts = raw.split(/\s+/);
  return parts
    .map((p, i) => (i === 0 ? p : `${p.slice(0, 1)}***`))
    .join(" ");
}

export { maskDocument, maskEmail, maskPhone };
