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

  const docRef = await addDoc(collection(db, 'mail'), {
    to: Array.isArray(to) ? to : [to],
    from,
    replyTo,
    cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
    bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
    message: {
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, '')
    }
  });

  return docRef.id;
}