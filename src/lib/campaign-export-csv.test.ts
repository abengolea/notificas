import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_EXPORT_HEADERS,
  buildCampaignExportFields,
  buildCampaignUploadFields,
  canalExportLabel,
  csvEscape,
  isUndeliveredOrError,
  publicRecipientEmail,
  publicSmtpMessageId,
  splitExportError,
} from './campaign-export-csv';

const ctx = {
  campaignId: 'camp-abc',
  campaignNombre: 'Deuda 180 días',
  remitente: 'GOcuotas Legales S.A.',
  cuitRemitente: '30712345678',
  canal: 'whatsapp' as const,
  appBase: 'https://notificas.com.ar',
};

test('emails sintéticos y smtp whatsapp-only no se exportan', () => {
  assert.equal(publicRecipientEmail('sin-email-1@wa.internal'), '');
  assert.equal(publicRecipientEmail('wa-5493364645357@notificas.internal'), '');
  assert.equal(publicRecipientEmail('persona@empresa.com'), 'persona@empresa.com');
  assert.equal(publicSmtpMessageId('whatsapp-only'), '');
  assert.equal(publicSmtpMessageId('<id@mx.example.com>'), '<id@mx.example.com>');
});

test('código de error Meta se separa del detalle', () => {
  const e = splitExportError('(#131008) Variable {{5}} (cuotas) está vacía.');
  assert.equal(e.code, '131008');
  assert.match(e.detail, /cuotas/);
});

test('CSV de subida: columnas del archivo original', () => {
  const headers = ['telefono', 'nombre', 'dni', 'fecha', 'monto', 'cuotas'];
  const fields = buildCampaignUploadFields(
    {
      recipientNombre: 'Adrian Bengolea',
      recipientEmail: 'sin-email-1@wa.internal',
      recipientTelefono: '+5493364645357',
      recipientDni: '25715970',
      recipientFecha: '14/02/26',
      recipientMonto: '130000',
      recipientCuotas: '1',
    },
    headers
  );
  assert.deepEqual(fields, ['+5493364645357', 'Adrian Bengolea', '25715970', '14/02/26', '130000', '1']);
});

test('problemas: error y WhatsApp enviado sin entregar', () => {
  assert.equal(isUndeliveredOrError({ estado: 'error' }), true);
  assert.equal(isUndeliveredOrError({ estado: 'enviado', waEstado: 'enviado' }), true);
  assert.equal(isUndeliveredOrError({ estado: 'enviado', waEstado: 'entregado' }), false);
  assert.equal(isUndeliveredOrError({ estado: 'leido', waEstado: 'leido' }), false);
});

test('CSV escapa comas y comillas', () => {
  assert.equal(csvEscape('GOcuotas, Legales'), '"GOcuotas, Legales"');
  assert.equal(csvEscape('dijo "hola"'), '"dijo ""hola"""');
});

