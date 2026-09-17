import { timestampsFromFirestore, timestampsToFirestore, omitUndefined } from "./timestamps";

export function toFirestoreDocument(data: Record<string, unknown>): Record<string, unknown> {
  return timestampsToFirestore(omitUndefined(data));
}

export function fromFirestoreDocument(
  id: string,
  data: FirebaseFirestore.DocumentData | Record<string, unknown> | undefined,
): Record<string, unknown> {
  const raw = { ...(data || {}) };
  delete raw.id;
  return { id, ...timestampsFromFirestore(raw) };
}
