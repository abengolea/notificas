const PREFIX = "[Notificas Extension]";

function redact(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]+/g, "[redacted-token]");
}

export function extensionLog(message, extra) {
  if (extra === undefined) {
    console.info(`${PREFIX} ${redact(message)}`);
    return;
  }
  console.info(`${PREFIX} ${redact(message)}`, typeof extra === "string" ? redact(extra) : extra);
}

export function apiLog({ env, method, path, status, detail }) {
  const parts = [
    `API: ${env}`,
    `request: ${method} ${path}`,
  ];
  if (status != null) parts.push(`response: ${status}`);
  if (detail) parts.push(detail);
  extensionLog(parts.join(" "));
}
