import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_CONTACTS } from "@/lib/marketing/collections";
import { contactIdForEmail, parseContactCsv } from "@/lib/marketing/csv";

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const contentType = request.headers.get("content-type") || "";
    let text = "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file instanceof File) text = await file.text();
      else text = String(form.get("csv") || "");
    } else {
      const body = await request.json().catch(() => ({}));
      text = String((body as { csv?: string }).csv || "");
    }
    const parsed = parseContactCsv(text);
    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "No hay filas válidas", errors: parsed.errors, skipped: parsed.skipped },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    let created = 0;
    let updated = 0;
    let batch = db.batch();
    let ops = 0;
    const flush = async () => {
      if (!ops) return;
      await batch.commit();
      batch = db.batch();
      ops = 0;
    };

    for (const row of parsed.rows) {
      const id = contactIdForEmail(row.email);
      const ref = db.collection(MARKETING_CONTACTS).doc(id);
      const existing = await ref.get();
      const base = {
        email: row.email,
        emailKey: row.email,
        name: row.name,
        company: row.company,
        title: row.title,
        country: row.country,
        notes: row.notes,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (existing.exists) {
        batch.set(ref, base, { merge: true });
        updated += 1;
      } else {
        batch.set(ref, {
          ...base,
          stage: "new",
          stageManual: false,
          source: "csv",
          tags: [],
          lastCampaignId: null,
          lastSendId: null,
          lastSentAt: null,
          lastOpenedAt: null,
          lastClickedAt: null,
          lastRepliedAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
        created += 1;
      }
      ops += 1;
      if (ops >= 400) await flush();
    }
    await flush();

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped: parsed.skipped,
      errors: parsed.errors.slice(0, 40),
      errorCount: parsed.errors.length,
    });
  } catch (e) {
    console.error("POST marketing import", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
