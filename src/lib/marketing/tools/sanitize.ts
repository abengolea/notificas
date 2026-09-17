const SENSITIVE_KEY =
  /(secret|token|password|passwd|api[-_]?key|authorization|credential|private[-_]?key|gmail|oauth|refresh|cookie|header)/i;

const MAX_STRING = 8_000;

export function stripClientTenant(args: unknown): unknown {
  if (!args || typeof args !== "object" || Array.isArray(args)) return args;
  const rec = { ...(args as Record<string, unknown>) };
  delete rec.workspaceId;
  delete rec.orgId;
  delete rec.tenantId;
  return rec;
}

export function sanitizeCrmPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (value == null) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeCrmPayload(item, depth + 1));
  if (typeof value !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue;
    out[key] = sanitizeCrmPayload(val, depth + 1);
  }
  return out;
}

export function limitJson(value: unknown, maxChars = 40_000): unknown {
  const json = JSON.stringify(value);
  if (json.length <= maxChars) return value;
  return {
    truncated: true,
    message: "Resultado recortado para no saturar al modelo. Usá paginación o get_* sobre un id concreto.",
    preview: json.slice(0, Math.min(2_000, maxChars)),
  };
}
