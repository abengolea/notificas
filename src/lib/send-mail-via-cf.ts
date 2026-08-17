import { sendEmailCfHeaders } from "@/lib/cf-send-auth";
import { getFirebaseSendEmailUrl } from "@/lib/mail-defaults";

export async function invokeSendEmail(
  docId: string,
): Promise<{ ok: boolean; error?: string }> {
  const fnUrl = getFirebaseSendEmailUrl();
  const cfRes = await fetch(fnUrl, {
    method: "POST",
    headers: sendEmailCfHeaders(),
    body: JSON.stringify({ docId }),
  });

  const cfBody = (await cfRes.json().catch(() => ({}))) as {
    error?: string;
    success?: boolean;
  };

  if (!cfRes.ok || cfBody.success === false) {
    return { ok: false, error: cfBody.error || `HTTP ${cfRes.status}` };
  }
  return { ok: true };
}
