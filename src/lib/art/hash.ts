import { createHash } from "crypto";

export function publicApiSha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
