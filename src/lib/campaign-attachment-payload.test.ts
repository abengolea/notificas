import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCampaignAttachmentFields } from './campaign-attachment-payload';
import type { CampaignAttachment, RecipientEntry } from './types';

const att = (nombre: string): CampaignAttachment => ({
  nombre,
  url: `https://files.test/${nombre}`,
  hash: `hash-${nombre}`,
  size: 10,
});

const recipients = [
  { nombre: 'Juan Pérez', email: 'Juan@Empresa.com' },
  { nombre: 'Ana Gómez', email: 'ana@empresa.com' },
] as RecipientEntry[];

describe('buildCampaignAttachmentFields', () => {
  it('sin emparejamiento deja todos los archivos como globales', () => {
    const r = buildCampaignAttachmentFields({
      existingAttachments: [att('a.pdf')],
      uploadedNew: [att('b.pdf')],
      existingPaired: null,
      pairByRecipient: false,
      recipients,
      pairingSelections: {},
    });
    assert.deepEqual(r.adjuntosGlobales.map((x) => x.nombre), ['a.pdf', 'b.pdf']);
    assert.equal(r.adjuntosPorDestinatario, undefined);
  });

  it('con emparejamiento asigna un archivo por email en minúsculas y vacía los globales', () => {
    const r = buildCampaignAttachmentFields({
      existingAttachments: [att('viejo.pdf')],
      uploadedNew: [att('juan.pdf'), att('ana.pdf')],
      existingPaired: null,
      pairByRecipient: true,
      recipients,
      pairingSelections: { 'juan@empresa.com': 0, 'ana@empresa.com': 1 },
    });
    assert.deepEqual(r.adjuntosGlobales, []);
    assert.equal(r.adjuntosPorDestinatario?.['juan@empresa.com']?.[0].nombre, 'juan.pdf');
    assert.equal(r.adjuntosPorDestinatario?.['ana@empresa.com']?.[0].nombre, 'ana.pdf');
  });

  it('un destinatario sin selección queda con lista vacía', () => {
    const r = buildCampaignAttachmentFields({
      existingAttachments: [],
      uploadedNew: [att('juan.pdf')],
      existingPaired: null,
      pairByRecipient: true,
      recipients,
      pairingSelections: { 'juan@empresa.com': 0, 'ana@empresa.com': null },
    });
    assert.deepEqual(r.adjuntosPorDestinatario?.['ana@empresa.com'], []);
  });

  it('al editar sin archivos nuevos conserva el emparejamiento existente', () => {
    const paired = { 'juan@empresa.com': [att('juan.pdf')] };
    const r = buildCampaignAttachmentFields({
      existingAttachments: [],
      uploadedNew: [],
      existingPaired: paired,
      pairByRecipient: true,
      recipients,
      pairingSelections: {},
    });
    assert.deepEqual(r.adjuntosGlobales, []);
    assert.equal(r.adjuntosPorDestinatario, paired);
  });

  it('si se destilda el emparejamiento al editar, vuelve a globales y no devuelve el mapa', () => {
    const r = buildCampaignAttachmentFields({
      existingAttachments: [att('comun.pdf')],
      uploadedNew: [],
      existingPaired: { 'juan@empresa.com': [att('juan.pdf')] },
      pairByRecipient: false,
      recipients,
      pairingSelections: {},
    });
    assert.deepEqual(r.adjuntosGlobales.map((x) => x.nombre), ['comun.pdf']);
    assert.equal(r.adjuntosPorDestinatario, undefined);
  });
});