test('canal y fila GOcuotas: cuotas=1, TXs WA, sin email sintético', () => {
  assert.equal(canalExportLabel('whatsapp'), 'WhatsApp');
  const fields = buildCampaignExportFields(
    1,
    'msg-1',
    {
      mailId: 'mail-1',
      recipientNombre: 'Adrian Bengolea',
      recipientEmail: 'sin-email-1@wa.internal',
      recipientTelefono: '+5493364645357',
      recipientDni: '25715970',
      recipientFecha: '14/02/26',
      recipientMonto: '130000',
      recipientCuotas: '1',
      estado: 'leido',
      waEstado: 'leido',
      waEnviadoAt: '2026-08-19T23:26:47.564Z',
      waEntregadoAt: '2026-08-19T23:26:50.000Z',
      waLeidoAt: '2026-08-19T23:27:03.510Z',
      waTxEntregado: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      waTxLeido: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      integrity: {
        send: {
          txHash: '0x4430aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          contentHash: '8da32aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          waBodyHash: '9e1f58aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          merkleRoot: '64c95baaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      },
    },
    {
      recipientPhone: '+5493364645357',
      recipientEmail: 'sin-email-1@wa.internal',
      whatsappMessageId: 'wamid.HBgNNTQ5MzM2NDY0NTM1NxUCABEYEjg',
      smtpMessageId: 'whatsapp-only',
      evidenceSnapshotHash: '15f1f2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      waTemplateName: 'notificacion_deuda_180_dias',
      waRequestSnapshot: {
        templateName: 'notificacion_deuda_180_dias',
        templateId: 'tpl_meta_123',
        templateLang: 'es_AR',
        templateHash: 'aa'.repeat(32),
      },
      tracking: {
        whatsappDelivered: true,
        whatsappRead: true,
        movements: [
          { type: 'whatsapp_sent', timestamp: '2026-08-19T23:26:47.564Z' },
          { type: 'whatsapp_delivered', timestamp: '2026-08-19T23:26:50.000Z' },
          { type: 'whatsapp_read', timestamp: '2026-08-19T23:27:03.510Z' },
        ],
      },
      polygonCertifications: {
        send: '0x4430aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        waDelivered: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        waRead: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    },
    ctx
  );

  const row = Object.fromEntries(CAMPAIGN_EXPORT_HEADERS.map((h, i) => [h, fields[i]]));
  assert.equal(row['Campaign ID'], 'camp-abc');
  assert.equal(row['Notification ID'], 'msg-1');
  assert.equal(row['Remitente'], 'GOcuotas Legales S.A.');
  assert.equal(row['CUIT remitente'], '30712345678');
  assert.equal(row['Nombre'], 'Adrian Bengolea');
  assert.equal(row['DNI'], '25715970');
  assert.equal(row['Teléfono'], '+5493364645357');
  assert.equal(row['Email'], '');
  assert.equal(row['Canal'], 'WhatsApp');
  assert.equal(row['Monto'], '130000');
  assert.equal(row['Cuotas'], '1');
  assert.equal(row['Template Meta'], 'notificacion_deuda_180_dias');
  assert.equal(row['Template ID Meta'], 'tpl_meta_123');
  assert.equal(row['Template Hash'], 'aa'.repeat(32));
  assert.match(String(row['WAMID (WhatsApp)']), /^wamid\./);
  assert.equal(row['SMTP Message-ID'], '');
  assert.equal(row['Estado canal'], 'read');
  assert.equal(row['Estado proveedor'], 'read');
  assert.equal(row['Enviado (UTC)'], '2026-08-19T23:26:47.564Z');
  assert.equal(row['Entregado (UTC)'], '2026-08-19T23:26:50.000Z');
  assert.equal(row['Leído (UTC)'], '2026-08-19T23:27:03.510Z');
  assert.ok(String(row['Hash contenido']).startsWith('8da32'));
  assert.ok(String(row['Hash snapshot']).startsWith('15f1f2'));
  assert.ok(String(row['Merkle root']).startsWith('64c95b'));
  assert.ok(String(row['TX Polygon — envío']).startsWith('0x4430'));
  assert.ok(String(row['TX Polygon — entrega']).startsWith('0xaaaa'));
  assert.ok(String(row['TX Polygon — lectura']).startsWith('0xbbbb'));
  assert.match(String(row['Verificar en Polygonscan']), /polygonscan\.com\/tx\/0x4430/);
  assert.equal(row['Verificar en Notificas'], 'https://notificas.com.ar/verify?id=mail-1');
});

test('TX lectura WA no usa polygonCertifications.read de email', () => {
  const fields = buildCampaignExportFields(
    1,
    'msg-2',
    {
      mailId: 'mail-2',
      recipientNombre: 'Ana',
      recipientDni: '1',
      waTxLeido: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    },
    {
      polygonCertifications: {
        read: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        waRead: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      },
    },
    ctx
  );
  const i = CAMPAIGN_EXPORT_HEADERS.indexOf('TX Polygon — lectura');
  assert.equal(fields[i], '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');
});
