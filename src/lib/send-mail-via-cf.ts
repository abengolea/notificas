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
  /** El correo salió aunque el envío en conjunto falló (por ejemplo, falló solo el WhatsApp). */
  emailSent?: boolean;
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
    messageId?: unknown;
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
      // La Cloud Function manda el correo primero y recién después el WhatsApp: con messageId, el mail salió.
      emailSent: Boolean(cfBody.messageId),
    };
  }
  return { ok: true, httpStatus: cfRes.status };
}
