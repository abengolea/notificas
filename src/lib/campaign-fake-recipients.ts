import type { CanalCampaign, RecipientEntry } from '@/lib/types';

const NOMBRES = [
  'Ana', 'Carlos', 'María', 'Juan', 'Laura', 'Pedro', 'Sofía', 'Diego', 'Valentina', 'Martín',
  'Florencia', 'Sebastián', 'Camila', 'Nicolás', 'Lucía', 'Mateo', 'Emma', 'Lucas', 'Mia', 'Tomás',
];
const APELLIDOS = [
  'García', 'Rodríguez', 'López', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Romero',
  'Torres', 'Díaz', 'Álvarez', 'Fernández', 'Moreno', 'Muñoz', 'Ruiz', 'Jiménez',
];

export const SIM_RECIPIENT_MIN = 10;
export const SIM_RECIPIENT_MAX = 50_000;
export const SIM_RECIPIENT_DEFAULT = 10_000;

const TEST_EMAIL_DOMAIN = 'test.notificas-qa.internal';

export function generateFakeCampaignRecipients(
  count: number,
  canal: CanalCampaign
): RecipientEntry[] {
  const n = Math.max(SIM_RECIPIENT_MIN, Math.min(SIM_RECIPIENT_MAX, Math.floor(count)));
  const needEmail = canal === 'email' || canal === 'ambos';
  const needPhone = canal === 'whatsapp' || canal === 'ambos';

  return Array.from({ length: n }, (_, i) => {
    const idx = i + 1;
    const nombre = `${NOMBRES[i % NOMBRES.length]} ${APELLIDOS[Math.floor(i / NOMBRES.length) % APELLIDOS.length]}`;
    const row: RecipientEntry = {
      nombre,
      dni: String(20_000_000 + idx),
      legajo: `SIM-${String(idx).padStart(5, '0')}`,
    };
    if (needEmail) {
      row.email = `sim.${idx}@${TEST_EMAIL_DOMAIN}`;
    } else {
      row.email = `sim.${idx}@wa.internal`;
    }
    if (needPhone) {
      row.telefono = `+54911${String(10_000_000 + idx).slice(-8)}`;
    }
    return row;
  });
}
