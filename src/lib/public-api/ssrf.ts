import { lookup } from "dns/promises";
import { isIP } from "net";

const PRIVATE_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "internal",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const ipN = ipv4ToInt(ip);
  const baseN = ipv4ToInt(base);
  const bits = Number(bitsStr);
  if (ipN == null || baseN == null || !Number.isInteger(bits)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipN & mask) === (baseN & mask);
}

const IPV4_BLOCKED = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "100.64.0.0/10",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

function isBlockedIPv4(ip: string): boolean {
  return IPV4_BLOCKED.some((c) => ipv4InCidr(ip, c));
}

function isBlockedIPv6(ip: string): boolean {
  const n = ip.toLowerCase();
  if (n === "::1" || n === "::") return true;
  if (n.startsWith("fe80:") || n.startsWith("fc") || n.startsWith("fd")) return true;
  if (n.startsWith("::ffff:")) {
    const v4 = n.slice("::ffff:".length);
    if (isIP(v4) === 4) return isBlockedIPv4(v4);
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIPv4(ip);
  if (version === 6) return isBlockedIPv6(ip);
  return true;
}

export type SsrfCheckResult = { ok: true; hostname: string; ips: string[] } | { ok: false; code: string; message: string };

export function parseWebhookUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Rechaza URLs inseguras (SSRF): localhost, IPs privadas, metadata cloud, no-HTTPS en live.
 */
export function staticWebhookUrlCheck(raw: string, opts: { requireHttps: boolean }): SsrfCheckResult {
  const url = parseWebhookUrl(raw);
  if (!url) return { ok: false, code: "invalid_url", message: "The webhook URL is invalid." };
  if (url.username || url.password) {
    return { ok: false, code: "invalid_url", message: "The webhook URL must not include credentials." };
  }
  if (opts.requireHttps && url.protocol !== "https:") {
    return { ok: false, code: "insecure_url", message: "Webhook URLs must use HTTPS." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, code: "invalid_url", message: "Webhook URLs must use HTTP or HTTPS." };
  }
  const hostname = url.hostname.toLowerCase();
  if (!hostname) return { ok: false, code: "invalid_url", message: "The webhook URL is invalid." };
  if (PRIVATE_HOSTS.has(hostname) || hostname.endsWith(".internal") || hostname.endsWith(".localhost")) {
    return { ok: false, code: "blocked_host", message: "That host is not allowed." };
  }
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return { ok: false, code: "blocked_host", message: "That host is not allowed." };
  }
  const ipVersion = isIP(hostname);
  if (ipVersion && isBlockedIp(hostname)) {
    return { ok: false, code: "blocked_ip", message: "Private or reserved IP addresses are not allowed." };
  }
  return { ok: true, hostname, ips: ipVersion ? [hostname] : [] };
}

export async function resolveAndValidateWebhookUrl(
  raw: string,
  opts: { requireHttps: boolean }
): Promise<SsrfCheckResult> {
  const staticCheck = staticWebhookUrlCheck(raw, opts);
  if (!staticCheck.ok) return staticCheck;
  if (staticCheck.ips.length > 0) return staticCheck;

  try {
    const records = await lookup(staticCheck.hostname, { all: true });
    const ips = records.map((r) => r.address);
    if (ips.length === 0) return { ok: false, code: "unresolvable_host", message: "The webhook host could not be resolved." };
    if (ips.some(isBlockedIp)) {
      return { ok: false, code: "blocked_ip", message: "The webhook host resolves to a private or reserved address." };
    }
    return { ok: true, hostname: staticCheck.hostname, ips };
  } catch {
    return { ok: false, code: "unresolvable_host", message: "The webhook host could not be resolved." };
  }
}
