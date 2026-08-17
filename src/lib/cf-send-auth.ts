/** Headers para invocar la Cloud Function sendEmail (mismo secreto que certify-event). */
export function sendEmailCfHeaders(): Record<string, string> {
  const secret = (
    process.env.POLYGON_CERTIFY_SECRET ||
    process.env.CAMPAIGN_WORKER_SECRET ||
    ""
  ).trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Certify-Secret"] = secret;
  return headers;
}
