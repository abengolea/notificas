import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { enforceVerifyRateLimit, VERIFY_LIMIT_PER_MINUTE } from './verify-rate-limit';

function req(ip?: string) {
  return new NextRequest('http://localhost/api/verify', ip ? { headers: { 'x-forwarded-for': ip } } : undefined);
}

test('el verificador deja pasar mientras la IP no excede el límite y la cuenta por IP', async () => {
  const keys: string[] = [];
  const out = await enforceVerifyRateLimit(req('203.0.113.7, 10.0.0.1'), async (o) => {
    keys.push(`${o.key}|${o.limit}|${o.windowSeconds}`);
    return { ok: true as const };
  });
  assert.equal(out, null);
  assert.deepEqual(keys, [`verify_203.0.113.7|${VERIFY_LIMIT_PER_MINUTE}|60`]);
});

test('al excederse devuelve 429 con Retry-After y sin tocar la base', async () => {
  const out = await enforceVerifyRateLimit(req('198.51.100.9'), async () => ({ ok: false as const, retryAfter: 17 }));
  assert.ok(out);
  assert.equal(out.status, 429);
  assert.equal(out.headers.get('Retry-After'), '17');
  assert.match(JSON.stringify(await out.json()), /Demasiadas consultas/);
});

test('si el limitador falla, la verificación sigue (no se bloquea a un perito por un problema interno)', async () => {
  const out = await enforceVerifyRateLimit(req('198.51.100.9'), async () => {
    throw new Error('firestore caído');
  });
  assert.equal(out, null);
});

test('la clave no deja pasar caracteres raros de un X-Forwarded-For manipulado', async () => {
  let seen = '';
  await enforceVerifyRateLimit(req('1.2.3.4/../../x y'), async (o) => {
    seen = o.key;
    return { ok: true as const };
  });
  assert.match(seen, /^verify_[a-zA-Z0-9:._-]+$/);
  assert.equal(seen.includes('/'), false);
  assert.equal(seen.includes(' '), false);
});

test('sin IP identificable usa un balde común en vez de fallar', async () => {
  let seen = '';
  await enforceVerifyRateLimit(req(), async (o) => {
    seen = o.key;
    return { ok: true as const };
  });
  assert.equal(seen, 'verify_0.0.0.0');
});
