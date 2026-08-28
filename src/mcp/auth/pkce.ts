import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function newCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false;
  if (!/^[A-Za-z0-9._~-]+$/.test(verifier)) return false;
  const computed = Buffer.from(codeChallengeS256(verifier));
  const expected = Buffer.from(challenge);
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

export function isValidCodeChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(challenge);
}
