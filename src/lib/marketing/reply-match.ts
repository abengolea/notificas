export type GmailHeaderSet = Record<string, string>;

export type ReplySendCandidate = {
  id: string;
  email: string;
  rfcMessageId: string | null;
  subject: string;
  campaignId: string;
  contactId: string;
};

function stripBrackets(id: string): string {
  return id.trim().replace(/^<|>$/g, "").toLowerCase();
}

function extractIds(value: string | undefined): string[] {
  if (!value) return [];
  const matches = value.match(/<[^>]+>/g);
  if (matches?.length) return matches.map(stripBrackets);
  return value
    .split(/\s+/)
    .map(stripBrackets)
    .filter(Boolean);
}

function fromEmail(fromHeader: string | undefined): string {
  if (!fromHeader) return "";
  const angle = fromHeader.match(/<([^>]+)>/);
  return (angle ? angle[1] : fromHeader).trim().toLowerCase();
}

function normalizeSubject(s: string): string {
  return s.replace(/^\s*((re|fw|fwd|rv|aw)\s*:\s*)+/i, "").trim().toLowerCase();
}

export function matchReplyToSends(input: {
  headers: GmailHeaderSet;
  snippet: string;
  sends: ReplySendCandidate[];
}): { sendId: string; campaignId: string; contactId: string } | null {
  const inReply = extractIds(input.headers["in-reply-to"]);
  const refs = extractIds(input.headers.references);
  const allIds = new Set([...inReply, ...refs]);

  for (const send of input.sends) {
    if (!send.rfcMessageId) continue;
    if (allIds.has(stripBrackets(send.rfcMessageId))) {
      return { sendId: send.id, campaignId: send.campaignId, contactId: send.contactId };
    }
  }

  const from = fromEmail(input.headers.from);
  if (!from) return null;
  const subj = normalizeSubject(input.headers.subject || "");
  const byEmail = input.sends.filter((s) => s.email.toLowerCase() === from);
  if (byEmail.length === 1) {
    return { sendId: byEmail[0].id, campaignId: byEmail[0].campaignId, contactId: byEmail[0].contactId };
  }
  if (subj) {
    const bySubj = byEmail.filter((s) => normalizeSubject(s.subject) === subj);
    if (bySubj.length) {
      const last = bySubj[bySubj.length - 1];
      return { sendId: last.id, campaignId: last.campaignId, contactId: last.contactId };
    }
  }
  return null;
}
