import { POLYGON_CERT_DISPLAY_ORDER } from './polygon-cert-labels';

/** Lo que el certificado imprime de cada transacción de Polygon, congelado al emitir. */
export type CertificateChainTx = {
  /** Campo de `mail.polygonCertifications` (send, waDelivered, …). */
  key: string;
  txHash: string;
  blockNumber?: number | null;
  /** ISO 8601 UTC del timestamp del bloque. */
  blockTime?: string | null;
  from?: string | null;
  /** Input Data decodificado como UTF-8. */
  payload?: string | null;
};

type TxInfo = {
  from?: string | null;
  blockNumber?: number | null;
  timestamp?: number | null;
  data?: string | null;
};

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * Consulta cada TX del certificado (bloque, fecha del bloque, dirección emisora y payload) para imprimirlas en el
 * anexo. Si la red no responde o la TX todavía no está minada, la entrada queda sin esos datos y el PDF lo dice:
 * nunca se inventan ni se completan.
 */
export async function collectChainTransactions(
  certifications: Record<string, unknown> | null | undefined,
  opts: { fetchInfo?: (txHash: string) => Promise<TxInfo>; timeoutMs?: number } = {}
): Promise<CertificateChainTx[]> {
  const certs = certifications || {};
  const entries = POLYGON_CERT_DISPLAY_ORDER.map((key) => ({ key, txHash: certs[key] })).filter(
    (e): e is { key: (typeof POLYGON_CERT_DISPLAY_ORDER)[number]; txHash: string } =>
      typeof e.txHash === 'string' && TX_HASH.test(e.txHash)
  );
  const fetchInfo =
    opts.fetchInfo ??
    (async (txHash: string) => (await import('./blockchain')).getTransactionInfo(txHash) as Promise<TxInfo>);
  const timeoutMs = opts.timeoutMs ?? 8000;

  return Promise.all(
    entries.map(async ({ key, txHash }): Promise<CertificateChainTx> => {
      try {
        const info = await withTimeout(fetchInfo(txHash), timeoutMs);
        return {
          key,
          txHash,
          blockNumber: typeof info.blockNumber === 'number' ? info.blockNumber : null,
          blockTime: typeof info.timestamp === 'number' ? new Date(info.timestamp * 1000).toISOString() : null,
          from: info.from || null,
          payload: typeof info.data === 'string' && info.data ? info.data : null,
        };
      } catch {
        return { key, txHash, blockNumber: null, blockTime: null, from: null, payload: null };
      }
    })
  );
}
