export type ListCursor = {
  createdAtMs: number;
  id: string;
};

export function encodeCursor(cursor: ListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined | null): ListCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as ListCursor;
    if (!parsed || typeof parsed.createdAtMs !== "number" || typeof parsed.id !== "string") return null;
    if (!Number.isFinite(parsed.createdAtMs) || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}
