import { test } from 'node:test';
import assert from 'node:assert/strict';
import { certificatePlainBody, generateCertificatePDF } from './certificate-generator';

const START = 'MARCA_INICIO_CERT_PAGINACION_9f3a';
const END = 'MARCA_FIN_CERT_PAGINACION_c7e2';

function pdfText(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString('latin1')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')');
}

function longIntimacion(): string {
  const clause =
    'INTIMO a acreditar documentalmente la autorizacion de cada debito, el mecanismo de pago y la liquidacion completa de la relacion crediticia. ';
  return `${START} ${clause.repeat(80)}${END}`;
}

test('el certificado pagina el cuerpo largo y no lo corta', async () => {
  const body = longIntimacion();
  const blob = await generateCertificatePDF({
    messageId: 'testPaginateLongBody',
    issuedAt: new Date('2026-09-23T12:26:50.000Z'),
    evidenceSealed: true,
    mailData: {
      from: 'abengolea1@gmail.com',
      recipientEmail: 'cyr@credlap.com',
      recipientName: 'cyr',
      recipientPhone: '+54 9 221 546 2961',
      message: {
        subject: 'Intimacion de prueba',
        content: body,
        contentText: body,
      },
      delivery: { state: 'accepted', time: '2026-09-16T15:40:54Z' },
      tracking: { token: 'tokentest' },
      evidenceSnapshotHash: 'abc',
    },
    movements: [],
    attachments: [],
  });

  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, new RegExp(START));
  assert.match(raw, new RegExp(END));
  assert.match(raw, /continuaci/);
});

test('el cuerpo del certificado usa el texto plano y no pega las palabras del HTML', () => {
  assert.equal(
    certificatePlainBody({
      content: '<p>entidad</p><p>originante</p><p>cámara compensadora</p>',
      contentText: 'entidad originante, cámara compensadora',
    }),
    'entidad originante, cámara compensadora'
  );
  assert.equal(
    certificatePlainBody({
      content: '<p>entidad</p><p>originante</p><p>cámara compensadora</p>',
    }),
    'entidad\noriginante\ncámara compensadora'
  );
  assert.equal(certificatePlainBody({ content: 'hola</p><p>mundo' }).includes('holamundo'), false);
});

