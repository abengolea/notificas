import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

export type ScheduleEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
};

function normalizeList(value?: string | string[]) {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  return arr.map(v => v.trim()).filter(Boolean);
}

export async function scheduleEmail(params: ScheduleEmailParams): Promise<string> {
  const { to, subject, html, text, from, replyTo, cc, bcc } = params;

  const payload: any = {
    to: normalizeList(to),
    message: {
      subject,
      html,
      text: (text ?? html.replace(/<[^>]*>/g, '')) || ''
    }
  };

  const fromNorm = from?.trim();
  const replyToNorm = replyTo?.trim();
  const ccNorm = normalizeList(cc);
  const bccNorm = normalizeList(bcc);

  if (fromNorm) payload.from = fromNorm;
  if (replyToNorm) payload.replyTo = replyToNorm;
  if (ccNorm.length) payload.cc = ccNorm;
  if (bccNorm.length) payload.bcc = bccNorm;

  const docRef = await addDoc(collection(db, 'mail'), payload);
  return docRef.id;
}