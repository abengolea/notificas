import { formatContactFromEmail } from "@/lib/mail-defaults";

export async function sendArtTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = formatContactFromEmail();
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[art] transactional email skipped (no RESEND_API_KEY)", {
        to: input.to,
        subject: input.subject,
      });
      return { ok: true, skipped: true };
    }
    return { ok: false, error: "email_provider_unconfigured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html || `<p>${escapeHtml(input.text).replace(/\n/g, "<br/>")}</p>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `resend_${res.status}:${body.slice(0, 180)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
