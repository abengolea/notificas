export function maskPhone(phone: string | undefined | null): string | undefined {
  const raw = String(phone || "").trim();
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return `${raw.slice(0, 2)}****`;
  const prefix = raw.startsWith("+") ? `+${digits.slice(0, 7)}` : digits.slice(0, 6);
  return `${prefix}******`;
}

export function maskEmail(email: string | undefined | null): string | undefined {
  const raw = String(email || "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return undefined;
  const [user, domain] = raw.split("@");
  if (!user || !domain) return undefined;
  const keep = user.slice(0, Math.min(2, user.length));
  return `${keep}***@${domain}`;
}

export function maskDocument(doc: string | undefined | null): string | undefined {
  const digits = String(doc || "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length <= 4) return "****";
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
}
