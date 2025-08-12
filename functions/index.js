const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cheerio = require('cheerio');

initializeApp();

const REGION = 'us-central1';
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'notificas-f9953';
const TRACKING_BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

const transporter = nodemailer.createTransport({
  host: 'vps-1711372-x.dattaweb.com',
  port: 587,
  secure: false,
  auth: {
    user: 'contacto@notificas.com',
    pass: '3JF9x*a2xS'
  }
});

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function injectTrackingIntoHtml(html, docId, token) {
  if (!html) return html;
  const $ = cheerio.load(html, { decodeEntities: false });

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith(`${TRACKING_BASE_URL}/linkRedirect`)) return;
    const encoded = base64UrlEncode(href);
    const redirectUrl = `${TRACKING_BASE_URL}/linkRedirect?msg=${encodeURIComponent(docId)}&u=${encoded}&k=${encodeURIComponent(token)}`;
    $(el).attr('href', redirectUrl);
  });

  const pixelUrl = `${TRACKING_BASE_URL}/trackOpen?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(token)}`;
  const pixelTag = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;" />`;
  if ($('body').length > 0) $('body').append(pixelTag);
  else $.root().append(pixelTag);

  const confirmUrl = `${TRACKING_BASE_URL}/confirmRead?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(token)}`;
  const confirmBlock = `<p style="margin-top:24px"><a href="${confirmUrl}" target="_blank" rel="noopener">Confirmar lectura</a></p>`;
  if ($('body').length > 0) $('body').append(confirmBlock);
  else $.root().append(confirmBlock);

  return $.html();
}

exports.sendEmail = onDocumentCreated(
  { document: 'mail/{docId}', region: REGION, concurrency: 10 },
  async (event) => {
    const emailData = event.data.data() || {};
    const docRef = event.data.ref;
    const docId = event.params.docId;

    const toRaw = emailData.to;
    const to = Array.isArray(toRaw) ? toRaw.join(',') : toRaw;
    const from = emailData.from || 'contacto@notificas.com';

    const trackingToken = emailData.tracking?.token || generateToken();

    const subject = emailData.message?.subject || 'Sin asunto';
    const htmlOriginal = emailData.message?.html || '';
    const textOriginal = emailData.message?.text || htmlOriginal.replace(/<[^>]*>/g, '');

    const htmlWithTracking = injectTrackingIntoHtml(htmlOriginal, docId, trackingToken);

    try {
      const mailOptions = {
        from,
        to,
        subject,
        text: textOriginal,
        html: htmlWithTracking,
        replyTo: emailData.replyTo,
        cc: emailData.cc,
        bcc: emailData.bcc
      };

      const result = await transporter.sendMail(mailOptions);

      await docRef.set(
        {
          delivery: {
            state: 'SUCCESS',
            time: FieldValue.serverTimestamp(),
            info: result.messageId
          },
          tracking: {
            token: trackingToken,
            sentAt: FieldValue.serverTimestamp(),
            openCount: 0,
            clickCount: 0,
            opened: false,
            openedAt: null,
            readConfirmed: false,
            readConfirmedAt: null,
            messageId: result.messageId
          }
        },
        { merge: true }
      );

      console.log('Email enviado:', result.messageId);
    } catch (error) {
      console.error('Error:', error);
      await docRef.set(
        {
          delivery: {
            state: 'ERROR',
            time: FieldValue.serverTimestamp(),
            error: error.message
          }
        },
        { merge: true }
      );
    }
  }
);

exports.trackOpen = onRequest({ region: REGION }, async (req, res) => {
  try {
    const { msg, k } = req.query;
    if (!msg || !k) return res.status(400).send('Missing params');

    const db = getFirestore();
    const docRef = db.collection('mail').doc(String(msg));
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).send('Not found');

    const data = snap.data() || {};
    const token = data?.tracking?.token;
    if (!token || token !== String(k)) {
      return res.status(403).send('Forbidden');
    }

    await docRef.set(
      {
        tracking: {
          opened: true,
          openedAt: FieldValue.serverTimestamp(),
          openCount: FieldValue.increment(1)
        }
      },
      { merge: true }
    );

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2P8z8DwHwAFgwJ/lzYhNwAAAABJRU5ErkJggg==',
      'base64'
    );
    return res.status(200).send(pixel);
  } catch (e) {
    console.error(e);
    return res.status(200).end();
  }
});

exports.linkRedirect = onRequest({ region: REGION }, async (req, res) => {
  try {
    const { msg, u, k } = req.query;
    if (!msg || !u || !k) return res.status(400).send('Missing params');

    const url = base64UrlDecode(String(u));
    const db = getFirestore();
    const docRef = db.collection('mail').doc(String(msg));
    const snap = await docRef.get();
    if (!snap.exists) return res.redirect(302, url);

    const data = snap.data() || {};
    const token = data?.tracking?.token;
    if (token && token === String(k)) {
      await docRef.set(
        {
          tracking: {
            clickCount: FieldValue.increment(1),
            lastClickAt: FieldValue.serverTimestamp(),
            clicks: FieldValue.arrayUnion({
              url,
              at: new Date().toISOString()
            })
          }
        },
        { merge: true }
      );
    }

    return res.redirect(302, url);
  } catch (e) {
    console.error(e);
    return res.status(302).redirect('https://notificas.com');
  }
});

exports.confirmRead = onRequest({ region: REGION }, async (req, res) => {
  try {
    const { msg, k } = req.query;
    if (!msg || !k) return res.status(400).send('Missing params');

    const db = getFirestore();
    const docRef = db.collection('mail').doc(String(msg));
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).send('Not found');

    const data = snap.data() || {};
    const token = data?.tracking?.token;
    if (!token || token !== String(k)) {
      return res.status(403).send('Forbidden');
    }

    await docRef.set(
      {
        tracking: {
          readConfirmed: true,
          readConfirmedAt: FieldValue.serverTimestamp()
        }
      },
      { merge: true }
    );

    res.set('Content-Type', 'text/html; charset=utf-8');
    return res
      .status(200)
      .send('<!doctype html><html><body><h3>Lectura confirmada ✅</h3><p>Gracias.</p></body></html>');
  } catch (e) {
    console.error(e);
    return res.status(200).send('OK');
  }
});