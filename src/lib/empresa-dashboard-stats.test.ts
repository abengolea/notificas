import { test } from "node:test";
import assert from "node:assert/strict";
import type { Campaign } from "./types";
import {
  buildOrgDashboardStats,
  campaignTitle,
  canalOf,
  parseCampaignInstant,
} from "./empresa-dashboard-stats";

function camp(partial: Partial<Campaign> & Pick<Campaign, "id">): Campaign {
  return {
    orgId: "org1",
    createdBy: "u1",
    nombre: "Campaña",
    asunto: "Aviso",
    cuerpo: "",
    adjuntos: [],
    recipientEmails: [],
    recipientData: [],
    recipientCount: 10,
    estado: "completada",
    stats: { total: 10, enviados: 10, leidos: 4, pendientes: 0, errores: 0 },
    createdAt: new Date("2026-03-15T12:00:00.000Z"),
    ...partial,
  };
}

test("parseCampaignInstant lee seconds de Firestore", () => {
  const d = parseCampaignInstant({ seconds: 1_700_000_000 });
  assert.ok(d);
  assert.equal(d!.getTime(), 1_700_000_000 * 1000);
});

test("agrega enviados, pendientes, WhatsApp y meses", () => {
  const now = new Date("2026-08-21T15:00:00.000Z");
  const rows = [
    camp({
      id: "a",
      canal: "email",
      createdAt: new Date("2026-08-02T12:00:00.000Z"),
      stats: { total: 5, enviados: 5, leidos: 2, pendientes: 0, errores: 0 },
      recipientCount: 5,
    }),
    camp({
      id: "b",
      canal: "whatsapp",
      estado: "enviando",
      createdAt: new Date("2026-08-10T12:00:00.000Z"),
      stats: { total: 20, enviados: 8, leidos: 3, pendientes: 12, errores: 0 },
      recipientCount: 20,
    }),
    camp({
      id: "c",
      canal: "ambos",
      createdAt: new Date("2026-07-20T12:00:00.000Z"),
      stats: { total: 4, enviados: 4, leidos: 1, pendientes: 0, errores: 1 },
      recipientCount: 4,
    }),
  ];
  const s = buildOrgDashboardStats(rows, now);
  assert.equal(s.campanas, 3);
  assert.equal(s.enviados, 17);
  assert.equal(s.pendientes, 12);
  assert.equal(s.waEnviados, 12);
  assert.equal(s.emailEnviados, 9);
  assert.equal(s.mixtas, 1);
  assert.equal(s.enviadosMes, 13);
  assert.equal(s.enviadosMesAnterior, 4);
  assert.equal(s.porEstado.enviando, 1);
  assert.equal(s.enCurso.length, 1);
  assert.equal(s.enCurso[0].id, "b");
  const ago = s.months.find((m) => m.key === "2026-08");
  const jul = s.months.find((m) => m.key === "2026-07");
  assert.equal(ago?.enviados, 13);
  assert.equal(ago?.whatsapp, 8);
  assert.equal(jul?.enviados, 4);
});

test("excluye campañas simuladas de todos los totales", () => {
  const now = new Date("2026-08-21T15:00:00.000Z");
  const s = buildOrgDashboardStats(
    [
      camp({
        id: "real",
        canal: "email",
        createdAt: new Date("2026-08-02T12:00:00.000Z"),
        stats: { total: 5, enviados: 5, leidos: 2, pendientes: 0, errores: 0 },
        recipientCount: 5,
      }),
      camp({
        id: "sim",
        simulated: true,
        canal: "whatsapp",
        estado: "enviando",
        createdAt: new Date("2026-08-10T12:00:00.000Z"),
        stats: { total: 1000, enviados: 900, leidos: 400, pendientes: 100, errores: 0 },
        recipientCount: 1000,
      }),
    ],
    now,
  );
  assert.equal(s.omitidasSimuladas, 1);
  assert.equal(s.campanas, 1);
  assert.equal(s.enviados, 5);
  assert.equal(s.waEnviados, 0);
  assert.equal(s.pendientes, 0);
  assert.equal(s.enCurso.length, 0);
  assert.equal(s.recientes.map((c) => c.id).join(","), "real");
});

test("campaignTitle ignora undefined", () => {
  assert.equal(campaignTitle(camp({ id: "x", nombre: "undefined", asunto: "Real" })), "Real");
  assert.equal(canalOf(camp({ id: "y" })), "email");
});
