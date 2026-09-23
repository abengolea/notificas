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
