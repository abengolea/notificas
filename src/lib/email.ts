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

export async function scheduleEmail(params: ScheduleEmailParams): Promise<string> {
  const { to, subject, html, text, from, replyTo, cc, bcc } = params;

  const payload: any = {
    to: Array.isArray(to) ? to : [to],
    message: {
      subject,
      html,
      text: (text ?? html.replace(/<[^>]*>/g, '')) || ''
    }
  };

  if (from) payload.from = from;
  if (replyTo) payload.replyTo = replyTo;
  if (cc) payload.cc = Array.isArray(cc) ? cc : [cc];
  if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];

  const docRef = await addDoc(collection(db, 'mail'), payload);
  return docRef.id;
}