test('el PDF conserva espacios aunque el HTML del editor los pierda al sacar etiquetas', async () => {
  const blob = await generateCertificatePDF({
    messageId: 'testPlainBodyWins',
    issuedAt: new Date('2026-09-23T12:26:50.000Z'),
    evidenceSealed: true,
    mailData: {
      from: 'abengolea1@gmail.com',
      recipientEmail: 'cyr@credlap.com',
      message: {
        subject: 'Asunto',
        content: '<p>entidad</p><p>originante</p><p>presentador</p>',
        contentText: 'entidad originante, presentador, camara compensadora',
      },
    },
    movements: [],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, /entidad originante/);
  assert.equal(raw.includes('entidadoriginante'), false);
});

test('el ejemplar de correccion aclara que no cambian los hechos', async () => {
  const body = `${START} texto breve ${END}`;
  const blob = await generateCertificatePDF({
    messageId: 'testLayoutCorrection',
    issuedAt: new Date('2026-09-23T12:26:50.000Z'),
    evidenceSealed: true,
    layoutCorrection: true,
    mailData: {
      from: 'abengolea1@gmail.com',
      recipientEmail: 'cyr@credlap.com',
      message: { subject: 'Asunto', content: body, contentText: body },
    },
    movements: [],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, /corrige la diagramaci/);
  assert.match(raw, /hechos congelados no cambian/);
  assert.match(raw, new RegExp(START));
  assert.match(raw, new RegExp(END));
});

test('señal Resend y reader no se mezclan con pixel Notificas en el resultado', async () => {
  const blob = await generateCertificatePDF({
    messageId: 'testEmailEvidenceSplit',
    issuedAt: new Date('2026-09-24T18:49:37.000Z'),
    evidenceSealed: true,
    mailData: {
      from: 'rem@test.com',
      recipientEmail: 'dest@test.com',
      message: { subject: 'Asunto', contentText: 'cuerpo' },
      delivery: { state: 'DELIVERED', time: '2026-09-24T18:46:22Z' },
      tracking: { opened: true },
    },
    movements: [
      { type: 'resend_opened_signal', timestamp: '2026-09-24T18:47:00Z' },
      { type: 'reader_magic_open', timestamp: '2026-09-24T18:48:00Z' },
    ],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, /Apertura informada por proveedor: S/i);
  assert.doesNotMatch(raw, /Apertura por pixel: No consta/i);
  assert.match(raw, /Acceso al lector certificado: S/i);
  assert.match(raw, /Resultado de la notificaci/i);
  assert.match(raw, /certificado-lectura\/v4/i);
});

test('el resumen usa la etiqueta Resumen y no Lectura humana', async () => {
  const blob = await generateCertificatePDF({
    messageId: 'testResumenLabel',
    issuedAt: new Date('2026-09-25T18:15:00.000Z'),
    evidenceSealed: true,
    mailData: {
      from: 'rem@test.com',
      recipientEmail: 'dest@test.com',
      message: { subject: 'Asunto', contentText: 'Cuerpo' },
      delivery: { state: 'accepted', time: '2026-09-25T18:13:00Z' },
      tracking: { token: 'tok' },
    },
    movements: [],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, /Resumen:/);
  assert.doesNotMatch(raw, /Lectura humana:/);
});

test('enlace de WhatsApp y lectura confirmada aparecen en el resumen humano', async () => {
  const blob = await generateCertificatePDF({
    messageId: 'testWaLinkAndConfirm',
    issuedAt: new Date('2026-09-25T16:43:42.000Z'),
    evidenceSealed: true,
    mailData: {
      from: 'rem@test.com',
      recipientEmail: 'dest@test.com',
      recipientPhone: '+5493412594825',
      message: { subject: 'Asunto', contentText: 'cuerpo' },
      delivery: { state: 'DELIVERED', time: '2026-09-25T15:09:37Z' },
      tracking: { whatsappDelivered: true },
    },
    movements: [
      { type: 'whatsapp_delivered', timestamp: '2026-09-25T15:09:41Z' },
      { type: 'whatsapp_link_clicked', timestamp: '2026-09-25T16:13:15Z' },
      { type: 'read_confirmed', timestamp: '2026-09-25T15:11:49Z' },
    ],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, /Acceso desde enlace del mensaje: S/i);
  assert.match(raw, /Leído en el chat: No consta/i);
  assert.match(raw, /acceso desde el enlace del mensaje/i);
  assert.match(raw, /lectura confirmada en el lector certificado/i);
});

test('el anexo imprime cada TX completa con bloque, fecha, emisor, payload y las fórmulas de los compromisos', async () => {
  const txSend = '0x' + 'fb494615'.repeat(8);
  const txRead = '0x' + 'c5c16259'.repeat(8);
  const payload = 'SEND|mail_1|uid_1|rcpt:' + 'ab'.repeat(32) + '|' + 'cd'.repeat(32) + '|smtp:<id@x>|2026-11-03T22:36:41.000Z';
  const text = 'Hola Ana.\n\nSu cuenta registra una deuda.';
  const blob = await generateCertificatePDF({
    messageId: 'testAnexoChain',
    issuedAt: new Date('2026-11-04T19:19:49Z'),
    evidenceSealed: true,
    mailData: {
      from: 'a@b.c',
      recipientEmail: 'ana@example.com',
      message: { subject: 'Asunto', content: text, contentText: text },
      polygonCertifications: { send: txSend, waRead: txRead },
    },
    chainTransactions: [
      {
        key: 'send',
        txHash: txSend,
        blockNumber: 96693320,
        blockTime: '2026-11-03T22:37:16.000Z',
        from: '0x1Cc132e0BeAD9A53aeB7885259DF9FEFb3ede66A',
        payload,
      },
      { key: 'waRead', txHash: txRead, blockNumber: null, blockTime: null, from: null, payload: null },
    ],
    movements: [],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.ok(raw.includes(txSend), 'la TX de envío debe figurar completa');
  assert.ok(raw.includes(txRead), 'la TX de lectura debe figurar completa');
  assert.equal(raw.includes(txSend.slice(0, 10) + '…'), false, 'no puede quedar la TX recortada con puntos suspensivos');
  assert.match(raw, /Bloque 96693320/);
  assert.match(raw, /coincide con la dirección emisora publicada/);
  assert.match(raw, /rcpt:abababab/);
  assert.match(raw, /sin datos al emitir/);
  assert.match(raw, /"wamid\|"/);
  assert.match(raw, /"rcpt\|"/);
  assert.match(raw, /no puede figurar aquí/);
  // hex del texto hasheado: "Hola Ana." = 486f6c6120416e612e
  assert.match(raw, /486f6c6120416e612e0a0a/);
  assert.match(raw, /xxd -r -p/);
});
