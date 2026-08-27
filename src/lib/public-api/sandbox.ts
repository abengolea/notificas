import { phoneDigits } from "@/lib/parse-campaign-csv";

export type SandboxAllowlist = {
  phones: string[];
  emails: string[];
};

function envList(name: string): string[] {
  return String(process.env[name] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function mergeAllowlist(org: SandboxAllowlist | undefined): SandboxAllowlist {
  const phones = [
    ...(org?.phones || []),
    ...envList("PUBLIC_API_SANDBOX_ALLOWLIST_PHONES"),
  ].map((p) => phoneDigits(p));
  const emails = [
    ...(org?.emails || []),
    ...envList("PUBLIC_API_SANDBOX_ALLOWLIST_EMAILS"),
  ].map((e) => e.trim().toLowerCase());
  return {
    phones: phones.filter(Boolean),
    emails: emails.filter(Boolean),
  };
}

export function isSandboxRecipientAllowed(opts: {
  allowlist: SandboxAllowlist;
  phone?: string;
  email?: string;
}): boolean {
  const phone = phoneDigits(opts.phone);
  const email = (opts.email || "").trim().toLowerCase();
  if (phone && opts.allowlist.phones.includes(phone)) return true;
  if (email && opts.allowlist.emails.includes(email)) return true;
  return false;
}
