export type MarketingPage<T> = {
  items: T[];
  nextCursor?: string;
};

export type MarketingCursorPayload = {
  t: string;
  id: string;
};

export function encodeMarketingCursor(payload: MarketingCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeMarketingCursor(cursor: string | undefined): MarketingCursorPayload | null {
  if (!cursor || !cursor.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as MarketingCursorPayload;
    if (!parsed || typeof parsed.t !== "string" || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clampMarketingLimit(limit: number | undefined, fallback = 50, max = 100): number {
  if (limit == null || Number.isNaN(limit)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(limit)));
}

export async function listAllMarketingPages<T>(
  pageFn: (cursor?: string) => Promise<MarketingPage<T>>,
  maxPages = 40,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await pageFn(cursor);
    items.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return items;
}
