import { sendEmailCfHeaders } from "@/lib/cf-send-auth";
import { getFirebaseSendEmailUrl } from "@/lib/mail-defaults";

export async function invokeSendEmail(
  docId: string,
): Promise<{
  ok: boolean;
  skipped?: boolean;
  error?: string;
  httpStatus?: number;
  errorCode?: unknown;
  limitHit?: boolean;
  limitSource?: unknown;
}> {
  const fnUrl = getFirebaseSendEmailUrl();
  const cfRes = await fetch(fnUrl, {
    method: "POST",
    headers: sendEmailCfHeaders(),
    body: JSON.stringify({ docId }),
  });

  const cfBody = (await cfRes.json().catch(() => ({}))) as {
    error?: string;
    success?: boolean;
    skipped?: boolean;
    errorCode?: unknown;
    limitHit?: boolean;
    limitSource?: unknown;
  };

  if (cfBody.skipped === true || cfRes.status === 409) {
    return {
      ok: false,
      skipped: true,
      error: cfBody.error || `HTTP ${cfRes.status}`,
      httpStatus: cfRes.status,
    };
  }

  if (!cfRes.ok || cfBody.success === false) {
    return {
      ok: false,
      error: cfBody.error || `HTTP ${cfRes.status}`,
      httpStatus: cfRes.status,
      errorCode: cfBody.errorCode,
      limitHit: cfBody.limitHit === true,
      limitSource: cfBody.limitSource,
    };
  }
  return { ok: true, httpStatus: cfRes.status };
}
