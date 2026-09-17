import { test } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "firebase-admin/firestore";
import {
  fromFirestoreTimestamp,
  timestampsFromFirestore,
  timestampsToFirestore,
  toFirestoreTimestamp,
} from "./persistence/timestamps";

test("ISO ↔ Firestore Timestamp y nulos", () => {
  assert.equal(toFirestoreTimestamp(undefined), undefined);
  assert.equal(toFirestoreTimestamp(null), null);
  const iso = "2026-09-17T12:00:00.000Z";
  const ts = toFirestoreTimestamp(iso);
  assert.ok(ts instanceof Timestamp);
  assert.equal(fromFirestoreTimestamp(ts), iso);
  assert.equal(fromFirestoreTimestamp(null), null);
  assert.equal(fromFirestoreTimestamp(undefined), undefined);
  assert.equal(fromFirestoreTimestamp(iso), iso);
});

test("mapea instantes anidados de primer nivel", () => {
  const iso = "2026-09-17T15:30:00.000Z";
  const encoded = timestampsToFirestore({
    name: "x",
    createdAt: iso,
    deletedAt: null,
    notes: "ok",
  });
  assert.ok(encoded.createdAt instanceof Timestamp);
  assert.equal(encoded.deletedAt, null);
  assert.equal(encoded.name, "x");
  const decoded = timestampsFromFirestore(encoded);
  assert.equal(decoded.createdAt, iso);
  assert.equal(decoded.deletedAt, null);
});
