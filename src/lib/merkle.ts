/**
 * Árbol de Merkle (SHA-256) para anclar un lote de hojas en una sola raíz.
 *
 * Fórmula de hoja:    SHA-256( UTF-8( leafPayload ) ) → hex 64
 * Fórmula de padre:   SHA-256( UTF-8( left + "|" + right ) ) → hex 64
 * Hoja impar: se duplica la última (mismo criterio que Bitcoin).
 *
 * Un solo nodo: la raíz es esa hoja.
 */

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPair(left: string, right: string): Promise<string> {
  return sha256Hex(`${left}|${right}`);
}

export type MerkleTree = {
  root: string;
  layers: string[][];
};

export async function buildMerkleTree(leaves: string[]): Promise<MerkleTree> {
  if (leaves.length === 0) {
    throw new Error('No se puede armar un árbol Merkle sin hojas');
  }

  const layers: string[][] = [leaves.slice()];
  let level = leaves.slice();

  while (level.length > 1) {
    if (level.length % 2 === 1) {
      level = [...level, level[level.length - 1]];
    }
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(await hashPair(level[i], level[i + 1]));
    }
    layers.push(next);
    level = next;
  }

  return { root: level[0], layers };
}

/** Camino de hermanos desde la hoja hasta la raíz (sin incluir la hoja). */
export function getMerkleProof(layers: string[][], index: number): string[] {
  const proof: string[] = [];
  let idx = index;

  for (let i = 0; i < layers.length - 1; i++) {
    let level = layers[i];
    if (level.length % 2 === 1) {
      level = [...level, level[level.length - 1]];
    }
    const sibling = idx % 2 === 0 ? level[idx + 1] : level[idx - 1];
    if (sibling) proof.push(sibling);
    idx = Math.floor(idx / 2);
  }

  return proof;
}

export async function verifyMerkleProof(
  leaf: string,
  proof: string[],
  root: string,
  index: number
): Promise<boolean> {
  let hash = leaf;
  let idx = index;

  for (const sibling of proof) {
    hash = idx % 2 === 0 ? await hashPair(hash, sibling) : await hashPair(sibling, hash);
    idx = Math.floor(idx / 2);
  }

  return hash === root;
}
