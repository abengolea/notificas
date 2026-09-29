/** SYNC: functions/read-code.js */
export const READ_CODES_COLLECTION = "readCodes";
export const READ_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const READ_CODE_LENGTH = 8;

export function parseReadCodeDoc(data: unknown): { mailId: string; token: string } | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as { mailId?: unknown; token?: unknown };
  const mailId = typeof rec.mailId === "string" ? rec.mailId.trim() : "";
  const token = typeof rec.token === "string" ? rec.token.trim() : "";
  if (!mailId || !token) return null;
  return { mailId, token };
}
